-- Desconto percentual no total da OS, limitado a 4%.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_discount_percent_check;

ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_discount_percent_check
  CHECK (discount_percent >= 0 AND discount_percent <= 4);

-- Congela também subtotal, percentual, valor do desconto e total final no orçamento aprovado.
CREATE OR REPLACE FUNCTION public.quote_snapshot(o public.service_orders)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'number', o.number,
    'customer_name', o.customer_name,
    'plate', o.plate,
    'vehicle', o.vehicle,
    'complaint', o.complaint,
    'diagnosis', o.diagnosis,
    'parts', o.parts,
    'part_items', o.part_items,
    'parts_value', o.parts_value,
    'labor_value', o.labor_value,
    'subtotal', round(coalesce(o.parts_value, 0) + coalesce(o.labor_value, 0), 2),
    'discount_percent', coalesce(o.discount_percent, 0),
    'discount_amount', round(
      (coalesce(o.parts_value, 0) + coalesce(o.labor_value, 0))
      * coalesce(o.discount_percent, 0) / 100, 2
    ),
    'total', round(coalesce(o.parts_value, 0) + coalesce(o.labor_value, 0), 2)
      - round(
        (coalesce(o.parts_value, 0) + coalesce(o.labor_value, 0))
        * coalesce(o.discount_percent, 0) / 100, 2
      ),
    'due_date', o.due_date
  );
$function$;

-- O saldo e a validação de pagamentos passam a usar o total líquido da OS.
CREATE OR REPLACE FUNCTION public.confirm_service_order_payment(
  _order_id uuid,
  _amount numeric,
  _note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.service_orders;
  v_total numeric(12,2);
  v_received numeric(12,2);
  v_balance numeric(12,2);
  v_payment public.service_order_payments;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado para confirmar recebimento';
  END IF;

  IF _order_id IS NULL OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount, 2) THEN
    RAISE EXCEPTION 'Informe um valor de pagamento válido';
  END IF;

  IF _note IS NOT NULL AND char_length(_note) > 500 THEN
    RAISE EXCEPTION 'Observação excede 500 caracteres';
  END IF;

  SELECT * INTO v_order
  FROM public.service_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_order.status = 'cancelado'::public.order_status THEN
    RAISE EXCEPTION 'Não é possível registrar recebimento em OS cancelada';
  END IF;

  v_total := round(
    (coalesce(v_order.parts_value, 0) + coalesce(v_order.labor_value, 0)), 2
  ) - round(
    (coalesce(v_order.parts_value, 0) + coalesce(v_order.labor_value, 0))
    * coalesce(v_order.discount_percent, 0) / 100, 2
  );

  SELECT coalesce(sum(p.amount), 0)::numeric(12,2)
  INTO v_received
  FROM public.service_order_payments p
  WHERE p.service_order_id = _order_id;

  v_balance := v_total - v_received;

  IF _amount > v_balance THEN
    RAISE EXCEPTION 'Pagamento excede o saldo pendente de %', v_balance;
  END IF;

  INSERT INTO public.service_order_payments (
    service_order_id, amount, note, confirmed_by
  )
  VALUES (
    _order_id, _amount, nullif(btrim(_note), ''), auth.uid()
  )
  RETURNING * INTO v_payment;

  v_received := v_received + v_payment.amount;
  v_balance := greatest(v_total - v_received, 0);

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'service_order_id', _order_id,
    'total', v_total,
    'received', v_received,
    'balance', v_balance,
    'paid_percent', CASE WHEN v_total > 0 THEN round((v_received / v_total) * 100, 2) ELSE 0 END,
    'confirmed_at', v_payment.confirmed_at,
    'confirmed_by', v_payment.confirmed_by
  );
END;
$function$;


-- O resumo geral do Financeiro também usa o total líquido após o desconto.
CREATE OR REPLACE FUNCTION public.admin_get_financial_overview()
RETURNS TABLE(
  service_order_id uuid,
  order_number integer,
  customer_name text,
  plate text,
  order_status text,
  total numeric,
  received numeric,
  balance numeric,
  paid_percent numeric,
  last_payment_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  RETURN QUERY
  SELECT
    so.id,
    so.number,
    so.customer_name,
    so.plate,
    so.status::text,
    (
      round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2)
      - round(
          (coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0))
          * coalesce(so.discount_percent, 0) / 100,
          2
        )
    )::numeric,
    coalesce(pay.received, 0)::numeric,
    greatest(
      (
        round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2)
        - round(
            (coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0))
            * coalesce(so.discount_percent, 0) / 100,
            2
          )
      ) - coalesce(pay.received, 0),
      0
    )::numeric,
    CASE
      WHEN (
        round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2)
        - round(
            (coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0))
            * coalesce(so.discount_percent, 0) / 100,
            2
          )
      ) > 0
      THEN round(
        (
          coalesce(pay.received, 0)
          / (
              round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2)
              - round(
                  (coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0))
                  * coalesce(so.discount_percent, 0) / 100,
                  2
                )
            )
        ) * 100,
        2
      )
      ELSE 0
    END::numeric,
    pay.last_payment_at
  FROM public.service_orders so
  LEFT JOIN LATERAL (
    SELECT
      sum(p.amount)::numeric(12,2) AS received,
      max(p.confirmed_at) AS last_payment_at
    FROM public.service_order_payments p
    WHERE p.service_order_id = so.id
  ) pay ON true
  WHERE so.status <> 'cancelado'::public.order_status
    AND (
      coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0) > 0
      OR coalesce(pay.received, 0) > 0
    )
  ORDER BY so.number DESC;
END;
$function$;
