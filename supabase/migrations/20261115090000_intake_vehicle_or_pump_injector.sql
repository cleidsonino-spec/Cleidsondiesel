-- Suporta recebimento de veículos e de bombas/bicos sem placa.
ALTER TABLE public.vehicle_intake_records
  ADD COLUMN IF NOT EXISTS intake_type text NOT NULL DEFAULT 'vehicle',
  ADD COLUMN IF NOT EXISTS arrived_on_tow_truck boolean;

ALTER TABLE public.vehicle_intake_records
  ALTER COLUMN plate DROP NOT NULL;

ALTER TABLE public.vehicle_intake_records
  DROP CONSTRAINT IF EXISTS vehicle_intake_records_plate_check,
  ADD CONSTRAINT vehicle_intake_records_type_check
    CHECK (intake_type IN ('vehicle', 'pump_injector')),
  ADD CONSTRAINT vehicle_intake_records_plate_by_type_check
    CHECK (
      (intake_type = 'vehicle' AND plate IS NOT NULL
        AND char_length(trim(plate)) BETWEEN 5 AND 12
        AND arrived_on_tow_truck IS NOT NULL)
      OR
      (intake_type = 'pump_injector' AND plate IS NULL
        AND arrived_on_tow_truck IS NULL)
    );

ALTER TABLE public.service_orders
  ALTER COLUMN plate DROP NOT NULL;

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_plate_check,
  ADD CONSTRAINT service_orders_plate_optional_check
    CHECK (plate IS NULL OR char_length(plate) BETWEEN 7 AND 8);

CREATE OR REPLACE FUNCTION public.enforce_service_order_vehicle_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake public.vehicle_intake_records;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.vehicle_intake_id IS NOT NULL
     AND NEW.vehicle_intake_id IS DISTINCT FROM OLD.vehicle_intake_id THEN
    RAISE EXCEPTION 'A ficha de recebimento vinculada à OS não pode ser alterada';
  END IF;

  IF NEW.vehicle_intake_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Registre o recebimento antes de abrir a ordem de serviço';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_intake
  FROM public.vehicle_intake_records
  WHERE id = NEW.vehicle_intake_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha de recebimento não encontrada';
  END IF;

  IF lower(trim(v_intake.customer_name)) <> lower(trim(NEW.customer_name))
     OR lower(trim(v_intake.vehicle)) <> lower(trim(NEW.vehicle)) THEN
    RAISE EXCEPTION 'Cliente e veículo/equipamento da OS devem corresponder à ficha de recebimento';
  END IF;

  IF v_intake.intake_type = 'vehicle' THEN
    IF v_intake.plate IS NULL OR NEW.plate IS NULL
       OR regexp_replace(upper(trim(v_intake.plate)), '[^A-Z0-9]', '', 'g')
          <> regexp_replace(upper(trim(NEW.plate)), '[^A-Z0-9]', '', 'g') THEN
      RAISE EXCEPTION 'A placa da OS deve corresponder à ficha de recebimento';
    END IF;
  ELSE
    IF NEW.plate IS NOT NULL AND trim(NEW.plate) <> '' THEN
      RAISE EXCEPTION 'OS de bomba/bicos não deve possuir placa de veículo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.vehicle_intake_records.intake_type IS
  'Tipo de recebimento: vehicle ou pump_injector.';
COMMENT ON COLUMN public.vehicle_intake_records.arrived_on_tow_truck IS
  'Informa se o veículo chegou no reboque; nulo para recebimento de bomba/bicos.';
