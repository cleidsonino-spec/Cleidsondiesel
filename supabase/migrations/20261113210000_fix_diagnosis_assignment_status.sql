-- Corrige a transição do diagnóstico: ao encaminhar a OS, ela passa
-- de recebida para em_analise na mesma transação da atribuição.
CREATE OR REPLACE FUNCTION public.assign_order_to_mechanic(
  _order_id uuid,
  _mechanic_user_id uuid,
  _stage text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.service_orders;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT * INTO o
  FROM public.service_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem não encontrada';
  END IF;

  IF NOT public.has_role(_mechanic_user_id, 'mecanico'::public.app_role) THEN
    RAISE EXCEPTION 'O usuário selecionado não é mecânico';
  END IF;

  IF _stage = 'diagnostico' THEN
    IF o.status <> 'recebido'::public.order_status THEN
      RAISE EXCEPTION 'A OS precisa estar recebida para encaminhar o diagnóstico';
    END IF;
    IF o.intake_required AND NOT EXISTS (
      SELECT 1 FROM public.vehicle_intake_records r
      WHERE r.service_order_id = _order_id
    ) THEN
      RAISE EXCEPTION 'Registre o recebimento do veículo antes de encaminhar ao mecânico';
    END IF;
  ELSIF _stage = 'servico' THEN
    IF o.status <> 'aprovado_aguardando_encaminhamento'::public.order_status
       OR NOT EXISTS (
         SELECT 1 FROM public.quote_approvals q
         WHERE q.order_id = _order_id AND q.state = 'approved'
       )
    THEN
      RAISE EXCEPTION 'O orçamento precisa estar aprovado para encaminhar o serviço';
    END IF;
    IF o.intake_required AND NOT EXISTS (
      SELECT 1 FROM public.vehicle_intake_records r
      WHERE r.service_order_id = _order_id
    ) THEN
      RAISE EXCEPTION 'Registre o recebimento do veículo antes de encaminhar ao mecânico';
    END IF;
  ELSE
    RAISE EXCEPTION 'Etapa inválida';
  END IF;

  UPDATE public.service_order_assignments
  SET active = false
  WHERE service_order_id = _order_id AND active = true;

  INSERT INTO public.service_order_assignments (
    service_order_id, mechanic_user_id, assigned_by, active
  ) VALUES (
    _order_id, _mechanic_user_id, auth.uid(), true
  );

  IF _stage = 'diagnostico' THEN
    UPDATE public.service_orders
    SET status = 'em_analise'::public.order_status
    WHERE id = _order_id;
  ELSIF _stage = 'servico' THEN
    UPDATE public.service_orders
    SET status = 'em_servico'::public.order_status
    WHERE id = _order_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_order_to_mechanic(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_order_to_mechanic(uuid, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.assign_order_to_mechanic(uuid, uuid, text) IS
  'Atribui diagnóstico ou execução. Encaminhamento de diagnóstico muda a OS para em_analise na mesma transação.';
