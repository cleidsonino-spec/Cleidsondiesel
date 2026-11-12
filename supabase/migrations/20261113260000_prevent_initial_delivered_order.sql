-- Impede que uma OS seja criada diretamente como entregue, contornando
-- as etapas de recebimento, diagnóstico, serviço e confirmação de retirada.
CREATE OR REPLACE FUNCTION public.prevent_initial_delivered_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregue'::public.order_status THEN
    RAISE EXCEPTION 'Uma nova OS não pode ser criada como entregue';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_prevent_initial_delivery
  ON public.service_orders;

CREATE TRIGGER service_orders_prevent_initial_delivery
BEFORE INSERT ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_initial_delivered_order();

REVOKE ALL ON FUNCTION public.prevent_initial_delivered_order()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.prevent_initial_delivered_order() IS
  'Impede criação de OS diretamente no estado entregue, preservando a sequência operacional.';
