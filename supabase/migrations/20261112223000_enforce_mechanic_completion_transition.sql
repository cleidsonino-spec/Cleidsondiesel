-- Preserve the approved workflow: mechanics may only mark an order as ready
-- after it has already entered service through the approval flow.
-- Completing the order closes the assignment but retains its history row.
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

  UPDATE public.service_order_assignments
  SET active = false
  WHERE service_order_id = _order_id
    AND mechanic_user_id = auth.uid()
    AND active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status)
TO authenticated;
