-- Recursos do painel do mecânico: mudança controlada de status e histórico
CREATE OR REPLACE FUNCTION public.mechanic_update_order_status(_order_id uuid, _status public.order_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'mecanico') OR NOT public.is_mechanic_assigned(_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;
  IF _status NOT IN ('em_servico'::public.order_status, 'pronto'::public.order_status) THEN
    RAISE EXCEPTION 'Status não permitido para mecânico';
  END IF;
  UPDATE public.service_orders SET status = _status WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_update_order_status(uuid, public.order_status) TO authenticated;
