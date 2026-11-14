-- Modalidades de recebimento: veículo ou bomba/bicos entregues em mãos.
-- A placa só pode ficar ausente quando a ficha vinculada for pump_injector.
ALTER TABLE public.vehicle_intake_records
  ADD COLUMN IF NOT EXISTS intake_type text NOT NULL DEFAULT 'vehicle',
  ADD COLUMN IF NOT EXISTS arrived_on_tow_truck boolean,
  ADD COLUMN IF NOT EXISTS delivered_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Compatibilidade: fichas antigas representam veículos e não tinham a pergunta do reboque.
UPDATE public.vehicle_intake_records
SET arrived_on_tow_truck = false
WHERE intake_type = 'vehicle' AND arrived_on_tow_truck IS NULL;

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
        AND arrived_on_tow_truck IS NOT NULL
        AND delivered_items = '[]'::jsonb)
      OR
      (intake_type = 'pump_injector' AND plate IS NULL
        AND arrived_on_tow_truck IS NULL
        AND CASE
          WHEN jsonb_typeof(delivered_items) = 'array'
            THEN jsonb_array_length(delivered_items) > 0
          ELSE false
        END)
    ),
  ADD CONSTRAINT vehicle_intake_records_delivered_items_array_check
    CHECK (jsonb_typeof(delivered_items) = 'array');

-- A coluna aceita NULL tecnicamente, mas a regra abaixo só libera NULL
-- para OS ligada a ficha do tipo pump_injector.
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
  v_item jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.vehicle_intake_id IS NOT NULL THEN
    IF NEW.vehicle_intake_id IS DISTINCT FROM OLD.vehicle_intake_id THEN
      RAISE EXCEPTION 'A ficha de recebimento vinculada à OS não pode ser alterada';
    END IF;
    -- A ficha registra o estado do recebimento; edições posteriores da OS
    -- não devem bloquear correções legítimas de cliente/equipamento/placa.
    RETURN NEW;
  END IF;

  IF NEW.vehicle_intake_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Registre o recebimento antes de abrir a ordem de serviço';
    END IF;
    IF NEW.plate IS NULL OR char_length(NEW.plate) NOT BETWEEN 7 AND 8 THEN
      RAISE EXCEPTION 'A placa é obrigatória fora da modalidade bomba/bicos';
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

  IF lower(trim(v_intake.customer_name)) <> lower(trim(NEW.customer_name)) THEN
    RAISE EXCEPTION 'O cliente da OS deve corresponder à ficha de recebimento';
  END IF;

  IF v_intake.intake_type = 'vehicle' THEN
    IF lower(trim(v_intake.vehicle)) <> lower(trim(NEW.vehicle)) THEN
      RAISE EXCEPTION 'O veículo da OS deve corresponder à ficha de recebimento';
    END IF;
    IF NEW.plate IS NULL
       OR regexp_replace(upper(trim(v_intake.plate)), '[^A-Z0-9]', '', 'g')
          <> regexp_replace(upper(trim(NEW.plate)), '[^A-Z0-9]', '', 'g') THEN
      RAISE EXCEPTION 'A placa da OS deve corresponder à ficha de recebimento';
    END IF;
  ELSIF v_intake.intake_type = 'pump_injector' THEN
    IF NEW.plate IS NOT NULL AND trim(NEW.plate) <> '' THEN
      RAISE EXCEPTION 'OS de bomba/bicos não deve possuir placa de veículo';
    END IF;
    IF jsonb_typeof(v_intake.delivered_items) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Informe os itens e as quantidades entregues na ficha';
    END IF;
    IF jsonb_array_length(v_intake.delivered_items) = 0 THEN
      RAISE EXCEPTION 'Informe os itens e as quantidades entregues na ficha';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_intake.delivered_items)
    LOOP
      IF length(trim(coalesce(v_item->>'description',''))) < 2
         OR coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'Cada item entregue precisa de descrição e quantidade inteira maior que zero';
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Modalidade de recebimento inválida';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.vehicle_intake_records.intake_type IS
  'Modalidade: vehicle (veículo) ou pump_injector (bomba/bicos em mãos).';
COMMENT ON COLUMN public.vehicle_intake_records.arrived_on_tow_truck IS
  'Informa se o veículo chegou no reboque; nulo para bomba/bicos.';
COMMENT ON COLUMN public.vehicle_intake_records.delivered_items IS
  'Itens entregues em mãos, cada objeto contendo description e quantity; obrigatório para pump_injector.';


-- Valida a estrutura dos itens já no recebimento, não apenas na abertura da OS.
CREATE OR REPLACE FUNCTION public.validate_vehicle_intake_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF NEW.intake_type = 'pump_injector' THEN
    IF jsonb_typeof(NEW.delivered_items) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Informe ao menos um item entregue';
    END IF;
    IF jsonb_array_length(NEW.delivered_items) = 0 THEN
      RAISE EXCEPTION 'Informe ao menos um item entregue';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.delivered_items)
    LOOP
      IF length(trim(coalesce(v_item->>'description',''))) < 2
         OR coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'Cada item entregue precisa de descrição e quantidade inteira maior que zero';
      END IF;
    END LOOP;
  ELSIF NEW.intake_type = 'vehicle' THEN
    IF NEW.plate IS NULL OR length(trim(NEW.plate)) < 5
       OR NEW.arrived_on_tow_truck IS NULL THEN
      RAISE EXCEPTION 'Recebimento de veículo exige placa e resposta sobre reboque';
    END IF;
    IF jsonb_typeof(NEW.delivered_items) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'A lista de itens deve ser um array JSON';
    END IF;
    IF jsonb_array_length(NEW.delivered_items) <> 0 THEN
      RAISE EXCEPTION 'Itens entregues em mãos só se aplicam à modalidade bomba/bicos';
    END IF;
  ELSE
    RAISE EXCEPTION 'Modalidade de recebimento inválida';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicle_intake_validate_record ON public.vehicle_intake_records;
CREATE TRIGGER vehicle_intake_validate_record
  BEFORE INSERT OR UPDATE ON public.vehicle_intake_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_intake_record();
