-- Reforça no banco duas regras críticas do fluxo de garantia.
-- A validação não depende exclusivamente dos controles da interface.

CREATE OR REPLACE FUNCTION public.guard_warranty_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Serializa com alterações concorrentes da OS e só emite garantia
    -- quando a OS já foi registrada como entregue.
    SELECT status INTO v_order_status
      FROM public.service_orders
     WHERE id = NEW.service_order_id
     FOR UPDATE;

    IF NOT FOUND OR v_order_status IS DISTINCT FROM 'entregue' THEN
      RAISE EXCEPTION 'A garantia só pode ser emitida quando a OS estiver entregue';
    END IF;
  ELSE
    IF NEW.service_order_id IS DISTINCT FROM OLD.service_order_id
      OR NEW.start_date IS DISTINCT FROM OLD.start_date
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'A garantia não pode ser transferida para outra OS nem ter sua data de início ou autoria alteradas';
    END IF;
  END IF;

  IF NEW.duration_months < 1 OR NEW.duration_months > 120 OR NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Prazo ou vencimento da garantia inválido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_warranty_return(
  _warranty_id uuid,
  _complaint text,
  _return_id uuid DEFAULT NULL,
  _status text DEFAULT 'received',
  _diagnosis text DEFAULT '',
  _resolution text DEFAULT '',
  _parts_used text DEFAULT '',
  _labor_description text DEFAULT '',
  _customer_update text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warranty public.warranties;
  v_return public.warranty_returns;
  v_id uuid;
  v_complaint text;
  v_diagnosis text;
  v_resolution text;
  v_parts text;
  v_labor text;
  v_customer_update text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  v_complaint := regexp_replace(trim(coalesce(_complaint, '')), '[[:space:]]+', ' ', 'g');
  v_diagnosis := trim(coalesce(_diagnosis, ''));
  v_resolution := trim(coalesce(_resolution, ''));
  v_parts := trim(coalesce(_parts_used, ''));
  v_labor := trim(coalesce(_labor_description, ''));
  v_customer_update := trim(coalesce(_customer_update, ''));

  IF char_length(v_complaint) < 5 OR char_length(v_complaint) > 5000 THEN
    RAISE EXCEPTION 'Descreva o motivo do retorno (5 a 5000 caracteres)';
  END IF;
  IF _status NOT IN ('received', 'in_review', 'resolved', 'not_covered') THEN
    RAISE EXCEPTION 'Situação do retorno inválida';
  END IF;
  IF _status IN ('resolved', 'not_covered') THEN
    IF char_length(v_diagnosis) < 3 THEN
      RAISE EXCEPTION 'Informe o diagnóstico técnico (mínimo de 3 caracteres) antes de encerrar o retorno';
    END IF;
    IF char_length(v_resolution) < 3 THEN
      RAISE EXCEPTION 'Informe a solução ou justificativa antes de encerrar o retorno';
    END IF;
  END IF;

  SELECT * INTO v_warranty
    FROM public.warranties
   WHERE id = _warranty_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Garantia original não encontrada';
  END IF;

  IF _return_id IS NULL THEN
    IF _status NOT IN ('received', 'in_review') THEN
      RAISE EXCEPTION 'Um retorno novo deve iniciar como recebido ou em análise';
    END IF;
    INSERT INTO public.warranty_returns(
      warranty_id, service_order_id, status, complaint, diagnosis, resolution,
      parts_used, labor_description, customer_update, created_by, updated_by
    ) VALUES (
      v_warranty.id, v_warranty.service_order_id, _status, v_complaint, v_diagnosis,
      v_resolution, v_parts, v_labor, v_customer_update, auth.uid(), auth.uid()
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT * INTO v_return
    FROM public.warranty_returns
   WHERE id = _return_id AND warranty_id = _warranty_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Retorno não encontrado para esta garantia';
  END IF;
  IF v_return.status IN ('resolved', 'not_covered') THEN
    RAISE EXCEPTION 'Retorno encerrado não pode ser alterado; registre um novo retorno se necessário';
  END IF;
  IF v_return.status = 'received' AND _status NOT IN ('received', 'in_review') THEN
    RAISE EXCEPTION 'O retorno precisa passar por análise antes do encerramento';
  END IF;
  IF v_return.status = 'in_review' AND _status NOT IN ('in_review', 'resolved', 'not_covered') THEN
    RAISE EXCEPTION 'Não é permitido reabrir ou retroceder um retorno em análise';
  END IF;

  UPDATE public.warranty_returns
     SET status = _status,
         complaint = v_complaint,
         diagnosis = v_diagnosis,
         resolution = v_resolution,
         parts_used = v_parts,
         labor_description = v_labor,
         customer_update = v_customer_update,
         updated_by = auth.uid(),
         updated_at = now(),
         closed_at = CASE WHEN _status IN ('resolved', 'not_covered') THEN now() ELSE NULL END
   WHERE id = _return_id
   RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_warranty_return(uuid, text, uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_warranty_return(uuid, text, uuid, text, text, text, text, text, text) TO authenticated;
