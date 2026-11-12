-- Consolida as chaves idempotentes financeiras como UUID.
-- A migration 20261113150000 já criou essas colunas como UUID; manter o mesmo
-- tipo evita incompatibilidade ao aplicar toda a sequência em instalações novas.
ALTER TABLE public.service_order_payments
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE public.shop_expenses
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

UPDATE public.service_order_payments
   SET idempotency_key = gen_random_uuid()
 WHERE idempotency_key IS NULL;

UPDATE public.shop_expenses
   SET idempotency_key = gen_random_uuid()
 WHERE idempotency_key IS NULL;

ALTER TABLE public.service_order_payments
  ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE public.shop_expenses
  ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS service_order_payments_idempotency_key_uidx
  ON public.service_order_payments(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS shop_expenses_idempotency_key_uidx
  ON public.shop_expenses(idempotency_key);

COMMENT ON COLUMN public.service_order_payments.idempotency_key IS
  'UUID único por tentativa lógica de recebimento, para retries seguros.';

COMMENT ON COLUMN public.shop_expenses.idempotency_key IS
  'UUID único por tentativa lógica de despesa, para retries seguros.';
