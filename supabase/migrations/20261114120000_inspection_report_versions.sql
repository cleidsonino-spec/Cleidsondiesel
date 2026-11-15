-- Permite manter o histórico de relatórios técnicos por OS sem sobrescrever versões aprovadas.
ALTER TABLE public.service_order_inspection_reports
  ADD COLUMN IF NOT EXISTS version integer;

UPDATE public.service_order_inspection_reports
SET version = 1
WHERE version IS NULL;

ALTER TABLE public.service_order_inspection_reports
  ALTER COLUMN version SET DEFAULT 1,
  ALTER COLUMN version SET NOT NULL;

ALTER TABLE public.service_order_inspection_reports
  DROP CONSTRAINT IF EXISTS service_order_inspection_reports_service_order_id_key;

ALTER TABLE public.service_order_inspection_reports
  ADD CONSTRAINT inspection_report_version_positive CHECK (version > 0);

CREATE UNIQUE INDEX IF NOT EXISTS inspection_report_service_order_version_uidx
  ON public.service_order_inspection_reports (service_order_id, version);

CREATE OR REPLACE FUNCTION public.assign_inspection_report_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'A versão do relatório técnico é imutável';
    END IF;
    RETURN NEW;
  END IF;

  -- Serializa novas versões da mesma OS para evitar números duplicados em inserções concorrentes.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.service_order_id::text, 0));

  SELECT COALESCE(MAX(r.version), 0) + 1
    INTO NEW.version
  FROM public.service_order_inspection_reports r
  WHERE r.service_order_id = NEW.service_order_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS service_order_inspection_reports_00_version
  ON public.service_order_inspection_reports;

CREATE TRIGGER service_order_inspection_reports_00_version
BEFORE INSERT OR UPDATE ON public.service_order_inspection_reports
FOR EACH ROW
EXECUTE FUNCTION public.assign_inspection_report_version();

-- A emissão continua restrita à administração/secretaria e usa a versão aprovada mais recente.
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
    AND r.status = 'approved'
  ORDER BY r.version DESC
  LIMIT 1;

  IF report_data IS NULL THEN
    RAISE EXCEPTION 'Não existe relatório aprovado para esta ordem de serviço';
  END IF;

  RETURN report_data;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_approved_inspection_report_for_pdf(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_approved_inspection_report_for_pdf(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_approved_inspection_report_for_pdf(uuid) TO authenticated;
