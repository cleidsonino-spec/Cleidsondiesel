-- Chaves idempotentes dos lançamentos financeiros.
-- A interface mantém a mesma chave em retries após falhas de rede, evitando
-- duplicar pagamentos ou despesas quando o primeiro INSERT já foi confirmado.
ALTER TABLE public.service_order_payments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.shop_expenses
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Preserva registros anteriores sem inventar uma relação com operações novas.
UPDATE public.service_order_payments
   SET idempotency_key = gen_random_uuid()::text
 WHERE idempotency_key IS NULL;

UPDATE public.shop_expenses
   SET idempotency_key = gen_random_uuid()::text
 WHERE idempotency_key IS NULL;

ALTER TABLE public.service_order_payments
  ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE public.shop_expenses
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS service_order_payments_idempotency_key_uidx
  ON public.service_order_payments(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS shop_expenses_idempotency_key_uidx
  ON public.shop_expenses(idempotency_key);

COMMENT ON COLUMN public.service_order_payments.idempotency_key IS
  'Chave única por tentativa lógica de recebimento, para retries seguros.';
COMMENT ON COLUMN public.shop_expenses.idempotency_key IS
  'Chave única por tentativa lógica de despesa, para retries seguros.';
