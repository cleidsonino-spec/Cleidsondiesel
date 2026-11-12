-- Bloqueia edição de valores da OS que deixaria os recebimentos acima do total devido.
CREATE OR REPLACE FUNCTION public.prevent_order_total_below_received()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  received_total numeric(12,2);
  new_total numeric(12,2);
BEGIN
  IF NEW.parts_value IS NOT DISTINCT FROM OLD.parts_value
     AND NEW.labor_value IS NOT DISTINCT FROM OLD.labor_value THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(sum(amount),0)
    INTO received_total
    FROM public.service_order_payments
   WHERE service_order_id = OLD.id;

  new_total := coalesce(NEW.parts_value,0) + coalesce(NEW.labor_value,0);
  IF new_total < received_total THEN
    RAISE EXCEPTION 'O novo total da OS (%) não pode ficar abaixo dos recebimentos já registrados (%)',
      new_total, received_total;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_order_total_received_guard ON public.service_orders;
CREATE TRIGGER service_order_total_received_guard
  BEFORE UPDATE OF parts_value, labor_value ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_order_total_below_received();

-- A autoria é sempre definida pela sessão autenticada, nunca pelo payload do navegador.
CREATE OR REPLACE FUNCTION public.validate_service_order_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parts numeric(12,2);
  v_labor numeric(12,2);
  v_received numeric(12,2);
  v_total numeric(12,2);
BEGIN
  SELECT parts_value, labor_value
    INTO v_parts, v_labor
    FROM public.service_orders
   WHERE id = NEW.service_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.service_orders
     WHERE id = NEW.service_order_id AND status = 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Não é possível registrar pagamento em uma OS cancelada';
  END IF;

  v_total := coalesce(v_parts,0) + coalesce(v_labor,0);
  SELECT coalesce(sum(amount),0)
    INTO v_received
    FROM public.service_order_payments
   WHERE service_order_id = NEW.service_order_id;

  IF v_received + NEW.amount > v_total THEN
    RAISE EXCEPTION 'O recebimento ultrapassa o saldo da ordem de serviço';
  END IF;

  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_shop_expense_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_expense_actor_guard ON public.shop_expenses;
CREATE TRIGGER shop_expense_actor_guard
  BEFORE INSERT ON public.shop_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_shop_expense_actor();

DROP POLICY IF EXISTS service_order_payments_admin_insert ON public.service_order_payments;
CREATE POLICY service_order_payments_admin_insert
  ON public.service_order_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS shop_expenses_admin_insert ON public.shop_expenses;
CREATE POLICY shop_expenses_admin_insert
  ON public.shop_expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND created_by = auth.uid()
  );

REVOKE ALL ON FUNCTION public.prevent_order_total_below_received() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_shop_expense_actor() FROM PUBLIC, anon, authenticated;
