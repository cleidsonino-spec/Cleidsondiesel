-- Registra de forma auditável qual mecânico concluiu cada ordem de serviço.
-- O registro é criado na mesma transação da mudança de status para "pronto".
CREATE TABLE IF NOT EXISTS public.service_order_completions (
  service_order_id uuid PRIMARY KEY REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  mechanic_user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_order_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_order_completions_read_management
  ON public.service_order_completions;

CREATE POLICY service_order_completions_read_management
  ON public.service_order_completions
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
  );

REVOKE ALL ON TABLE public.service_order_completions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.service_order_completions TO authenticated;

-- A conclusão só é aceita para o mecânico atualmente atribuído à OS.
-- A chave primária impede contar a mesma OS duas vezes.
CREATE OR REPLACE FUNCTION public.mechanic_update_order_status(
  _order_id uuid,
  _status public.order_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'mecanico')
     OR NOT public.is_mechanic_assigned(_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;

  IF _status <> 'pronto'::public.order_status THEN
    RAISE EXCEPTION 'O mecânico só pode concluir uma ordem já aprovada e em serviço';
  END IF;

  UPDATE public.service_orders
     SET status = 'pronto'
   WHERE id = _order_id
     AND status = 'em_servico';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A ordem precisa estar em serviço após aprovação do orçamento';
  END IF;

  INSERT INTO public.service_order_completions (
    service_order_id,
    mechanic_user_id,
    completed_at
  )
  VALUES (_order_id, auth.uid(), now());

  -- Encerra a atribuição ativa sem apagar o histórico da equipe.
  UPDATE public.service_order_assignments
     SET active = false
   WHERE service_order_id = _order_id
     AND mechanic_user_id = auth.uid()
     AND active = true;
END;
$;

REVOKE ALL ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status)
  TO authenticated;

COMMENT ON TABLE public.service_order_completions IS
  'Registro único e auditável do mecânico responsável pela conclusão de cada OS. Relatórios contam somente conclusões registradas após esta migração.';
