-- Estruturas fundamentais do fluxo de atribuição e histórico técnico.
-- Esta migração precisa vir depois da criação de app_role e antes das RPCs
-- de diagnóstico/atribuição que usam estas tabelas.
CREATE TABLE IF NOT EXISTS public.service_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  mechanic_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_order_assignments_mechanic_active_idx
  ON public.service_order_assignments (mechanic_user_id, active, assigned_at DESC);

CREATE INDEX IF NOT EXISTS service_order_assignments_order_active_idx
  ON public.service_order_assignments (service_order_id, active, assigned_at DESC);

ALTER TABLE public.service_order_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_order_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.service_order_assignments TO authenticated;
GRANT ALL ON TABLE public.service_order_assignments TO service_role;

DROP POLICY IF EXISTS service_order_assignments_read_staff
  ON public.service_order_assignments;
CREATE POLICY service_order_assignments_read_staff
  ON public.service_order_assignments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    OR (
      mechanic_user_id = auth.uid()
      AND public.has_role(auth.uid(), 'mecanico'::public.app_role)
    )
  );

CREATE TABLE IF NOT EXISTS public.technical_service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  mechanic_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  procedure text NOT NULL,
  description text NOT NULL,
  result text NOT NULL DEFAULT '',
  observations text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technical_service_logs_order_created_idx
  ON public.technical_service_logs (service_order_id, created_at DESC);

ALTER TABLE public.technical_service_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.technical_service_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.technical_service_logs TO authenticated;
GRANT ALL ON TABLE public.technical_service_logs TO service_role;

DROP POLICY IF EXISTS technical_service_logs_read_staff
  ON public.technical_service_logs;
CREATE POLICY technical_service_logs_read_staff
  ON public.technical_service_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'mecanico'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.service_order_assignments assignment
        WHERE assignment.service_order_id = technical_service_logs.service_order_id
          AND assignment.mechanic_user_id = auth.uid()
          AND assignment.active = true
      )
    )
  );

CREATE OR REPLACE FUNCTION public.is_mechanic_assigned(
  _order_id uuid,
  _mechanic_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_order_assignments assignment
    WHERE assignment.service_order_id = _order_id
      AND assignment.mechanic_user_id = _mechanic_user_id
      AND assignment.active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_mechanic_assigned(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mechanic_assigned(uuid, uuid)
  TO authenticated;

COMMENT ON TABLE public.service_order_assignments IS
  'Histórico de atribuições de mecânicos às ordens; somente a atribuição ativa autoriza ações operacionais.';
COMMENT ON TABLE public.technical_service_logs IS
  'Histórico técnico de diagnóstico e andamento registrado pelos mecânicos.';
COMMENT ON FUNCTION public.is_mechanic_assigned(uuid, uuid) IS
  'Retorna verdadeiro somente quando o usuário possui atribuição ativa para a ordem informada.';
