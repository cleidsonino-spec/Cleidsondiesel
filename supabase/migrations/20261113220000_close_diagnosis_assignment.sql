-- Ao concluir o diagnóstico, encerra a atribuição ativa do mecânico.
-- A desativação ocorre depois da mudança de status para preservar a notificação
-- que identifica o responsável pelo diagnóstico concluído.
CREATE OR REPLACE FUNCTION public.mechanic_complete_diagnosis(
  _order_id uuid,
  _diagnosis text,
  _fuel_filter_replacement boolean,
  _system_cleaning boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_diagnosis text;
BEGIN
  clean_diagnosis := trim(coalesce(_diagnosis, ''));
  IF length(clean_diagnosis) < 5 OR length(clean_diagnosis) > 10000 THEN
    RAISE EXCEPTION 'Descreva o diagnóstico (mínimo 5 caracteres)';
  END IF;
  IF _fuel_filter_replacement IS NULL OR _system_cleaning IS NULL THEN
    RAISE EXCEPTION 'Informe as duas verificações de manutenção';
  END IF;
  IF NOT public.has_role(auth.uid(), 'mecanico')
     OR NOT public.is_mechanic_assigned(_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;

  UPDATE public.service_orders
  SET diagnosis = clean_diagnosis,
      fuel_filter_replacement = _fuel_filter_replacement,
      system_cleaning = _system_cleaning,
      status = 'aguardando_aprovacao'
  WHERE id = _order_id AND status = 'em_analise';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A ordem não está em diagnóstico';
  END IF;

  INSERT INTO public.technical_service_logs(
    service_order_id, mechanic_user_id, procedure, description, result, observations
  )
  VALUES (
    _order_id, auth.uid(), 'diagnostico',
    'Diagnóstico técnico concluído e encaminhado para orçamento.',
    'Concluído', clean_diagnosis
  );

  UPDATE public.service_order_assignments
  SET active = false
  WHERE service_order_id = _order_id
    AND mechanic_user_id = auth.uid()
    AND active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
  TO authenticated;
