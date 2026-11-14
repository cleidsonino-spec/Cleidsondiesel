-- Cria automaticamente uma ficha independente ao abrir uma OS de retorno em garantia.
-- A ficha original é usada apenas como fonte dos dados de recebimento; nunca é reutilizada.
CREATE OR REPLACE FUNCTION public.open_warranty_return_service_order(_return_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return public.warranty_returns;
  v_original public.service_orders;
  v_source_intake public.vehicle_intake_records;
  v_has_source_intake boolean := false;
  v_new_intake_id uuid;
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

  SELECT * INTO v_original
  FROM public.service_orders
  WHERE id = v_return.service_order_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS original não encontrada'; END IF;

  IF v_return.return_service_order_id IS NOT NULL THEN
    RETURN v_return.return_service_order_id;
  END IF;

  IF v_original.vehicle_intake_id IS NOT NULL THEN
    SELECT * INTO v_source_intake
    FROM public.vehicle_intake_records
    WHERE id = v_original.vehicle_intake_id;
    v_has_source_intake := FOUND;
  END IF;

  IF NOT v_has_source_intake THEN
    RAISE EXCEPTION 'A OS original não possui uma ficha de recebimento válida. Não é possível criar o recebimento do retorno sem confirmar os dados de entrada.';
  END IF;

  INSERT INTO public.vehicle_intake_records (
    customer_name, vehicle, plate, received_at, received_by,
    received_by_name, notes, intake_type, arrived_on_tow_truck,
    delivered_items
  ) VALUES (
    v_source_intake.customer_name,
    v_source_intake.vehicle,
    v_source_intake.plate,
    now(),
    auth.uid(),
    'Equipe',
    concat_ws(E'\n', nullif(v_source_intake.notes, ''),
      'Novo recebimento gerado automaticamente para retorno em garantia #' || v_return.id::text),
    v_source_intake.intake_type,
    v_source_intake.arrived_on_tow_truck,
    v_source_intake.delivered_items
  )
  RETURNING id INTO v_new_intake_id;

  INSERT INTO public.service_orders (
    customer_id, vehicle_id, customer_name, phone, vehicle, vehicle_year,
    plate, mileage, complaint, diagnosis, parts, part_items,
    parts_value, labor_value, status, entry_date, due_date, notes,
    inspection_checklist, created_by, vehicle_intake_id
  ) VALUES (
    v_original.customer_id, v_original.vehicle_id, v_source_intake.customer_name,
    v_original.phone, v_source_intake.vehicle, v_original.vehicle_year,
    v_source_intake.plate, v_original.mileage,
    'RETORNO EM GARANTIA — ' || v_return.complaint,
    NULL, NULL, '[]'::jsonb, 0, 0, 'recebido',
    CURRENT_DATE, NULL,
    'Retorno em garantia #' || v_return.id::text ||
      '. OS original nº ' || v_original.number::text ||
      '. Consulte o histórico da OS original antes de iniciar o serviço.',
    '[]'::jsonb, auth.uid(), v_new_intake_id
  )
  RETURNING id INTO v_new_id;

  UPDATE public.warranty_returns
  SET return_service_order_id = v_new_id,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _return_id;

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

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_warranty_return_service_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_warranty_return_service_order(uuid) TO authenticated;
