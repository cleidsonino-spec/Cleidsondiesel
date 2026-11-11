-- Permite registrar o procedimento específico de diagnóstico técnico.
ALTER TABLE public.technical_service_logs
  DROP CONSTRAINT IF EXISTS technical_service_logs_procedure_check;

ALTER TABLE public.technical_service_logs
  ADD CONSTRAINT technical_service_logs_procedure_check
  CHECK (procedure = ANY (ARRAY[
    'remocao_bomba',
    'remocao_bicos',
    'teste_bomba',
    'teste_bicos',
    'scanner',
    'diagnostico_eletronico',
    'diagnostico',
    'reparo',
    'montagem_instalacao',
    'teste_final',
    'outro'
  ]));

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
  VALUES(_order_id,auth.uid(),'diagnostico','Diagnóstico técnico concluído e encaminhado para orçamento.','Concluído',clean_diagnosis);
END $$;
REVOKE ALL ON FUNCTION public.mechanic_complete_diagnosis(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mechanic_complete_diagnosis(uuid,text) TO authenticated;
