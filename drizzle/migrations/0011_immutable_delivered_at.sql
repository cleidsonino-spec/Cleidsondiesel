-- Impede que clientes ou atualizações posteriores falsifiquem a data efetiva de entrega.
-- A data é definida pelo banco na transição real para "entregue" e fica imutável.
CREATE OR REPLACE FUNCTION public.set_service_order_delivered_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'entregue' THEN
      NEW.delivered_at := now();
    ELSE
      NEW.delivered_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Depois de registrada, a primeira entrega nunca pode ser alterada ou apagada.
  IF OLD.delivered_at IS NOT NULL THEN
    NEW.delivered_at := OLD.delivered_at;
    RETURN NEW;
  END IF;

  -- Só o banco registra a data quando o status realmente muda para entregue.
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'entregue' THEN
    NEW.delivered_at := now();
  ELSE
    -- Não permite preencher manualmente o campo antes da transição.
    NEW.delivered_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_order_delivered_at ON public.service_orders;

CREATE TRIGGER service_order_delivered_at
BEFORE INSERT OR UPDATE ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_service_order_delivered_at();
