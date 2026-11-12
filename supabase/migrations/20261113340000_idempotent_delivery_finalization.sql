-- Torna a finalização da entrega segura para repetição após timeout/reenvio.
-- A operação não cria novo aceite nem altera a OS novamente se já estiver entregue.
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

  -- Repetição da mesma solicitação após resposta perdida: não duplica eventos
  -- nem tenta reabrir/alterar uma OS que já foi entregue.
  IF current_order.status = 'entregue'::public.order_status THEN
    RETURN;
  END IF;

  IF current_order.status <> 'pronto'::public.order_status THEN
    RAISE EXCEPTION 'A OS precisa estar pronta para retirada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_authorizations a
    WHERE a.service_order_id = _order_id
      AND a.authorization_type = 'delivery_confirmation'
      AND a.signature_method = 'typed_name_checkbox'
      AND a.recorded_by IS NOT NULL
      AND a.accepted_at IS NOT NULL
      AND char_length(trim(a.signer_name)) BETWEEN 3 AND 120
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
  'Finalização idempotente: somente admin/secretaria, OS pronta e aceite de entrega válido; reenvio para OS já entregue retorna sem duplicar transição.';
