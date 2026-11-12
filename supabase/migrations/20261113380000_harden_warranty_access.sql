-- Protege a tabela de garantias mesmo se o RLS não tiver sido ativado
-- no ambiente inicial. O acesso operacional é exclusivo de admin/secretaria.
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.warranties FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.warranties TO authenticated;
GRANT ALL ON TABLE public.warranties TO service_role;

DROP POLICY IF EXISTS warranties_staff_access ON public.warranties;
CREATE POLICY warranties_staff_access
  ON public.warranties
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

-- Uma política restritiva impede que políticas permissivas antigas e amplas
-- reabram acesso a mecânicos ou usuários comuns.
DROP POLICY IF EXISTS warranties_staff_guard ON public.warranties;
CREATE POLICY warranties_staff_guard
  ON public.warranties
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

COMMENT ON TABLE public.warranties IS
  'Garantias acessíveis somente a administradores e secretaria; exclusão direta não concedida. Alterações preservam trilha de auditoria.';
