-- Lista interna de materiais para compras da oficina.
-- Independente de ordens de serviço, orçamentos e pagamentos.

CREATE TABLE public.material_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Lista de materiais',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

CREATE TABLE public.material_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.material_lists(id) ON DELETE CASCADE,
  technical_reference_id uuid REFERENCES public.technical_references(id) ON DELETE SET NULL,
  technical_component_id uuid REFERENCES public.technical_components(id) ON DELETE SET NULL,
  reference_code text NOT NULL,
  description text NOT NULL,
  manufacturer text,
  pump_code text,
  catalog_position text,
  quantity_needed integer NOT NULL DEFAULT 1 CHECK (quantity_needed > 0),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_list_items_list_reference_unique UNIQUE (list_id, technical_reference_id)
);

CREATE INDEX material_lists_status_created_idx ON public.material_lists(status, created_at DESC);
CREATE INDEX material_list_items_list_idx ON public.material_list_items(list_id);

CREATE TRIGGER material_lists_updated_at
  BEFORE UPDATE ON public.material_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.material_list_staff_access()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.prevent_finalized_material_list_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'finalized' THEN
    RAISE EXCEPTION 'Lista finalizada não pode ser alterada';
  END IF;
  IF NEW.status = 'finalized' AND NEW.finalized_at IS NULL THEN
    NEW.finalized_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER material_lists_lock_finalized
  BEFORE UPDATE ON public.material_lists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_material_list_changes();

ALTER TABLE public.material_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_list_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_list_items TO authenticated;

CREATE POLICY material_lists_staff_read
  ON public.material_lists FOR SELECT TO authenticated
  USING (public.material_list_staff_access());

CREATE POLICY material_lists_staff_insert
  ON public.material_lists FOR INSERT TO authenticated
  WITH CHECK (public.material_list_staff_access() AND created_by = auth.uid() AND status = 'draft');

CREATE POLICY material_lists_staff_update_draft
  ON public.material_lists FOR UPDATE TO authenticated
  USING (public.material_list_staff_access() AND status = 'draft')
  WITH CHECK (public.material_list_staff_access() AND status IN ('draft', 'finalized'));

CREATE POLICY material_lists_staff_delete_draft
  ON public.material_lists FOR DELETE TO authenticated
  USING (public.material_list_staff_access() AND status = 'draft');

CREATE POLICY material_list_items_staff_read
  ON public.material_list_items FOR SELECT TO authenticated
  USING (public.material_list_staff_access());

CREATE POLICY material_list_items_staff_insert_draft
  ON public.material_list_items FOR INSERT TO authenticated
  WITH CHECK (
    public.material_list_staff_access()
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.material_lists l WHERE l.id = list_id AND l.status = 'draft')
  );

CREATE POLICY material_list_items_staff_update_draft
  ON public.material_list_items FOR UPDATE TO authenticated
  USING (
    public.material_list_staff_access()
    AND EXISTS (SELECT 1 FROM public.material_lists l WHERE l.id = list_id AND l.status = 'draft')
  )
  WITH CHECK (
    public.material_list_staff_access()
    AND EXISTS (SELECT 1 FROM public.material_lists l WHERE l.id = list_id AND l.status = 'draft')
  );

CREATE POLICY material_list_items_staff_delete_draft
  ON public.material_list_items FOR DELETE TO authenticated
  USING (
    public.material_list_staff_access()
    AND EXISTS (SELECT 1 FROM public.material_lists l WHERE l.id = list_id AND l.status = 'draft')
  );
