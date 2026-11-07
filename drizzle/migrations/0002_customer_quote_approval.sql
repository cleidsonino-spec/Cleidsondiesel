CREATE TABLE public.quote_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
 snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
 approved_at timestamptz,
 approved_by text
);
GRANT SELECT ON public.quote_approvals TO authenticated;
GRANT ALL ON public.quote_approvals TO service_role;
ALTER TABLE public.quote_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_admin_read ON public.quote_approvals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX quote_approvals_order ON public.quote_approvals(order_id,created_at DESC);
CREATE FUNCTION public.quote_snapshot(o public.service_orders) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('number',o.number,'customer_name',o.customer_name,'plate',o.plate,'vehicle',o.vehicle,'complaint',o.complaint,'diagnosis',o.diagnosis,'parts',o.parts,'part_items',o.part_items,'parts_value',o.parts_value,'labor_value',o.labor_value,'due_date',o.due_date)
$$;
REVOKE ALL ON FUNCTION public.quote_snapshot(public.service_orders) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.issue_quote_approval(_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.service_orders; q public.quote_approvals;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.status IN ('cancelado','entregue','pronto') THEN RAISE EXCEPTION 'Order unavailable'; END IF;
 UPDATE public.quote_approvals SET state='revoked' WHERE order_id=o.id AND state IN ('pending','approved');
 INSERT INTO public.quote_approvals(order_id,snapshot) VALUES(o.id,public.quote_snapshot(o)) RETURNING * INTO q;
 RETURN jsonb_build_object('id',q.id,'token',q.token,'state',q.state,'expires_at',q.expires_at,'approved_at',q.approved_at,'approved_by',q.approved_by);
END $$;
REVOKE ALL ON FUNCTION public.issue_quote_approval(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_quote_approval(uuid) TO authenticated;
CREATE FUNCTION public.get_quote_approval(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.quote_approvals;
BEGIN
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO q FROM public.quote_approvals WHERE token=_token AND state<>'revoked' AND expires_at>now();
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('quote',q.snapshot,'state',q.state,'expires_at',q.expires_at,'approved_at',q.approved_at,'approved_by',q.approved_by);
END $$;
REVOKE ALL ON FUNCTION public.get_quote_approval(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quote_approval(text) TO anon,authenticated;
CREATE FUNCTION public.approve_quote(_token text,_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.quote_approvals; o public.service_orders; oid uuid;
BEGIN
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' OR length(trim(_name))<2 OR length(trim(_name))>120 THEN RAISE EXCEPTION 'Invalid approval'; END IF;
 SELECT order_id INTO oid FROM public.quote_approvals WHERE token=_token;
 IF oid IS NULL THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=oid FOR UPDATE;
 SELECT * INTO q FROM public.quote_approvals WHERE token=_token FOR UPDATE;
 IF q.state='revoked' OR q.expires_at<=now() OR o.status IN ('cancelado','entregue','pronto') OR q.snapshot IS DISTINCT FROM public.quote_snapshot(o) THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF q.state='pending' THEN
  UPDATE public.quote_approvals SET state='approved',approved_at=now(),approved_by=trim(_name) WHERE id=q.id RETURNING * INTO q;
 END IF;
 RETURN jsonb_build_object('approved_at',q.approved_at,'approved_by',q.approved_by);
END $$;
REVOKE ALL ON FUNCTION public.approve_quote(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_quote(text,text) TO anon,authenticated;
CREATE FUNCTION public.invalidate_changed_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.quote_snapshot(NEW) IS DISTINCT FROM public.quote_snapshot(OLD) OR NEW.status IN ('cancelado','entregue','pronto') THEN
  UPDATE public.quote_approvals SET state='revoked' WHERE order_id=NEW.id AND state IN ('pending','approved');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.invalidate_changed_quote() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invalidate_changed_quote AFTER UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.invalidate_changed_quote();