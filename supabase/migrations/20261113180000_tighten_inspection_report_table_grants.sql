-- Restrict table-level grants to the authenticated workflow only.
-- RLS still determines which rows each authenticated user may access.
REVOKE ALL ON TABLE public.service_order_inspection_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.service_order_inspection_reports TO authenticated;
