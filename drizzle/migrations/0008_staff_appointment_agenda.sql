CREATE OR REPLACE FUNCTION public.get_staff_appointment_agenda()
RETURNS TABLE (
  appointment_id uuid, scheduled_date date, scheduled_time time without time zone,
  customer_name text, phone text, plate text, vehicle text, service_type text,
  notes text, appointment_status text, order_number integer, order_status text, mechanic_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'secretaria', 'mecanico')
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT a.id, a.scheduled_date, a.scheduled_time, a.customer_name, a.phone,
    a.plate, a.vehicle, a.service_type, a.notes, a.status::text,
    linked.order_number, linked.order_status,
    CASE WHEN linked.order_status IN ('pronto', 'entregue') THEN linked.mechanic_name ELSE NULL END
  FROM public.appointments a
  LEFT JOIN LATERAL (
    SELECT so.number AS order_number, so.status::text AS order_status,
      COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email) AS mechanic_name
    FROM public.service_orders so
    LEFT JOIN LATERAL (
      SELECT saa.mechanic_user_id FROM public.service_order_assignments saa
      WHERE saa.service_order_id = so.id ORDER BY saa.active DESC, saa.assigned_at DESC LIMIT 1
    ) assigned ON TRUE
    LEFT JOIN LATERAL (
      SELECT tsl.mechanic_user_id FROM public.technical_service_logs tsl
      WHERE tsl.service_order_id = so.id AND tsl.mechanic_user_id IS NOT NULL
      ORDER BY tsl.created_at DESC LIMIT 1
    ) logged ON TRUE
    LEFT JOIN auth.users u ON u.id = COALESCE(assigned.mechanic_user_id, logged.mechanic_user_id)
    WHERE so.appointment_id = a.id ORDER BY so.created_at DESC LIMIT 1
  ) linked ON TRUE
  WHERE a.status::text <> 'cancelado'
  ORDER BY a.scheduled_date DESC, a.scheduled_time DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_staff_appointment_agenda() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_appointment_agenda() TO authenticated;
