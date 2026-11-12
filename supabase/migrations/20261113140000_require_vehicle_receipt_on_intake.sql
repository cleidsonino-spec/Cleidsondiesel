-- Garante no banco que novas OS recebidas tenham os dados mínimos de entrada.
-- OS antigas não são alteradas nem obrigadas a preencher dados retroativamente.
CREATE OR REPLACE FUNCTION public.validate_vehicle_receipt_on_intake()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR (NEW.status = 'recebido' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF jsonb_typeof(coalesce(NEW.vehicle_receipt, '{}'::jsonb)) <> 'object'
       OR nullif(trim(coalesce(NEW.vehicle_receipt->>'received_at','')), '') IS NULL
       OR nullif(trim(coalesce(NEW.vehicle_receipt->>'received_by','')), '') IS NULL
       OR nullif(trim(coalesce(NEW.vehicle_receipt->>'odometer','')), '') IS NULL
       OR nullif(trim(coalesce(NEW.vehicle_receipt->>'fuel_level','')), '') IS NULL THEN
      RAISE EXCEPTION 'Para receber o veículo, informe data e hora, responsável, hodômetro/horímetro e nível de combustível';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_vehicle_receipt_required ON public.service_orders;
CREATE TRIGGER service_orders_vehicle_receipt_required
  BEFORE INSERT OR UPDATE OF status ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_receipt_on_intake();

REVOKE ALL ON FUNCTION public.validate_vehicle_receipt_on_intake() FROM PUBLIC, anon, authenticated;
