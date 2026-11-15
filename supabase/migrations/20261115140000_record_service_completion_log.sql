-- Mantém a conclusão oficial também no histórico técnico visível ao mecânico.
-- A função e a tabela base foram criadas na migração anterior.

CREATE OR REPLACE FUNCTION public.mechanic_complete_service(
  _order_id uuid,
  _description text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.service_orders;
  v_completed_at timestamptz;
  v_description text;
BEGIN
  v_description := trim(coalesce(_description, ''));

  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'mecanico')
     OR NOT public.is_mechanic_assigned(_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;

  IF length(v_description) < 5 OR length(v_description) > 10000 THEN
    RAISE EXCEPTION 'Descreva o serviço executado (mínimo 5 caracteres)';
  END IF;

  SELECT *
    INTO v_order
    FROM public.service_orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem não encontrada';
  END IF;

  IF v_order.status <> 'em_servico' THEN
    RAISE EXCEPTION 'A ordem não está em serviço';
  END IF;

  INSERT INTO public.service_order_completions (
    service_order_id,
    mechanic_user_id,
    description
  )
  VALUES (_order_id, auth.uid(), v_description)
  RETURNING completed_at INTO v_completed_at;

  INSERT INTO public.technical_service_logs (
    service_order_id,
    mechanic_user_id,
    procedure,
    description,
    result,
    observations
  )
  VALUES (
    _order_id,
    auth.uid(),
    'teste_final',
    v_description,
    'Concluído',
    'Conclusão oficial do serviço registrada pelo painel do mecânico.'
  );

  UPDATE public.service_orders
     SET status = 'pronto'
   WHERE id = _order_id;

  RETURN v_completed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mechanic_complete_service(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mechanic_complete_service(uuid, text)
  TO authenticated;
