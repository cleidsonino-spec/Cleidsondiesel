-- Acompanhamento individual por token de alta entropia. A placa deixa de ser credencial pública.
CREATE TABLE IF NOT EXISTS public.customer_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS customer_portal_access_order_idx
  ON public.customer_portal_access(service_order_id, created_at DESC);
ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_portal_access FROM anon, authenticated;
GRANT SELECT ON public.customer_portal_access TO authenticated;
GRANT ALL ON public.customer_portal_access TO service_role;
DROP POLICY IF EXISTS customer_portal_access_staff_read ON public.customer_portal_access;
CREATE POLICY customer_portal_access_staff_read ON public.customer_portal_access
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.issue_customer_portal_access(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  o public.service_orders;
  a public.customer_portal_access;
  v_token text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  SELECT * INTO o FROM public.service_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ordem indisponível para acompanhamento';
  END IF;
  UPDATE public.customer_portal_access
    SET revoked_at = now()
    WHERE service_order_id = _order_id AND revoked_at IS NULL AND expires_at > now();
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.customer_portal_access(service_order_id, token_hash, created_by)
    VALUES (_order_id, encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), auth.uid())
    RETURNING * INTO a;
  RETURN jsonb_build_object('token', v_token, 'expires_at', a.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.issue_customer_portal_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_customer_portal_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_portal(_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  a public.customer_portal_access;
  o public.service_orders;
  q public.quote_approvals;
  w public.warranties;
  quote_data jsonb := NULL;
  warranty_data jsonb := NULL;
BEGIN
  IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.customer_portal_access
    WHERE token_hash = encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex')
      AND revoked_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO o FROM public.service_orders WHERE id = a.service_order_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO q FROM public.quote_approvals
    WHERE order_id = o.id AND state IN ('pending','approved') AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    quote_data := jsonb_build_object(
      'state', q.state, 'token', q.token, 'snapshot', q.snapshot,
      'expires_at', q.expires_at, 'approved_at', q.approved_at
    );
  END IF;

  SELECT * INTO w FROM public.warranties WHERE service_order_id = o.id LIMIT 1;
  IF FOUND THEN
    warranty_data := jsonb_build_object(
      'coverage', w.coverage, 'start_date', w.start_date,
      'end_date', w.end_date, 'terms', w.terms
    );
  END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'number', o.number, 'status', o.status, 'vehicle', o.vehicle,
      'plate', o.plate, 'complaint', o.complaint, 'diagnosis', o.diagnosis,
      'entry_date', o.entry_date, 'due_date', o.due_date, 'updated_at', o.updated_at
    ),
    'quote', quote_data,
    'warranty', warranty_data,
    'expires_at', a.expires_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_customer_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_portal(text) TO anon, authenticated;

-- Placa não é segredo: desativa os antigos endpoints públicos que retornavam OS por placa.
REVOKE ALL ON FUNCTION public.lookup_plate(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lookup_vehicle(text) FROM PUBLIC, anon, authenticated;
