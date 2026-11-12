-- Registra tanto a atribuição quanto o encerramento/troca do mecânico.
-- A ação é atribuída ao usuário que fez a mudança, e não ao mecânico designado.
ALTER TABLE public.service_order_status_events
  DROP CONSTRAINT IF EXISTS service_order_status_events_event_type_check;

ALTER TABLE public.service_order_status_events
  ADD CONSTRAINT service_order_status_events_event_type_check
  CHECK (event_type IN (
    'created',
    'status_changed',
    'vehicle_received',
    'diagnosis_logged',
    'technical_progress',
    'quote_issued',
    'quote_approved',
    'quote_revoked',
    'mechanic_assigned',
    'mechanic_unassigned',
    'service_completed',
    'customer_authorization',
    'delivery_confirmation'
  ));

CREATE OR REPLACE FUNCTION public.capture_service_order_assignment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.order_status;
  v_event_type text;
  v_event_label text;
  v_actor uuid;
  v_details jsonb;
BEGIN
  SELECT status INTO v_status
  FROM public.service_orders
  WHERE id = NEW.service_order_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'mechanic_assigned';
    v_event_label := 'Mecânico atribuído à ordem';
    v_actor := COALESCE(NEW.assigned_by, auth.uid());
    v_details := jsonb_build_object(
      'mechanic_user_id', NEW.mechanic_user_id,
      'assignment_id', NEW.id,
      'assigned_at', NEW.assigned_at,
      'active', NEW.active
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.active IS DISTINCT FROM NEW.active
    AND NEW.active = false THEN
    v_event_type := 'mechanic_unassigned';
    v_event_label := 'Atribuição do mecânico encerrada ou substituída';
    v_actor := auth.uid();
    v_details := jsonb_build_object(
      'mechanic_user_id', NEW.mechanic_user_id,
      'assignment_id', NEW.id,
      'assigned_at', NEW.assigned_at,
      'ended_at', now(),
      'active', false
    );
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.service_order_status_events (
    service_order_id,
    previous_status,
    new_status,
    event_type,
    changed_at,
    changed_by,
    event_label,
    details
  ) VALUES (
    NEW.service_order_id,
    NULL,
    v_status,
    v_event_type,
    now(),
    v_actor,
    v_event_label,
    v_details
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_order_assignments_timeline_event
  ON public.service_order_assignments;

CREATE TRIGGER service_order_assignments_timeline_insert_event
AFTER INSERT ON public.service_order_assignments
FOR EACH ROW
EXECUTE FUNCTION public.capture_service_order_assignment_event();

CREATE TRIGGER service_order_assignments_timeline_end_event
AFTER UPDATE OF active ON public.service_order_assignments
FOR EACH ROW
WHEN (OLD.active IS DISTINCT FROM NEW.active AND NEW.active = false)
EXECUTE FUNCTION public.capture_service_order_assignment_event();

REVOKE ALL ON FUNCTION public.capture_service_order_assignment_event()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.capture_service_order_assignment_event() IS
  'Registra atribuição e encerramento/troca de mecânico com a identidade do usuário que executou a ação.';
