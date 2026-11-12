-- Retornos em garantia vinculados à garantia e à OS original.
-- Registros e alterações são auditados; não há exclusão física de garantias ou retornos.

CREATE TABLE IF NOT EXISTS public.warranty_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  before_data jsonb,
  after_data jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS warranty_change_events_warranty_idx
  ON public.warranty_change_events(warranty_id, occurred_at DESC);

ALTER TABLE public.warranty_change_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.warranty_change_events FROM anon, authenticated;
GRANT SELECT ON public.warranty_change_events TO authenticated;
GRANT ALL ON public.warranty_change_events TO service_role;

DROP POLICY IF EXISTS warranty_change_events_staff_read ON public.warranty_change_events;
CREATE POLICY warranty_change_events_staff_read ON public.warranty_change_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.capture_warranty_change_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Garantias emitidas não podem ser excluídas. Preserve o histórico.';
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.warranty_change_events(warranty_id, event_type, actor_id, after_data)
    VALUES (NEW.id, 'created', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.warranty_change_events(warranty_id, event_type, actor_id, before_data, after_data)
    VALUES (NEW.id, 'updated', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS warranties_capture_change_event ON public.warranties;
CREATE TRIGGER warranties_capture_change_event
  AFTER INSERT OR UPDATE OR DELETE ON public.warranties
  FOR EACH ROW EXECUTE FUNCTION public.capture_warranty_change_event();

CREATE TABLE IF NOT EXISTS public.warranty_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id uuid NOT NULL REFERENCES public.warranties(id) ON DELETE RESTRICT,
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'in_review', 'resolved', 'not_covered')),
  complaint text NOT NULL CHECK (char_length(trim(complaint)) BETWEEN 5 AND 5000),
  diagnosis text NOT NULL DEFAULT '',
  resolution text NOT NULL DEFAULT '',
  parts_used text NOT NULL DEFAULT '',
  labor_description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT warranty_returns_closed_state_check CHECK (
    (status IN ('resolved', 'not_covered') AND closed_at IS NOT NULL)
    OR (status IN ('received', 'in_review') AND closed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS warranty_returns_warranty_idx
  ON public.warranty_returns(warranty_id, received_at DESC);
CREATE INDEX IF NOT EXISTS warranty_returns_order_idx
  ON public.warranty_returns(service_order_id, received_at DESC);

ALTER TABLE public.warranty_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.warranty_returns FROM anon, authenticated;
GRANT SELECT ON public.warranty_returns TO authenticated;
GRANT ALL ON public.warranty_returns TO service_role;

DROP POLICY IF EXISTS warranty_returns_staff_read ON public.warranty_returns;
CREATE POLICY warranty_returns_staff_read ON public.warranty_returns
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE TABLE IF NOT EXISTS public.warranty_return_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_return_id uuid NOT NULL REFERENCES public.warranty_returns(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  before_data jsonb,
  after_data jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS warranty_return_events_return_idx
  ON public.warranty_return_events(warranty_return_id, occurred_at DESC);

ALTER TABLE public.warranty_return_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.warranty_return_events FROM anon, authenticated;
GRANT SELECT ON public.warranty_return_events TO authenticated;
GRANT ALL ON public.warranty_return_events TO service_role;

DROP POLICY IF EXISTS warranty_return_events_staff_read ON public.warranty_return_events;
CREATE POLICY warranty_return_events_staff_read ON public.warranty_return_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.capture_warranty_return_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.warranty_return_events(warranty_return_id, event_type, actor_id, after_data)
    VALUES (NEW.id, 'created', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  INSERT INTO public.warranty_return_events(warranty_return_id, event_type, actor_id, before_data, after_data)
  VALUES (NEW.id, 'updated', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS warranty_returns_capture_event ON public.warranty_returns;
CREATE TRIGGER warranty_returns_capture_event
  AFTER INSERT OR UPDATE ON public.warranty_returns
  FOR EACH ROW EXECUTE FUNCTION public.capture_warranty_return_event();

CREATE OR REPLACE FUNCTION public.register_warranty_return(
  _warranty_id uuid,
  _complaint text,
  _return_id uuid DEFAULT NULL,
  _status text DEFAULT 'received',
  _diagnosis text DEFAULT '',
  _resolution text DEFAULT '',
  _parts_used text DEFAULT '',
  _labor_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warranty public.warranties;
  v_return public.warranty_returns;
  v_id uuid;
  v_complaint text;
  v_diagnosis text;
  v_resolution text;
  v_parts text;
  v_labor text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  v_complaint := regexp_replace(trim(coalesce(_complaint, '')), '[[:space:]]+', ' ', 'g');
  v_diagnosis := trim(coalesce(_diagnosis, ''));
  v_resolution := trim(coalesce(_resolution, ''));
  v_parts := trim(coalesce(_parts_used, ''));
  v_labor := trim(coalesce(_labor_description, ''));\n  v_customer_update := trim(coalesce(_customer_update, ''));

  IF char_length(v_complaint) < 5 OR char_length(v_complaint) > 5000 THEN
    RAISE EXCEPTION 'Descreva o motivo do retorno (5 a 5000 caracteres)';
  END IF;
  IF _status NOT IN ('received', 'in_review', 'resolved', 'not_covered') THEN
    RAISE EXCEPTION 'Situação do retorno inválida';
  END IF;
  IF _status IN ('resolved', 'not_covered') AND char_length(v_resolution) < 3 THEN
    RAISE EXCEPTION 'Informe a solução ou justificativa antes de encerrar o retorno';
  END IF;

  SELECT * INTO v_warranty
  FROM public.warranties
  WHERE id = _warranty_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garantia original não encontrada'; END IF;

  IF _return_id IS NULL THEN
    IF _status NOT IN ('received', 'in_review') THEN
      RAISE EXCEPTION 'Um retorno novo deve iniciar como recebido ou em análise';
    END IF;
    INSERT INTO public.warranty_returns(
      warranty_id, service_order_id, status, complaint, diagnosis, resolution,
      parts_used, labor_description, created_by, updated_by
    ) VALUES (
      v_warranty.id, v_warranty.service_order_id, _status, v_complaint, v_diagnosis,
      v_resolution, v_parts, v_labor, auth.uid(), auth.uid()
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT * INTO v_return
  FROM public.warranty_returns
  WHERE id = _return_id AND warranty_id = _warranty_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retorno não encontrado para esta garantia'; END IF;
  IF v_return.status IN ('resolved', 'not_covered') THEN
    RAISE EXCEPTION 'Retorno encerrado não pode ser alterado; registre um novo retorno se necessário';
  END IF;
  IF v_return.status = 'received' AND _status NOT IN ('received', 'in_review') THEN
    RAISE EXCEPTION 'O retorno precisa passar por análise antes do encerramento';
  END IF;
  IF v_return.status = 'in_review' AND _status NOT IN ('in_review', 'resolved', 'not_covered') THEN
    RAISE EXCEPTION 'Não é permitido reabrir ou retroceder um retorno em análise';
  END IF;

  UPDATE public.warranty_returns
  SET status = _status,
      complaint = v_complaint,
      diagnosis = v_diagnosis,
      resolution = v_resolution,
      parts_used = v_parts,
      labor_description = v_labor,
      updated_by = auth.uid(),
      updated_at = now(),
      closed_at = CASE WHEN _status IN ('resolved', 'not_covered') THEN now() ELSE NULL END
  WHERE id = _return_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_warranty_return(uuid, text, uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_warranty_return(uuid, text, uuid, text, text, text, text, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.guard_warranty_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.service_order_id IS DISTINCT FROM OLD.service_order_id
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'A garantia não pode ser transferida para outra OS nem ter sua data de início ou autoria alteradas';
  END IF;
  IF NEW.duration_months < 1 OR NEW.duration_months > 120 OR NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Prazo ou vencimento da garantia inválido';
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS warranties_guard_identity ON public.warranties;
CREATE TRIGGER warranties_guard_identity
  BEFORE INSERT OR UPDATE ON public.warranties
  FOR EACH ROW EXECUTE FUNCTION public.guard_warranty_identity();

REVOKE ALL ON FUNCTION public.capture_warranty_change_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_warranty_return_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_warranty_identity() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.warranty_returns IS
  'Retornos em garantia vinculados à garantia e à OS original. Alterações auditadas; encerramentos são imutáveis.';
