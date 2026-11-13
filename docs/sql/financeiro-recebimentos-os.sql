-- Recebimentos confirmados vinculados exclusivamente a ordens de serviço.
-- O orçamento e o status operacional da OS permanecem independentes do financeiro.

CREATE TABLE IF NOT EXISTS public.service_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  confirmed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_order_payments_order_confirmed_idx
  ON public.service_order_payments (service_order_id, confirmed_at DESC);

ALTER TABLE public.service_order_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_order_payments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.service_order_payments TO service_role;

-- Nenhum INSERT/UPDATE/DELETE direto: recebimentos são imutáveis e entram pela RPC.
CREATE OR REPLACE FUNCTION public.confirm_service_order_payment(
  _order_id uuid,
  _amount numeric,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF _order_id IS NULL OR _amount IS NULL OR _amount <= 0
     OR _amount <> round(_amount, 2) THEN
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

  v_total := round(coalesce(v_order.parts_value, 0) + coalesce(v_order.labor_value, 0), 2);
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
  ) VALUES (
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
$$;

REVOKE ALL ON FUNCTION public.confirm_service_order_payment(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_service_order_payment(uuid, numeric, text) TO authenticated;

-- Histórico da OS: disponível à secretaria na própria tela da ordem e ao administrador.
CREATE OR REPLACE FUNCTION public.get_service_order_payment_history(_order_id uuid)
RETURNS TABLE (
  payment_id uuid,
  amount numeric,
  note text,
  confirmed_at timestamptz,
  confirmed_by uuid,
  confirmed_by_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_orders WHERE id = _order_id) THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  RETURN QUERY
  SELECT p.id, p.amount, p.note, p.confirmed_at, p.confirmed_by,
    coalesce(
      nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'name'), ''),
      u.email
    )::text
  FROM public.service_order_payments p
  JOIN auth.users u ON u.id = p.confirmed_by
  WHERE p.service_order_id = _order_id
  ORDER BY p.confirmed_at DESC, p.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_service_order_payment_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_order_payment_history(uuid) TO authenticated;

-- Visão consolidada: somente administrador. Cada linha representa uma OS com
-- orçamento ou recebimentos; os totais são derivados dos pagamentos confirmados.
CREATE OR REPLACE FUNCTION public.admin_get_financial_overview()
RETURNS TABLE (
  service_order_id uuid,
  order_number integer,
  customer_name text,
  plate text,
  order_status text,
  total numeric,
  received numeric,
  balance numeric,
  paid_percent numeric,
  last_payment_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2)::numeric,
    coalesce(pay.received, 0)::numeric,
    greatest(round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2) - coalesce(pay.received, 0), 0)::numeric,
    CASE
      WHEN round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2) > 0
      THEN round((coalesce(pay.received, 0) / round(coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0), 2)) * 100, 2)
      ELSE 0
    END::numeric,
    pay.last_payment_at
  FROM public.service_orders so
  LEFT JOIN LATERAL (
    SELECT sum(p.amount)::numeric(12,2) AS received, max(p.confirmed_at) AS last_payment_at
    FROM public.service_order_payments p
    WHERE p.service_order_id = so.id
  ) pay ON true
  WHERE so.status <> 'cancelado'::public.order_status
    AND (coalesce(so.parts_value, 0) + coalesce(so.labor_value, 0) > 0 OR coalesce(pay.received, 0) > 0)
  ORDER BY so.number DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_financial_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_financial_overview() TO authenticated;
