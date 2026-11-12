-- Keep mechanic assignments active only while the mechanic is working on the order.
-- The assignment row is retained as history; completion closes it instead of deleting it.
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

  IF _status NOT IN (
    'em_servico'::public.order_status,
    'pronto'::public.order_status
  ) THEN
    RAISE EXCEPTION 'Status não permitido para mecânico';
  END IF;

  UPDATE public.service_orders
  SET status = _status
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem não encontrada';
  END IF;

  IF _status = 'pronto'::public.order_status THEN
    UPDATE public.service_order_assignments
    SET active = false
    WHERE service_order_id = _order_id
      AND mechanic_user_id = auth.uid()
      AND active = true;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status)
TO authenticated;
