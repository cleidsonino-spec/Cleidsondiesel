-- Autor de uma movimentação é sempre o usuário autenticado que a registra.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_quantity numeric(12,3);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente administrador pode registrar movimentações de estoque';
  END IF;

  NEW.created_by := auth.uid();

  SELECT stock_quantity INTO current_quantity
    FROM public.inventory_items
   WHERE id = NEW.item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado no estoque.';
  END IF;

  IF NEW.movement_type = 'saida' AND current_quantity < NEW.quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: %', current_quantity;
  END IF;

  PERFORM set_config('app.inventory_movement', 'on', true);
  UPDATE public.inventory_items
     SET stock_quantity = CASE
       WHEN NEW.movement_type = 'entrada' THEN stock_quantity + NEW.quantity
       ELSE stock_quantity - NEW.quantity
     END,
     updated_at = now()
   WHERE id = NEW.item_id;
  PERFORM set_config('app.inventory_movement', 'off', true);

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Admins create inventory movements" ON public.inventory_movements;
CREATE POLICY "Admins create inventory movements" ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND created_by = auth.uid()
  );

REVOKE ALL ON FUNCTION public.apply_inventory_movement() FROM PUBLIC, anon, authenticated;
