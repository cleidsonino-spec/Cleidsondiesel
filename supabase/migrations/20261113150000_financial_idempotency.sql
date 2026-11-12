-- Idempotência dos lançamentos financeiros para permitir retry seguro após falhas de rede.
ALTER TABLE public.service_order_payments
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;
UPDATE public.service_order_payments
   SET idempotency_key = gen_random_uuid()
 WHERE idempotency_key IS NULL;
ALTER TABLE public.service_order_payments
  ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN idempotency_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS service_order_payments_idempotency_key_uidx
  ON public.service_order_payments(idempotency_key);

ALTER TABLE public.shop_expenses
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;
UPDATE public.shop_expenses
   SET idempotency_key = gen_random_uuid()
 WHERE idempotency_key IS NULL;
ALTER TABLE public.shop_expenses
  ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN idempotency_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shop_expenses_idempotency_key_uidx
  ON public.shop_expenses(idempotency_key);
