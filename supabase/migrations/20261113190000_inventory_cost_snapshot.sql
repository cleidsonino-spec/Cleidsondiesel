-- Registra custo histórico nas saídas de estoque para permitir análise por OS.
-- Movimentos antigos sem custo permanecem sem custo: não inventamos histórico.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta numeric(14,3);
  v_unit_cost numeric(12,2);
  v_active boolean;
BEGIN
  SELECT unit_cost, active
    INTO v_unit_cost, v_active
    FROM public.inventory_items
   WHERE id = NEW.item_id
   FOR UPDATE;

  IF NOT FOUND OR NOT v_active THEN
    RAISE EXCEPTION 'Item inexistente ou inativo';
  END IF;

  IF NEW.movement_type = 'saida' THEN
    NEW.unit_cost := COALESCE(NEW.unit_cost, v_unit_cost);
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  v_delta := CASE WHEN NEW.movement_type = 'entrada'
    THEN NEW.quantity ELSE -NEW.quantity END;

  UPDATE public.inventory_items
     SET quantity_on_hand = quantity_on_hand + v_delta,
         updated_at = now(),
         unit_cost = CASE
           WHEN NEW.movement_type = 'entrada' AND NEW.unit_cost IS NOT NULL
           THEN NEW.unit_cost ELSE unit_cost END
   WHERE id = NEW.item_id
     AND active = true
     AND quantity_on_hand + v_delta >= 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estoque insuficiente para esta saída';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.apply_inventory_movement() SECURITY DEFINER;
ALTER FUNCTION public.apply_inventory_movement() SET search_path = public;
REVOKE ALL ON FUNCTION public.apply_inventory_movement() FROM PUBLIC, anon, authenticated;
