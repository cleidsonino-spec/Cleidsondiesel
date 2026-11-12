-- Allow the workshop administrator to deactivate/reactivate staff accounts
-- without deleting users, roles, assignments, appointments or service history.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- Central role check: a deactivated staff role no longer grants authorization.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ur.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_staff_accounts()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  deactivated_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    COALESCE(
      NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(BTRIM(u.raw_user_meta_data->>'name'), ''),
      NULLIF(BTRIM(inv.full_name), ''),
      u.email
    )::text,
    u.email::text,
    ur.role::text,
    ur.is_active,
    ur.deactivated_at,
    u.created_at
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN LATERAL (
    SELECT si.full_name
    FROM public.staff_invitations si
    WHERE si.accepted_user_id = ur.user_id
      AND si.used_at IS NOT NULL
    ORDER BY si.created_at DESC
    LIMIT 1
  ) inv ON true
  WHERE ur.role IN ('mecanico'::public.app_role, 'secretaria'::public.app_role)
  ORDER BY ur.is_active DESC, u.created_at DESC, 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_staff_active(
  _staff_user_id uuid,
  _active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  affected_rows integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  IF _staff_user_id IS NULL OR _active IS NULL OR _staff_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Solicitação inválida';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _staff_user_id
      AND role = 'admin'::public.app_role
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'A conta administradora não pode ser desativada por esta função';
  END IF;

  UPDATE public.user_roles
  SET is_active = _active,
      deactivated_at = CASE WHEN _active THEN NULL ELSE now() END
  WHERE user_id = _staff_user_id
    AND role IN ('mecanico'::public.app_role, 'secretaria'::public.app_role);

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_staff_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_accounts() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_staff_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_active(uuid, boolean) TO authenticated;

-- These SECURITY DEFINER agenda RPCs previously checked user_roles directly,
-- bypassing the centralized active-role check. Keep their output unchanged.
CREATE OR REPLACE FUNCTION public.get_staff_appointment_agenda()
RETURNS TABLE (
  appointment_id uuid,
  scheduled_date date,
  scheduled_time time without time zone,
  customer_name text,
  phone text,
  plate text,
  vehicle text,
  service_type text,
  notes text,
  appointment_status text,
  order_number integer,
  order_status text,
  mechanic_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.scheduled_date,
    a.scheduled_time,
    a.customer_name,
    a.phone,
    a.plate,
    a.vehicle,
    a.service_type,
    a.notes,
    a.status::text,
    linked.order_number,
    linked.order_status,
    CASE
      WHEN linked.order_status IN ('pronto', 'entregue') THEN linked.mechanic_name
      ELSE NULL
    END
  FROM public.appointments a
  LEFT JOIN LATERAL (
    SELECT
      so.number AS order_number,
      so.status::text AS order_status,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        u.email
      ) AS mechanic_name
    FROM public.service_orders so
    LEFT JOIN LATERAL (
      SELECT saa.mechanic_user_id
      FROM public.service_order_assignments saa
      WHERE saa.service_order_id = so.id
      ORDER BY saa.active DESC, saa.assigned_at DESC
      LIMIT 1
    ) assigned ON TRUE
    LEFT JOIN LATERAL (
      SELECT tsl.mechanic_user_id
      FROM public.technical_service_logs tsl
      WHERE tsl.service_order_id = so.id
        AND tsl.mechanic_user_id IS NOT NULL
      ORDER BY tsl.created_at DESC
      LIMIT 1
    ) logged ON TRUE
    LEFT JOIN auth.users u
      ON u.id = COALESCE(assigned.mechanic_user_id, logged.mechanic_user_id)
    WHERE so.appointment_id = a.id
    ORDER BY so.created_at DESC
    LIMIT 1
  ) linked ON TRUE
  WHERE a.status::text <> 'cancelado'
  ORDER BY a.scheduled_date DESC, a.scheduled_time DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_appointment_agenda() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_appointment_agenda() TO authenticated;

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
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'mecanico'::public.app_role) THEN
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
  JOIN auth.users u
    ON u.id = saa.mechanic_user_id
  WHERE a.status::text <> 'cancelado'
    AND so.status::text <> 'cancelado'
    AND (
      a.scheduled_date < CURRENT_DATE
      OR (
        saa.active = true
        AND so.status::text NOT IN ('pronto', 'entregue', 'cancelado')
      )
    )
  ORDER BY a.id, a.scheduled_date, a.scheduled_time, saa.assigned_at DESC, so.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_mechanic_appointment_agenda() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mechanic_appointment_agenda() TO authenticated;
