-- Painel de desempenho dos mecânicos.
-- A consulta é protegida no banco: somente administrador e secretaria podem executá-la.

CREATE OR REPLACE FUNCTION public.staff_mechanic_performance(
  _start_date date,
  _end_date date
)
RETURNS TABLE (
  mechanic_user_id uuid,
  mechanic_name text,
  completed_orders bigint,
  labor_total numeric,
  labor_average numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado aos valores de desempenho da equipe';
  END IF;

  IF _start_date IS NULL OR _end_date IS NULL OR _end_date < _start_date THEN
    RAISE EXCEPTION 'Período de apuração inválido';
  END IF;

  RETURN QUERY
  WITH mechanics AS (
    SELECT DISTINCT
      ur.user_id,
      COALESCE(
        invitation.full_name,
        NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(u.raw_user_meta_data ->> 'name', ''),
        u.email,
        'Mecânico'
      )::text AS display_name
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN LATERAL (
      SELECT si.full_name
      FROM public.staff_invitations si
      WHERE si.accepted_user_id = ur.user_id
      ORDER BY si.used_at DESC NULLS LAST, si.created_at DESC
      LIMIT 1
    ) invitation ON true
    WHERE ur.role = 'mecanico'::public.app_role
      AND COALESCE(ur.is_active, true) = true
  ),
  latest_completions AS (
    SELECT DISTINCT ON (soc.service_order_id)
      soc.service_order_id,
      soc.mechanic_user_id,
      soc.completed_at
    FROM public.service_order_completions soc
    WHERE (soc.completed_at AT TIME ZONE 'America/Bahia')::date
      BETWEEN _start_date AND _end_date
    ORDER BY soc.service_order_id, soc.completed_at DESC
  ),
  totals AS (
    SELECT
      lc.mechanic_user_id,
      COUNT(*)::bigint AS order_count,
      ROUND(SUM(
        GREATEST(COALESCE(so.labor_value, 0), 0)
        * (1 - LEAST(GREATEST(COALESCE(so.discount_percent, 0), 0), 100) / 100.0)
      ), 2)::numeric AS amount,
      ROUND(AVG(
        GREATEST(COALESCE(so.labor_value, 0), 0)
        * (1 - LEAST(GREATEST(COALESCE(so.discount_percent, 0), 0), 100) / 100.0)
      ), 2)::numeric AS average_amount
    FROM latest_completions lc
    JOIN public.service_orders so ON so.id = lc.service_order_id
    WHERE so.status IN ('pronto', 'entregue')
      AND NOT EXISTS (
        SELECT 1
        FROM public.warranty_returns wr
        WHERE wr.return_service_order_id = so.id
      )
    GROUP BY lc.mechanic_user_id
  )
  SELECT
    m.user_id,
    m.display_name,
    COALESCE(t.order_count, 0)::bigint,
    COALESCE(t.amount, 0)::numeric,
    COALESCE(t.average_amount, 0)::numeric
  FROM mechanics m
  LEFT JOIN totals t ON t.mechanic_user_id = m.user_id
  ORDER BY COALESCE(t.amount, 0) DESC, m.display_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_mechanic_performance(date, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_mechanic_performance(date, date)
  TO authenticated;
