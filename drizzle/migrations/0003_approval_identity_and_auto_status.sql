ALTER TABLE public.quote_approvals ADD COLUMN approved_cpf text;
CREATE FUNCTION public.valid_cpf(_cpf text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE d text; s int; c int; i int;
BEGIN
 IF _cpf IS NULL OR _cpf !~ '^[0-9. -]+$' THEN RETURN false; END IF;
 d := regexp_replace(_cpf,'[^0-9]','','g');
 IF length(d)<>11 OR d=repeat(substr(d,1,1),11) THEN RETURN false; END IF;
 s:=0; FOR i IN 1..9 LOOP s:=s+substr(d,i,1)::int*(11-i); END LOOP;
 c:=(s*10)%11; IF c=10 THEN c:=0; END IF;
 IF c<>substr(d,10,1)::int THEN RETURN false; END IF;
 s:=0; FOR i IN 1..10 LOOP s:=s+substr(d,i,1)::int*(12-i); END LOOP;
 c:=(s*10)%11; IF c=10 THEN c:=0; END IF;
 RETURN c=substr(d,11,1)::int;
END $$;
REVOKE ALL ON FUNCTION public.valid_cpf(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_cpf(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.approve_quote(_token text,_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'CPF required; refresh the approval page'; END $$;
COMMENT ON FUNCTION public.approve_quote(text,text) IS 'DEPRECATED: use approve_quote_identified with validated CPF';
CREATE FUNCTION public.approve_quote_identified(_token text,_name text,_cpf text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.quote_approvals; o public.service_orders; oid uuid; n text;
BEGIN
 n:=regexp_replace(trim(_name),'\s+',' ','g');
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' OR n IS NULL OR length(n)>120 OR n !~ '^[[:alpha:]][[:alpha:]''-]+([ ][[:alpha:]][[:alpha:]''-]+)+$' OR NOT public.valid_cpf(_cpf) THEN RAISE EXCEPTION 'Invalid name or CPF'; END IF;
 SELECT order_id INTO oid FROM public.quote_approvals WHERE token=_token;
 IF oid IS NULL THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=oid FOR UPDATE;
 SELECT * INTO q FROM public.quote_approvals WHERE token=_token FOR UPDATE;
 IF q.state='revoked' OR q.expires_at<=now() OR o.status IN ('cancelado','entregue','pronto') OR q.snapshot IS DISTINCT FROM public.quote_snapshot(o) THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF q.state='pending' THEN
  UPDATE public.quote_approvals SET state='approved',approved_at=now(),approved_by=n,approved_cpf=regexp_replace(_cpf,'[^0-9]','','g') WHERE id=q.id RETURNING * INTO q;
  UPDATE public.service_orders SET status='em_servico' WHERE id=oid;
 END IF;
 RETURN jsonb_build_object('approved_at',q.approved_at,'approved_by',q.approved_by);
END $$;
REVOKE ALL ON FUNCTION public.approve_quote_identified(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_quote_identified(text,text,text) TO anon,authenticated;