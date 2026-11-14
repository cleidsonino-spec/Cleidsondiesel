-- Cria uma OS independente para cada retorno em garantia, preservando a OS original.
ALTER TABLE public.warranty_returns
  ADD COLUMN IF NOT EXISTS return_service_order_id uuid
  REFERENCES public.service_orders(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS warranty_returns_return_service_order_uidx
  ON public.warranty_returns(return_service_order_id)
  WHERE return_service_order_id IS NOT NULL;

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
    '{}'::jsonb, auth.uid()
  )
  RETURNING id INTO v_new_id;

  UPDATE public.warranty_returns
  SET return_service_order_id = v_new_id,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _return_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_warranty_return_service_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_warranty_return_service_order(uuid) TO authenticated;

-- O mecânico atribuído à OS de retorno pode consultar o registro técnico do retorno,
-- mas não recebe acesso à tabela de garantias nem a valores financeiros.
DROP POLICY IF EXISTS warranty_returns_staff_read ON public.warranty_returns;
CREATE POLICY warranty_returns_staff_read ON public.warranty_returns
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'mecanico'::public.app_role)
      AND return_service_order_id IS NOT NULL
      AND public.is_mechanic_assigned(return_service_order_id, auth.uid())
    )
  );

-- Contexto técnico da OS original, liberado apenas ao mecânico atribuído à OS de retorno.
CREATE OR REPLACE FUNCTION public.get_warranty_return_context(_return_order_id uuid)
RETURNS TABLE (
  return_id uuid,
  original_order_number bigint,
  original_complaint text,
  original_diagnosis text,
  original_parts text,
  return_complaint text,
  return_diagnosis text,
  return_parts_used text,
  return_labor_description text,
  return_resolution text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'mecanico'::public.app_role)
      AND public.is_mechanic_assigned(_return_order_id, auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado ao histórico do retorno';
  END IF;

  RETURN QUERY
  SELECT wr.id, original.number, original.complaint, original.diagnosis,
         original.parts, wr.complaint, wr.diagnosis, wr.parts_used,
         wr.labor_description, wr.resolution
  FROM public.warranty_returns wr
  JOIN public.service_orders original ON original.id = wr.service_order_id
  WHERE wr.return_service_order_id = _return_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_warranty_return_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_warranty_return_context(uuid) TO authenticated;
