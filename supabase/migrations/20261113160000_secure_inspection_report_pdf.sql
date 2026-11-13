-- Autoriza a emissão somente para administração/secretaria e entrega dados já aprovados.
CREATE OR REPLACE FUNCTION public.get_approved_inspection_report_for_pdf(_service_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  report_data jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Somente administração ou secretaria pode emitir o relatório';
  END IF;

  SELECT jsonb_build_object(
    'diagnosis', r.diagnosis,
    'executed_parts', r.executed_parts,
    'rejected_items', r.rejected_items,
    'inspection_observations', r.inspection_observations
  )
  INTO report_data
  FROM public.service_order_inspection_reports r
  WHERE r.service_order_id = _service_order_id
    AND r.status = 'approved';

  IF report_data IS NULL THEN
    RAISE EXCEPTION 'Não existe relatório aprovado para esta ordem de serviço';
  END IF;

  RETURN report_data;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_approved_inspection_report_for_pdf(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_approved_inspection_report_for_pdf(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_approved_inspection_report_for_pdf(uuid) TO authenticated;
