-- Impede que uma OS nova desative a exigência de recebimento para avançar no fluxo.
-- OS antigas que já possuem intake_required = false continuam preservadas.
CREATE OR REPLACE FUNCTION public.prevent_disabling_required_vehicle_intake()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.intake_required IS TRUE AND NEW.intake_required IS FALSE THEN
    RAISE EXCEPTION 'A exigência de recebimento não pode ser removida desta ordem de serviço';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_keep_intake_required ON public.service_orders;
CREATE TRIGGER service_orders_keep_intake_required
BEFORE UPDATE OF intake_required ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_disabling_required_vehicle_intake();

COMMENT ON FUNCTION public.prevent_disabling_required_vehicle_intake() IS
  'Protege novas ordens de serviço contra a desativação da exigência de ficha de recebimento.';
