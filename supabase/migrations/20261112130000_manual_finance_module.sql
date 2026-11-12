-- Financeiro manual da oficina: recebimentos vinculados à OS e despesas avulsas.
-- Orçamento aprovado não representa pagamento; somente lançamentos nesta tabela contam como recebido.

CREATE TABLE IF NOT EXISTS public.service_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_order_payments_order_idx
  ON public.service_order_payments(service_order_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS service_order_payments_paid_at_idx
  ON public.service_order_payments(paid_at DESC);

ALTER TABLE public.service_order_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_order_payments FROM anon, authenticated;
GRANT SELECT, INSERT ON public.service_order_payments TO authenticated;
GRANT ALL ON public.service_order_payments TO service_role;

DROP POLICY IF EXISTS service_order_payments_admin_read ON public.service_order_payments;
CREATE POLICY service_order_payments_admin_read
  ON public.service_order_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS service_order_payments_admin_insert ON public.service_order_payments;
CREATE POLICY service_order_payments_admin_insert
  ON public.service_order_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- Impede recebimento acima do total da OS, inclusive em lançamentos simultâneos.
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

  v_total := COALESCE(v_parts, 0) + COALESCE(v_labor, 0);
  SELECT COALESCE(sum(amount), 0)
    INTO v_received
    FROM public.service_order_payments
   WHERE service_order_id = NEW.service_order_id;

  IF v_received + NEW.amount > v_total THEN
    RAISE EXCEPTION 'O recebimento ultrapassa o saldo da ordem de serviço';
  END IF;

  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_order_payment_validate ON public.service_order_payments;
CREATE TRIGGER service_order_payment_validate
  BEFORE INSERT ON public.service_order_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_service_order_payment();

-- Lançamentos de despesas manuais. Compras de estoque só serão integradas nesta
-- tabela quando o módulo de estoque estiver pronto, para evitar dupla contagem.
CREATE TABLE IF NOT EXISTS public.shop_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 2 AND 180),
  category text NOT NULL CHECK (char_length(trim(category)) BETWEEN 2 AND 80),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL DEFAULT current_date,
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  supplier_name text CHECK (supplier_name IS NULL OR char_length(supplier_name) <= 160),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_expenses_date_idx
  ON public.shop_expenses(expense_date DESC);

ALTER TABLE public.shop_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_expenses FROM anon, authenticated;
GRANT SELECT, INSERT ON public.shop_expenses TO authenticated;
GRANT ALL ON public.shop_expenses TO service_role;

DROP POLICY IF EXISTS shop_expenses_admin_read ON public.shop_expenses;
CREATE POLICY shop_expenses_admin_read
  ON public.shop_expenses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS shop_expenses_admin_insert ON public.shop_expenses;
CREATE POLICY shop_expenses_admin_insert
  ON public.shop_expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

COMMENT ON TABLE public.service_order_payments IS
  'Recebimentos manuais efetivamente realizados e vinculados a uma ordem de serviço. Registros são imutáveis para preservar auditoria.';
COMMENT ON TABLE public.shop_expenses IS
  'Despesas manuais da oficina. Não incluir automaticamente compras de estoque até integração explícita do módulo de estoque.';
