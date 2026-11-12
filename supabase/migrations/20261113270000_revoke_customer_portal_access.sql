-- Permite invalidar imediatamente um link de acompanhamento comprometido,
-- sem precisar emitir outro link para a mesma OS.
CREATE OR REPLACE FUNCTION public.revoke_customer_portal_access(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  revoked_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  UPDATE public.customer_portal_access
     SET revoked_at = now()
   WHERE service_order_id = _order_id
     AND revoked_at IS NULL
     AND expires_at > now();

  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_customer_portal_access(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_customer_portal_access(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.revoke_customer_portal_access(uuid) IS
  'Revoga todos os links ativos de acompanhamento da OS; disponível apenas para admin e secretaria.';
