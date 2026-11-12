-- Mantém a entrega física possível depois de retirar UPDATE(status)
-- do acesso direto da API autenticada.
CREATE OR REPLACE FUNCTION public.finalize_service_order_delivery(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.service_orders;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado para finalizar a entrega';
  END IF;

  SELECT * INTO current_order
  FROM public.service_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF current_order.status <> 'pronto'::public.order_status THEN
    RAISE EXCEPTION 'A OS precisa estar pronta para retirada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_authorizations a
    WHERE a.service_order_id = _order_id
      AND a.authorization_type = 'delivery_confirmation'
  ) THEN
    RAISE EXCEPTION 'Registre a confirmação de entrega antes de finalizar a OS';
  END IF;

  UPDATE public.service_orders
  SET status = 'entregue'::public.order_status
  WHERE id = _order_id
    AND status = 'pronto'::public.order_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível finalizar a entrega da OS';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_service_order_delivery(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_service_order_delivery(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.finalize_service_order_delivery(uuid) IS
  'Finaliza entrega somente para admin/secretaria, OS pronta e confirmação de entrega previamente registrada.';
