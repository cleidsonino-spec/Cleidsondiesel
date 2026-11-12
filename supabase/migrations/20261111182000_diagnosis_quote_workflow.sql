-- Fluxo controlado: recebida -> diagnóstico -> orçamento/aprovação -> execução -> concluída.
CREATE OR REPLACE FUNCTION public.mechanic_start_diagnosis(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'mecanico') OR NOT public.is_mechanic_assigned(_order_id,auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;
  UPDATE public.service_orders SET status='em_analise'
   WHERE id=_order_id AND status='recebido';
  IF NOT FOUND THEN RAISE EXCEPTION 'A ordem não está aguardando diagnóstico'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mechanic_start_diagnosis(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mechanic_start_diagnosis(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mechanic_complete_diagnosis(_order_id uuid,_diagnosis text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE clean_diagnosis text;
BEGIN
  clean_diagnosis:=trim(coalesce(_diagnosis,''));
  IF length(clean_diagnosis)<5 OR length(clean_diagnosis)>10000 THEN
    RAISE EXCEPTION 'Descreva o diagnóstico (mínimo 5 caracteres)';
  END IF;
  IF NOT public.has_role(auth.uid(),'mecanico') OR NOT public.is_mechanic_assigned(_order_id,auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;
  UPDATE public.service_orders SET diagnosis=clean_diagnosis,status='aguardando_aprovacao'
   WHERE id=_order_id AND status='em_analise';
  IF NOT FOUND THEN RAISE EXCEPTION 'A ordem não está em diagnóstico'; END IF;
  INSERT INTO public.technical_service_logs(service_order_id,mechanic_user_id,procedure,description,result,observations)
  VALUES(_order_id,auth.uid(),'Diagnóstico','Diagnóstico técnico concluído e encaminhado para orçamento.','Concluído',clean_diagnosis);
END $$;
REVOKE ALL ON FUNCTION public.mechanic_complete_diagnosis(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mechanic_complete_diagnosis(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mechanic_update_order_status(_order_id uuid, _status public.order_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'mecanico') OR NOT public.is_mechanic_assigned(_order_id,auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;
  IF _status <> 'pronto'::public.order_status THEN
    RAISE EXCEPTION 'O mecânico só pode concluir uma ordem já aprovada e em serviço';
  END IF;
  UPDATE public.service_orders SET status='pronto' WHERE id=_order_id AND status='em_servico';
  IF NOT FOUND THEN RAISE EXCEPTION 'A ordem precisa estar em serviço após aprovação do orçamento'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status) TO authenticated;

-- Secretaria também pode consultar e emitir orçamentos.
DROP POLICY IF EXISTS quote_secretary_read ON public.quote_approvals;
CREATE POLICY quote_secretary_read ON public.quote_approvals FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'secretaria'));

CREATE OR REPLACE FUNCTION public.issue_quote_approval(_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.service_orders; q public.quote_approvals;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.status <> 'aguardando_aprovacao' THEN
   RAISE EXCEPTION 'A ordem precisa ter diagnóstico concluído antes de emitir orçamento';
 END IF;
 UPDATE public.quote_approvals SET state='revoked' WHERE order_id=o.id AND state IN ('pending','approved');
 INSERT INTO public.quote_approvals(order_id,snapshot) VALUES(o.id,public.quote_snapshot(o)) RETURNING * INTO q;
 RETURN jsonb_build_object('id',q.id,'token',q.token,'state',q.state,'expires_at',q.expires_at,'approved_at',q.approved_at,'approved_by',q.approved_by);
END $$;
REVOKE ALL ON FUNCTION public.issue_quote_approval(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_quote_approval(uuid) TO authenticated;
