-- Registra a primeira entrega efetiva da OS. O valor não é apagado se o status mudar depois.
ALTER TABLE public.service_orders
  ADD COLUMN delivered_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_service_order_delivered_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregue'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_order_delivered_at
BEFORE INSERT OR UPDATE OF status ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_service_order_delivered_at();
