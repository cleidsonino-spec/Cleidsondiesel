-- Registra andamento somente para o mecânico atualmente atribuído à OS em serviço.
-- Evita depender de INSERT direto do navegador em technical_service_logs.
CREATE OR REPLACE FUNCTION public.mechanic_record_service_progress(
  _order_id uuid,
  _description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_description text := trim(coalesce(_description, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'mecanico'::public.app_role)
     OR NOT public.is_mechanic_assigned(_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado à ordem';
  END IF;

  IF length(clean_description) < 3 OR length(clean_description) > 5000 THEN
    RAISE EXCEPTION 'Descreva o andamento do serviço (3 a 5000 caracteres)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.service_orders
    WHERE id = _order_id AND status = 'em_servico'::public.order_status
  ) THEN
    RAISE EXCEPTION 'A ordem não está em execução';
  END IF;

  INSERT INTO public.technical_service_logs (
    service_order_id, mechanic_user_id, procedure, description, result, observations
  ) VALUES (
    _order_id, auth.uid(), 'outro', clean_description, 'Em andamento', ''
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mechanic_record_service_progress(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_record_service_progress(uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.mechanic_record_service_progress(uuid, text) IS
  'Registra andamento apenas para o mecânico atribuído à OS que esteja em serviço.';
