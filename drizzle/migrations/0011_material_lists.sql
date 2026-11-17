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
);

CREATE INDEX material_lists_status_created_idx ON public.material_lists(status, created_at DESC);
CREATE INDEX material_list_items_list_idx ON public.material_list_items(list_id);

-- A mesma referência pode ser necessária para bombas diferentes: manter linhas separadas.
CREATE UNIQUE INDEX material_list_items_list_reference_pump_unique
  ON public.material_list_items (list_id, technical_reference_id, (COALESCE(pump_code, '')));

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
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Criador da lista não pode ser alterado';
  END IF;
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


-- Garante um único rascunho compartilhado, mesmo com acessos simultâneos.
CREATE UNIQUE INDEX material_lists_single_draft_idx
  ON public.material_lists ((status))
  WHERE status = 'draft';

-- Inclusão atômica: serializa a obtenção do rascunho e soma quantidades
-- sem depender de uma sequência vulnerável de SELECT/UPDATE no navegador.
CREATE OR REPLACE FUNCTION public.add_material_list_item(
  _technical_reference_id uuid,
  _technical_component_id uuid,
  _reference_code text,
  _description text,
  _manufacturer text,
  _pump_code text,
  _catalog_position text,
  _quantity integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _list_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.material_list_staff_access() THEN
    RAISE EXCEPTION 'Acesso não autorizado à lista de materiais';
  END IF;
  IF _technical_reference_id IS NULL THEN
    RAISE EXCEPTION 'A peça precisa estar vinculada a uma referência técnica';
  END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 100000 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  IF NULLIF(trim(_reference_code), '') IS NULL
     OR NULLIF(trim(_description), '') IS NULL THEN
    RAISE EXCEPTION 'Código e descrição da peça são obrigatórios';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cleidson_diesel_shared_material_draft'), 1);

  SELECT id INTO _list_id
  FROM public.material_lists
  WHERE status = 'draft'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _list_id IS NULL THEN
    INSERT INTO public.material_lists (title, status, created_by)
    VALUES ('Lista de materiais', 'draft', auth.uid())
    RETURNING id INTO _list_id;
  END IF;

  INSERT INTO public.material_list_items (
    list_id, technical_reference_id, technical_component_id,
    reference_code, description, manufacturer, pump_code,
    catalog_position, quantity_needed, created_by
  ) VALUES (
    _list_id, _technical_reference_id, _technical_component_id,
    trim(_reference_code), trim(_description), _manufacturer, _pump_code,
    _catalog_position, _quantity, auth.uid()
  )
  ON CONFLICT (list_id, technical_reference_id, (COALESCE(pump_code, '')))
  DO UPDATE SET quantity_needed =
    public.material_list_items.quantity_needed + EXCLUDED.quantity_needed;

  RETURN _list_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_material_list_item(uuid, uuid, text, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_material_list_item(uuid, uuid, text, text, text, text, text, integer) TO authenticated;
