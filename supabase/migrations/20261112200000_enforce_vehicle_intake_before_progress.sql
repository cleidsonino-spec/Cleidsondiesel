-- Novas OS exigem ficha de recebimento antes de avançar para diagnóstico/execução.
-- Ordens existentes são preservadas sem bloqueio retroativo.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS intake_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_orders
  ALTER COLUMN intake_required SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.set_new_order_intake_required()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN (
    'em_analise'::public.order_status,
    'aguardando_aprovacao'::public.order_status,
    'aprovado_aguardando_encaminhamento'::public.order_status,
    'em_servico'::public.order_status,
    'pronto'::public.order_status,
    'entregue'::public.order_status
  ) THEN
    RAISE EXCEPTION 'Uma nova OS deve ser aberta como recebida. Registre a ficha de recebimento antes de iniciar o diagnóstico';
  END IF;

  NEW.intake_required := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_set_intake_required ON public.service_orders;
CREATE TRIGGER service_orders_set_intake_required
BEFORE INSERT ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.set_new_order_intake_required();

CREATE OR REPLACE FUNCTION public.enforce_vehicle_intake_before_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.intake_required
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN (
       'em_analise'::public.order_status,
       'aguardando_aprovacao'::public.order_status,
       'aprovado_aguardando_encaminhamento'::public.order_status,
       'em_servico'::public.order_status,
       'pronto'::public.order_status,
       'entregue'::public.order_status
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.vehicle_intake_records r
       WHERE r.service_order_id = NEW.id
     )
  THEN
    RAISE EXCEPTION 'Registre o recebimento do veículo antes de avançar a ordem de serviço';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_require_vehicle_intake ON public.service_orders;
CREATE TRIGGER service_orders_require_vehicle_intake
BEFORE UPDATE OF status ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_vehicle_intake_before_progress();

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

  IF _stage = 'servico' THEN
    UPDATE public.service_orders
    SET status = 'em_servico'
    WHERE id = _order_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_order_to_mechanic(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_order_to_mechanic(uuid, uuid, text) TO authenticated;

COMMENT ON COLUMN public.service_orders.intake_required IS
  'Indica se a OS deve possuir ficha de recebimento antes de avançar. Novas OS recebem true; OS antigas preservam false.';
