ALTER TABLE public.warranty_returns
  ADD COLUMN IF NOT EXISTS customer_update text NOT NULL DEFAULT '';

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
  return_data jsonb := '[]'::jsonb;
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
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'status', wr.status,
      'received_at', wr.received_at,
      'closed_at', wr.closed_at,
      'customer_update', wr.customer_update
    ) ORDER BY wr.received_at DESC), '[]'::jsonb)
    INTO return_data
    FROM public.warranty_returns wr
    WHERE wr.warranty_id = w.id;
  END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'number', o.number, 'status', o.status, 'vehicle', o.vehicle,
      'plate', o.plate, 'complaint', o.complaint,
      'entry_date', o.entry_date, 'due_date', o.due_date, 'updated_at', o.updated_at
    ),
    'quote', quote_data,
    'warranty', warranty_data,
    'warranty_returns', return_data,
    'expires_at', a.expires_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_customer_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_portal(text) TO anon, authenticated;
