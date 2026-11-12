-- Histórico imutável das mudanças de status da ordem de serviço.
-- Captura criação e transições feitas pela aplicação, inclusive alterações diretas
-- na tabela, sem depender de uma tela específica.
CREATE TABLE IF NOT EXISTS public.service_order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  previous_status public.order_status,
  new_status public.order_status NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'status_changed')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS service_order_status_events_order_time_idx
  ON public.service_order_status_events(service_order_id, changed_at DESC);

ALTER TABLE public.service_order_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_order_status_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.service_order_status_events TO authenticated;

DROP POLICY IF EXISTS service_order_status_events_management_read
  ON public.service_order_status_events;
CREATE POLICY service_order_status_events_management_read
  ON public.service_order_status_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.capture_service_order_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.service_order_status_events (
      service_order_id, previous_status, new_status, event_type, changed_at, changed_by
    ) VALUES (
      NEW.id, NULL, NEW.status, 'created', now(), auth.uid()
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.service_order_status_events (
      service_order_id, previous_status, new_status, event_type, changed_at, changed_by
    ) VALUES (
      NEW.id, OLD.status, NEW.status, 'status_changed', now(), auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_capture_status_event ON public.service_orders;
CREATE TRIGGER service_orders_capture_status_event
AFTER INSERT OR UPDATE OF status ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.capture_service_order_status_event();

REVOKE ALL ON FUNCTION public.capture_service_order_status_event()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.service_order_status_events IS
  'Trilha imutável de criação e transições de status das OS. Eventos históricos anteriores à instalação da migration não são reconstruídos.';
