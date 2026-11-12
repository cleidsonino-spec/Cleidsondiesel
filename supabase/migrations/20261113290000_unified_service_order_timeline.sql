-- Amplia a linha do tempo da OS para eventos operacionais e administrativos.
ALTER TABLE public.service_order_status_events
  ADD COLUMN IF NOT EXISTS event_label text,
  ADD COLUMN IF NOT EXISTS actor_name text,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

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
    'service_completed',
    'customer_authorization',
    'delivery_confirmation'
  ));

CREATE OR REPLACE FUNCTION public.capture_service_order_related_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb := to_jsonb(NEW);
  old_data jsonb;
  v_order_id uuid;
  v_actor uuid;
  v_actor_name text;
  v_status public.order_status;
  v_type text;
  v_label text;
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
  END IF;

  v_order_id := COALESCE(
    NULLIF(row_data->>'service_order_id', '')::uuid,
    NULLIF(row_data->>'order_id', '')::uuid
  );
  IF v_order_id IS NULL THEN RETURN NEW; END IF;

  SELECT status INTO v_status
    FROM public.service_orders
   WHERE id = v_order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_actor := COALESCE(
    NULLIF(row_data->>'recorded_by', '')::uuid,
    NULLIF(row_data->>'received_by', '')::uuid,
    NULLIF(row_data->>'mechanic_user_id', '')::uuid,
    NULLIF(row_data->>'assigned_by', '')::uuid,
    auth.uid()
  );

  IF TG_TABLE_NAME = 'vehicle_intake_records' THEN
    v_type := 'vehicle_received';
    v_label := 'Veículo recebido na oficina';
    v_actor_name := NULLIF(row_data->>'received_by_name', '');
    v_details := jsonb_build_object(
      'delivered_by_name', row_data->>'delivered_by_name',
      'odometer', row_data->>'odometer',
      'fuel_level', row_data->>'fuel_level',
      'exterior_condition', row_data->>'exterior_condition'
    );
  ELSIF TG_TABLE_NAME = 'technical_service_logs' THEN
    IF lower(trim(COALESCE(row_data->>'procedure', ''))) IN ('diagnostico', 'diagnóstico') THEN
      v_type := 'diagnosis_logged';
      v_label := 'Diagnóstico técnico registrado';
    ELSE
      v_type := 'technical_progress';
      v_label := 'Andamento técnico registrado';
    END IF;
    v_actor_name := NULL;
    v_details := jsonb_build_object(
      'procedure', row_data->>'procedure',
      'description', row_data->>'description',
      'result', row_data->>'result',
      'observations', row_data->>'observations'
    );
  ELSIF TG_TABLE_NAME = 'customer_authorizations' THEN
    IF row_data->>'authorization_type' = 'delivery_confirmation' THEN
      v_type := 'delivery_confirmation';
      v_label := 'Confirmação de entrega registrada';
    ELSE
      v_type := 'customer_authorization';
      v_label := 'Autorização de execução registrada';
    END IF;
    v_actor_name := NULLIF(row_data->>'signer_name', '');
    v_details := jsonb_build_object(
      'authorization_type', row_data->>'authorization_type',
      'signature_method', row_data->>'signature_method',
      'consent_text', row_data->>'consent_text'
    );
  ELSIF TG_TABLE_NAME = 'service_order_assignments' THEN
    v_type := 'mechanic_assigned';
    v_label := 'Mecânico atribuído à ordem';
    v_details := jsonb_build_object(
      'mechanic_user_id', row_data->>'mechanic_user_id',
      'active', row_data->>'active'
    );
  ELSIF TG_TABLE_NAME = 'service_order_completions' THEN
    v_type := 'service_completed';
    v_label := 'Serviço concluído tecnicamente';
    v_actor := NULLIF(row_data->>'mechanic_user_id', '')::uuid;
    v_details := jsonb_build_object('completed_at', row_data->>'completed_at');
  ELSIF TG_TABLE_NAME = 'quote_approvals' THEN
    IF TG_OP = 'INSERT' THEN
      v_type := 'quote_issued';
      v_label := 'Orçamento emitido para aprovação';
    ELSIF row_data->>'state' IS DISTINCT FROM old_data->>'state' THEN
      IF row_data->>'state' = 'approved' THEN
        v_type := 'quote_approved';
        v_label := 'Orçamento aprovado pelo cliente';
        v_actor_name := NULLIF(row_data->>'approved_by', '');
      ELSIF row_data->>'state' = 'revoked' THEN
        v_type := 'quote_revoked';
        v_label := 'Link de aprovação do orçamento revogado';
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
    v_details := jsonb_build_object('state', row_data->>'state');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.service_order_status_events (
    service_order_id, previous_status, new_status, event_type,
    changed_at, changed_by, event_label, actor_name, details
  ) VALUES (
    v_order_id, NULL, v_status, v_type,
    now(), v_actor, v_label, v_actor_name, v_details
  );

  RETURN NEW;
END;
$$;

-- Eventos de recebimento, diagnóstico/andamento, autorizações e conclusão.
DROP TRIGGER IF EXISTS vehicle_intake_timeline_event ON public.vehicle_intake_records;
CREATE TRIGGER vehicle_intake_timeline_event
AFTER INSERT ON public.vehicle_intake_records
FOR EACH ROW EXECUTE FUNCTION public.capture_service_order_related_event();

DROP TRIGGER IF EXISTS technical_service_logs_timeline_event ON public.technical_service_logs;
CREATE TRIGGER technical_service_logs_timeline_event
AFTER INSERT ON public.technical_service_logs
FOR EACH ROW EXECUTE FUNCTION public.capture_service_order_related_event();

DROP TRIGGER IF EXISTS customer_authorizations_timeline_event ON public.customer_authorizations;
CREATE TRIGGER customer_authorizations_timeline_event
AFTER INSERT ON public.customer_authorizations
FOR EACH ROW EXECUTE FUNCTION public.capture_service_order_related_event();

DROP TRIGGER IF EXISTS service_order_assignments_timeline_event ON public.service_order_assignments;
CREATE TRIGGER service_order_assignments_timeline_event
AFTER INSERT ON public.service_order_assignments
FOR EACH ROW EXECUTE FUNCTION public.capture_service_order_related_event();

DROP TRIGGER IF EXISTS service_order_completions_timeline_event ON public.service_order_completions;
CREATE TRIGGER service_order_completions_timeline_event
AFTER INSERT ON public.service_order_completions
FOR EACH ROW EXECUTE FUNCTION public.capture_service_order_related_event();

DROP TRIGGER IF EXISTS quote_approvals_timeline_event ON public.quote_approvals;
CREATE TRIGGER quote_approvals_timeline_event
AFTER INSERT OR UPDATE OF state ON public.quote_approvals
FOR EACH ROW EXECUTE FUNCTION public.capture_service_order_related_event();

REVOKE ALL ON FUNCTION public.capture_service_order_related_event()
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.service_order_status_events.event_label IS
  'Descrição legível do evento operacional/administrativo da OS.';
COMMENT ON COLUMN public.service_order_status_events.details IS
  'Detalhes não secretos do evento. Tokens, hashes e CPF não são copiados para a linha do tempo.';
