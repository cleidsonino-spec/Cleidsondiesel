CREATE TABLE IF NOT EXISTS public.service_order_inspection_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL UNIQUE REFERENCES public.service_orders(id) ON DELETE CASCADE,
  diagnosis text NOT NULL DEFAULT '',
  executed_parts text NOT NULL DEFAULT '',
  rejected_items text NOT NULL DEFAULT '',
  inspection_observations text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inspection_report_text_limits CHECK (
    char_length(diagnosis) <= 12000
    AND char_length(executed_parts) <= 12000
    AND char_length(rejected_items) <= 12000
    AND char_length(inspection_observations) <= 12000
  )
);

ALTER TABLE public.service_order_inspection_reports ENABLE ROW LEVEL SECURITY;

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
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR public.is_mechanic_assigned(service_order_id, auth.uid())
);

CREATE POLICY inspection_report_update_authorized
ON public.service_order_inspection_reports FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR public.is_mechanic_assigned(service_order_id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR public.is_mechanic_assigned(service_order_id, auth.uid())
);

CREATE OR REPLACE FUNCTION public.set_inspection_report_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER service_order_inspection_reports_updated_at
BEFORE UPDATE ON public.service_order_inspection_reports
FOR EACH ROW EXECUTE FUNCTION public.set_inspection_report_updated_at();
