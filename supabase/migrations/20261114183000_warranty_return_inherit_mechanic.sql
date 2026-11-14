-- Faz a OS de retorno herdar os mecânicos ativos da OS original.
-- Mantém a fila do mecânico e as regras de acesso baseadas em atribuição ativa.
CREATE OR REPLACE FUNCTION public.open_warranty_return_service_order(_return_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return public.warranty_returns;
  v_original public.service_orders;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT * INTO v_return
  FROM public.warranty_returns
  WHERE id = _return_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retorno em garantia não encontrado'; END IF;
  IF v_return.status IN ('resolved', 'not_covered') THEN
    RAISE EXCEPTION 'Não é possível abrir OS para um retorno encerrado';
  END IF;
  IF v_return.return_service_order_id IS NOT NULL THEN
    RETURN v_return.return_service_order_id;
  END IF;

  SELECT * INTO v_original
  FROM public.service_orders
  WHERE id = v_return.service_order_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS original não encontrada'; END IF;

  INSERT INTO public.service_orders (
    customer_id, vehicle_id, customer_name, phone, vehicle, vehicle_year,
    plate, mileage, complaint, diagnosis, parts, part_items,
    parts_value, labor_value, status, entry_date, due_date, notes,
    inspection_checklist, created_by
  ) VALUES (
    v_original.customer_id, v_original.vehicle_id, v_original.customer_name,
    v_original.phone, v_original.vehicle, v_original.vehicle_year,
    v_original.plate, v_original.mileage,
    'RETORNO EM GARANTIA — ' || v_return.complaint,
    NULL, NULL, '[]'::jsonb, 0, 0, 'recebido',
    CURRENT_DATE, NULL,
    'Retorno em garantia #' || v_return.id::text ||
      '. OS original nº ' || v_original.number::text ||
      '. Consulte o histórico da OS original antes de iniciar o serviço.',
    '[]'::jsonb, auth.uid()
  )
  RETURNING id INTO v_new_id;

  -- A atribuição é copiada apenas na primeira abertura. A linha do retorno
  -- permanece bloqueada acima, garantindo idempotência entre chamadas concorrentes.
  INSERT INTO public.service_order_assignments (
    service_order_id, mechanic_user_id, assigned_by, active
  )
  SELECT
    v_new_id, source_assignment.mechanic_user_id, auth.uid(), true
  FROM public.service_order_assignments AS source_assignment
  WHERE source_assignment.service_order_id = v_original.id
    AND source_assignment.active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_order_assignments AS existing_assignment
      WHERE existing_assignment.service_order_id = v_new_id
        AND existing_assignment.mechanic_user_id = source_assignment.mechanic_user_id
        AND existing_assignment.active = true
    );

  UPDATE public.warranty_returns
  SET return_service_order_id = v_new_id,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _return_id;

  RETURN v_new_id;
END;
$$;
