-- Estoque e fornecedores: saldo mantido exclusivamente por movimentos auditáveis.
CREATE TABLE IF NOT EXISTS public.suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
 document text, phone text, email text, notes text,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_document_unique ON public.suppliers(document) WHERE document IS NOT NULL AND trim(document) <> '';
CREATE TABLE IF NOT EXISTS public.inventory_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text,
 name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 180),
 brand text, description text, unit text NOT NULL DEFAULT 'un',
 quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
 minimum_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
 unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
 sale_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
 location text, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_code_unique ON public.inventory_items(code) WHERE code IS NOT NULL AND trim(code) <> '';
CREATE INDEX IF NOT EXISTS inventory_items_name_idx ON public.inventory_items(name);
CREATE TABLE IF NOT EXISTS public.inventory_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
 movement_type text NOT NULL CHECK (movement_type IN ('entrada','saida')),
 quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
 unit_cost numeric(12,2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
 supplier_id uuid REFERENCES public.suppliers(id) ON DELETE RESTRICT,
 service_order_id uuid REFERENCES public.service_orders(id) ON DELETE RESTRICT,
 reference text, notes text,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), idempotency_key text UNIQUE
);
CREATE INDEX IF NOT EXISTS inventory_movements_item_date_idx ON public.inventory_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_order_idx ON public.inventory_movements(service_order_id) WHERE service_order_id IS NOT NULL;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppliers, public.inventory_items, public.inventory_movements FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.suppliers, public.inventory_items TO authenticated;
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.suppliers, public.inventory_items, public.inventory_movements TO service_role;
DROP POLICY IF EXISTS suppliers_admin_all ON public.suppliers;
CREATE POLICY suppliers_admin_all ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS inventory_items_admin_all ON public.inventory_items;
CREATE POLICY inventory_items_admin_all ON public.inventory_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS inventory_movements_admin_read ON public.inventory_movements;
CREATE POLICY inventory_movements_admin_read ON public.inventory_movements FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS inventory_movements_admin_insert ON public.inventory_movements;
CREATE POLICY inventory_movements_admin_insert ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND (created_by IS NULL OR created_by = auth.uid()));
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_delta numeric(14,3);
BEGIN
 IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
 v_delta := CASE WHEN NEW.movement_type = 'entrada' THEN NEW.quantity ELSE -NEW.quantity END;
 UPDATE public.inventory_items
 SET quantity_on_hand = quantity_on_hand + v_delta,
     updated_at = now(),
     unit_cost = CASE WHEN NEW.movement_type = 'entrada' AND NEW.unit_cost IS NOT NULL THEN NEW.unit_cost ELSE unit_cost END
 WHERE id = NEW.item_id AND active = true AND quantity_on_hand + v_delta >= 0;
 IF NOT FOUND THEN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE id = NEW.item_id AND active = true) THEN RAISE EXCEPTION 'Item inexistente ou inativo'; END IF;
  RAISE EXCEPTION 'Estoque insuficiente para esta saída';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS inventory_movement_apply ON public.inventory_movements;
CREATE TRIGGER inventory_movement_apply BEFORE INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();
COMMENT ON TABLE public.inventory_movements IS 'Livro de movimentos imutável; o saldo é atualizado pelo trigger e nunca editado diretamente.';
