-- Portal de acompanhamento com token aleatório, hash no banco e escopo de uma única OS.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.client_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_portal_access_order_idx
  ON public.client_portal_access(service_order_id, created_at DESC);

ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_portal_access FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_client_portal_link(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  raw_token text;
  access_row public.client_portal_access;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaria')) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  PERFORM 1 FROM public.service_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;

  UPDATE public.client_portal_access
     SET revoked_at = now()
   WHERE service_order_id = _order_id AND revoked_at IS NULL;

  raw_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.client_portal_access(service_order_id, token_hash, expires_at, created_by)
  VALUES (_order_id, encode(digest(raw_token, 'sha256'), 'hex'), now() + interval '30 days', auth.uid())
  RETURNING * INTO access_row;

  RETURN jsonb_build_object(
    'token', raw_token,
    'expires_at', access_row.expires_at,
    'created_at', access_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_client_portal_link(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaria')) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  UPDATE public.client_portal_access
     SET revoked_at = now()
   WHERE service_order_id = _order_id AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_client_portal(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  access_row public.client_portal_access;
  order_row public.service_orders;
  warranty_row public.warranties;
  show_diagnosis boolean;
BEGIN
  IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;

  SELECT * INTO access_row
    FROM public.client_portal_access
   WHERE token_hash = encode(digest(_token, 'sha256'), 'hex')
     AND revoked_at IS NULL
     AND expires_at > now();

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO order_row
    FROM public.service_orders
   WHERE id = access_row.service_order_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO warranty_row
    FROM public.warranties
   WHERE service_order_id = order_row.id;

  show_diagnosis := order_row.status IN (
    'aguardando_aprovacao', 'aprovado_aguardando_encaminhamento',
    'em_servico', 'pronto', 'entregue'
  );

  RETURN jsonb_build_object(
    'number', order_row.number,
    'customer_name', order_row.customer_name,
    'vehicle', order_row.vehicle,
    'vehicle_year', order_row.vehicle_year,
    'plate', order_row.plate,
    'complaint', order_row.complaint,
    'diagnosis', CASE WHEN show_diagnosis THEN order_row.diagnosis ELSE NULL END,
    'status', order_row.status,
    'entry_date', order_row.entry_date,
    'due_date', order_row.due_date,
    'updated_at', order_row.updated_at,
    'warranty', CASE WHEN warranty_row.id IS NULL THEN NULL ELSE jsonb_build_object(
      'start_date', warranty_row.start_date,
      'end_date', warranty_row.end_date,
      'coverage', warranty_row.coverage,
      'terms', warranty_row.terms
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_client_portal_link(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_client_portal_link(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_client_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_client_portal_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_client_portal_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_portal(text) TO anon, authenticated;
