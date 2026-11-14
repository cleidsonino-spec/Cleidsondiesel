-- Vincula cada nova OS a uma ficha independente de recebimento.
-- OS antigas permanecem válidas; a exigência vale para novos INSERTs.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS vehicle_intake_id uuid
  REFERENCES public.vehicle_intake_records(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS service_orders_vehicle_intake_uidx
  ON public.service_orders(vehicle_intake_id)
  WHERE vehicle_intake_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_service_order_vehicle_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake public.vehicle_intake_records;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.vehicle_intake_id IS NOT NULL
       AND NEW.vehicle_intake_id IS DISTINCT FROM OLD.vehicle_intake_id THEN
      RAISE EXCEPTION 'A ficha de recebimento vinculada à OS não pode ser alterada';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.vehicle_intake_id IS NULL THEN
    RAISE EXCEPTION 'Registre o recebimento do veículo antes de abrir a ordem de serviço';
  END IF;

  SELECT * INTO v_intake
  FROM public.vehicle_intake_records
  WHERE id = NEW.vehicle_intake_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha de recebimento não encontrada';
  END IF;

  IF lower(trim(v_intake.customer_name)) <> lower(trim(NEW.customer_name))
     OR lower(trim(v_intake.vehicle)) <> lower(trim(NEW.vehicle))
     OR regexp_replace(upper(trim(v_intake.plate)), '[^A-Z0-9]', '', 'g')
        <> regexp_replace(upper(trim(NEW.plate)), '[^A-Z0-9]', '', 'g') THEN
    RAISE EXCEPTION 'Cliente, veículo e placa da OS devem corresponder à ficha de recebimento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_require_vehicle_intake ON public.service_orders;
CREATE TRIGGER service_orders_require_vehicle_intake
  BEFORE INSERT OR UPDATE OF vehicle_intake_id ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_order_vehicle_intake();

-- A abertura de retorno em garantia também exige ficha própria.
DROP FUNCTION IF EXISTS public.open_warranty_return_service_order(uuid);

CREATE FUNCTION public.open_warranty_return_service_order(
  _return_id uuid,
  _intake_id uuid
)
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
    inspection_checklist, created_by, vehicle_intake_id
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
    '[]'::jsonb, auth.uid(), _intake_id
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

REVOKE ALL ON FUNCTION public.open_warranty_return_service_order(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_warranty_return_service_order(uuid, uuid) TO authenticated;
