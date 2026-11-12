-- Mechanics receive a deliberately limited view of appointments linked
-- to service orders that are actively assigned to their own account.
CREATE OR REPLACE FUNCTION public.get_mechanic_appointment_agenda()
RETURNS TABLE (
  appointment_id uuid,
  scheduled_date date,
  scheduled_time time without time zone,
  customer_name text,
  mechanic_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = 'mecanico'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (a.id)
    a.id,
    a.scheduled_date,
    a.scheduled_time,
    a.customer_name,
    COALESCE(
      NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(BTRIM(u.raw_user_meta_data->>'name'), ''),
      (
        SELECT NULLIF(BTRIM(si.full_name), '')
        FROM public.staff_invitations si
        WHERE si.accepted_user_id = saa.mechanic_user_id
          AND si.used_at IS NOT NULL
        ORDER BY si.created_at DESC
        LIMIT 1
      ),
      'Mecânico'
    )::text
  FROM public.appointments a
  JOIN public.service_orders so
    ON so.appointment_id = a.id
  JOIN public.service_order_assignments saa
    ON saa.service_order_id = so.id
   AND saa.mechanic_user_id = auth.uid()
   AND saa.active = true
  JOIN auth.users u
    ON u.id = saa.mechanic_user_id
  WHERE a.status::text <> 'cancelado'
  ORDER BY a.id, a.scheduled_date, a.scheduled_time, so.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_mechanic_appointment_agenda() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mechanic_appointment_agenda() TO authenticated;
