-- Preserva NULL na placa das OS de bombas/bicos.
-- normalize_plate(NULL) retorna string vazia; o gatilho precisa converter
-- esse resultado de volta para NULL para respeitar service_orders_plate_optional_check.
CREATE OR REPLACE FUNCTION public.normalize_order_plate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.plate := NULLIF(public.normalize_plate(NEW.plate), '');
  RETURN NEW;
END;
$$;
