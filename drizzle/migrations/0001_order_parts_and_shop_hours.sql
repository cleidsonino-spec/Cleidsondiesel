ALTER TABLE public.service_orders ADD COLUMN part_items jsonb;
COMMENT ON COLUMN public.service_orders.part_items IS 'Itemized parts with description and value; null preserves legacy aggregate values.';
CREATE OR REPLACE FUNCTION public.calculate_order_parts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; total numeric := 0;
BEGIN
  IF NEW.part_items IS NOT NULL THEN
    IF jsonb_typeof(NEW.part_items) <> 'array' THEN RAISE EXCEPTION 'Lista de peças inválida'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(NEW.part_items) LOOP
      IF jsonb_typeof(item) <> 'object' OR jsonb_typeof(item->'description') IS DISTINCT FROM 'string' OR length(trim(item->>'description')) = 0 OR jsonb_typeof(item->'value') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Informe a peça e seu valor'; END IF;
      IF (item->>'value')::numeric < 0 THEN RAISE EXCEPTION 'Valor de peça inválido'; END IF;
      total := total + round((item->>'value')::numeric, 2);
    END LOOP;
    NEW.parts_value := total;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER service_orders_calculate_parts BEFORE INSERT OR UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.calculate_order_parts();
CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.plate := public.normalize_plate(NEW.plate);
  IF TG_OP = 'INSERT' THEN
    IF NEW.scheduled_date < current_date THEN RAISE EXCEPTION 'A data do agendamento não pode estar no passado'; END IF;
    IF EXTRACT(DOW FROM NEW.scheduled_date) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Atendemos de segunda a sexta'; END IF;
    IF NEW.scheduled_time NOT IN ('08:00'::time, '09:00'::time, '10:00'::time, '11:00'::time, '13:00'::time, '14:00'::time, '15:00'::time, '16:00'::time, '17:00'::time) THEN RAISE EXCEPTION 'Horário fora do atendimento'; END IF;
  END IF;
  RETURN NEW;
END;
$$;