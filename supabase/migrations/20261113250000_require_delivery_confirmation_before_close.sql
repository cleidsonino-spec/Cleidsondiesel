-- Separa conclusão técnica ("pronto") da entrega física ("entregue").
-- A entrega só pode ocorrer após aceite de entrega registrado para a OS.
CREATE OR REPLACE FUNCTION public.enforce_vehicle_delivery_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'entregue'::public.order_status
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Uma OS entregue não pode voltar para outro status';
  END IF;

  IF NEW.status = 'entregue'::public.order_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status <> 'pronto'::public.order_status THEN
      RAISE EXCEPTION 'A OS precisa estar pronta para retirada antes da entrega';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customer_authorizations a
      WHERE a.service_order_id = OLD.id
        AND a.authorization_type = 'delivery_confirmation'
    ) THEN
      RAISE EXCEPTION 'Registre a confirmação de entrega antes de finalizar a OS';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_enforce_delivery_transition
  ON public.service_orders;

CREATE TRIGGER service_orders_enforce_delivery_transition
BEFORE UPDATE OF status ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_vehicle_delivery_transition();

REVOKE ALL ON FUNCTION public.enforce_vehicle_delivery_transition()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_vehicle_delivery_transition() IS
  'Exige OS pronta e confirmação de entrega registrada antes de alterar o status para entregue; impede reabrir OS entregue.';
