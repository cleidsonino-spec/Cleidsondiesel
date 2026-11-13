-- Workflow de revisão do relatório técnico, sem alterar orçamento ou OS.
ALTER TABLE public.service_order_inspection_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';

ALTER TABLE public.service_order_inspection_reports
  ADD CONSTRAINT inspection_report_status_check
  CHECK (status IN ('draft', 'pending_review', 'approved', 'returned'));

ALTER TABLE public.service_order_inspection_reports
  ADD CONSTRAINT inspection_report_review_note_limit
  CHECK (char_length(review_note) <= 4000);

DROP POLICY IF EXISTS inspection_report_select_authorized ON public.service_order_inspection_reports;
DROP POLICY IF EXISTS inspection_report_insert_authorized ON public.service_order_inspection_reports;
DROP POLICY IF EXISTS inspection_report_update_authorized ON public.service_order_inspection_reports;

CREATE POLICY inspection_report_select_authorized
ON public.service_order_inspection_reports FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR public.is_mechanic_assigned(service_order_id, auth.uid())
);

CREATE POLICY inspection_report_insert_authorized
ON public.service_order_inspection_reports FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    OR public.is_mechanic_assigned(service_order_id, auth.uid()))
  AND status IN ('draft', 'pending_review')
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);

CREATE POLICY inspection_report_update_authorized
ON public.service_order_inspection_reports FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR (public.is_mechanic_assigned(service_order_id, auth.uid()) AND status IN ('draft', 'returned'))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR (public.is_mechanic_assigned(service_order_id, auth.uid()) AND status IN ('draft', 'pending_review'))
);

CREATE OR REPLACE FUNCTION public.enforce_inspection_report_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin_or_secretary boolean;
  is_assigned_mechanic boolean;
BEGIN
  is_admin_or_secretary :=
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role);
  is_assigned_mechanic := public.is_mechanic_assigned(NEW.service_order_id, auth.uid());

  IF TG_OP = 'INSERT' THEN
    IF NOT (is_admin_or_secretary OR is_assigned_mechanic) THEN
      RAISE EXCEPTION 'Sem permissão para criar relatório desta OS';
    END IF;
    IF NEW.status NOT IN ('draft', 'pending_review') OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Estado inicial inválido para relatório';
    END IF;
    IF NEW.status = 'pending_review' THEN
      NEW.submitted_by := auth.uid();
      NEW.submitted_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Depois de aprovado, o conteúdo e o estado ficam imutáveis.
  -- Uma correção posterior exige um fluxo explícito de reabertura, ainda não habilitado.
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Relatório aprovado não pode ser alterado';
  END IF;

  IF is_admin_or_secretary THEN
    IF NEW.status IN ('approved', 'returned') AND OLD.status <> 'pending_review' THEN
      RAISE EXCEPTION 'Somente um relatório aguardando revisão pode ser aprovado ou devolvido';
    END IF;
    IF NEW.status = 'approved' THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
      NEW.review_note := '';
    ELSIF NEW.status = 'returned' THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    ELSE
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
      IF NEW.status = 'pending_review' AND OLD.status <> 'pending_review' THEN
        NEW.submitted_by := auth.uid();
        NEW.submitted_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT is_assigned_mechanic THEN
    RAISE EXCEPTION 'Sem permissão para alterar este relatório';
  END IF;
  IF OLD.status NOT IN ('draft', 'returned') THEN
    RAISE EXCEPTION 'Relatório enviado ou aprovado não pode ser alterado pelo mecânico';
  END IF;
  IF NEW.status NOT IN ('draft', 'pending_review') THEN
    RAISE EXCEPTION 'O mecânico não pode aprovar nem devolver o relatório';
  END IF;
  IF NEW.status = 'pending_review' THEN
    NEW.submitted_by := auth.uid();
    NEW.submitted_at := now();
  END IF;
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.review_note := '';
  RETURN NEW;
END;
$function$;
