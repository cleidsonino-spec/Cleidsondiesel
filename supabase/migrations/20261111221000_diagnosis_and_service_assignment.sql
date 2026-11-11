CREATE OR REPLACE FUNCTION public.approve_quote_identified(_token text, _name text, _cpf text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.quote_approvals; o public.service_orders; oid uuid; n text;
BEGIN
 n:=regexp_replace(trim(_name),'[[:space:]]+',' ','g');
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' OR n IS NULL OR length(n)>120 OR n !~ '^[[:alpha:]][[:alpha:]''-]+([ ][[:alpha:]][[:alpha:]''-]+)+$' OR NOT public.valid_cpf(_cpf) THEN RAISE EXCEPTION 'Invalid name or CPF'; END IF;
 SELECT order_id INTO oid FROM public.quote_approvals WHERE token=_token;
 IF oid IS NULL THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=oid FOR UPDATE;
 SELECT * INTO q FROM public.quote_approvals WHERE token=_token FOR UPDATE;
 IF q.state='revoked' OR q.expires_at<=now() OR o.status IN ('cancelado','entregue','pronto') OR q.snapshot IS DISTINCT FROM public.quote_snapshot(o) THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF q.state='pending' THEN
  UPDATE public.quote_approvals SET state='approved',approved_at=now(),approved_by=n,approved_cpf=regexp_replace(_cpf,'[^0-9]','','g') WHERE id=q.id RETURNING * INTO q;
  UPDATE public.service_orders SET status='aprovado_aguardando_encaminhamento' WHERE id=oid;
 END IF;
 RETURN jsonb_build_object('approved_at',q.approved_at,'approved_by',q.approved_by);
END $$;

CREATE OR REPLACE FUNCTION public.assign_order_to_mechanic(_order_id uuid,_mechanic_user_id uuid,_stage text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.service_orders;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria')) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
 IF NOT public.has_role(_mechanic_user_id,'mecanico') THEN RAISE EXCEPTION 'O usuário selecionado não é mecânico'; END IF;
 IF _stage='diagnostico' THEN
   IF o.status <> 'recebido' THEN RAISE EXCEPTION 'A OS precisa estar recebida para encaminhar o diagnóstico'; END IF;
 ELSIF _stage='servico' THEN
   IF o.status <> 'aprovado_aguardando_encaminhamento' OR NOT EXISTS (SELECT 1 FROM public.quote_approvals q WHERE q.order_id=_order_id AND q.state='approved') THEN
     RAISE EXCEPTION 'O orçamento precisa estar aprovado para encaminhar o serviço';
   END IF;
 ELSE RAISE EXCEPTION 'Etapa inválida'; END IF;
 UPDATE public.service_order_assignments SET active=false WHERE service_order_id=_order_id AND active=true;
 INSERT INTO public.service_order_assignments(service_order_id,mechanic_user_id,assigned_by,active)
 VALUES(_order_id,_mechanic_user_id,auth.uid(),true);
 IF _stage='servico' THEN UPDATE public.service_orders SET status='em_servico' WHERE id=_order_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assign_order_to_mechanic(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_order_to_mechanic(uuid,uuid,text) TO authenticated;

DROP POLICY IF EXISTS staff_invitations_read_secretaria ON public.staff_invitations;
CREATE POLICY staff_invitations_read_secretaria ON public.staff_invitations FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'secretaria'));