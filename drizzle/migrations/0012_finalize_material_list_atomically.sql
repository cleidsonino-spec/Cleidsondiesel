-- Finalização atômica da lista de materiais.
-- Usa o mesmo advisory lock da inclusão para impedir corrida entre adicionar e finalizar.

CREATE OR REPLACE FUNCTION public.finalize_material_list(_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _locked_list_id uuid;
  _item_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.material_list_staff_access() THEN
    RAISE EXCEPTION 'Acesso não autorizado à lista de materiais';
  END IF;

  -- Mesmo lock global utilizado por add_material_list_item.
  PERFORM pg_advisory_xact_lock(hashtext('cleidson_diesel_shared_material_draft'), 1);

  SELECT id
    INTO _locked_list_id
  FROM public.material_lists
  WHERE id = _list_id
    AND status = 'draft'
  FOR UPDATE;

  IF _locked_list_id IS NULL THEN
    RAISE EXCEPTION 'Lista não encontrada ou já finalizada';
  END IF;

  SELECT count(*)::integer
    INTO _item_count
  FROM public.material_list_items
  WHERE list_id = _locked_list_id;

  IF _item_count = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos uma peça antes de finalizar';
  END IF;

  UPDATE public.material_lists
  SET status = 'finalized',
      finalized_at = now()
  WHERE id = _locked_list_id
    AND status = 'draft';
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_material_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_material_list(uuid) TO authenticated;
