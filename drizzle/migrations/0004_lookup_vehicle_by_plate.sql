-- Public vehicle lookup by plate: returns only vehicle model and year (no phone, no values)
CREATE OR REPLACE FUNCTION public.lookup_vehicle(_plate text)
RETURNS TABLE (
  vehicle text,
  vehicle_year text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.vehicle, v.vehicle_year FROM (
    SELECT o.vehicle, o.vehicle_year, o.entry_date AS sort_date, o.number AS sort_num
    FROM public.service_orders o
    WHERE char_length(public.normalize_plate(_plate)) >= 7
      AND o.plate = public.normalize_plate(_plate)
    UNION ALL
    SELECT a.vehicle, NULL::text, a.scheduled_date, 0
    FROM public.appointments a
    WHERE char_length(public.normalize_plate(_plate)) >= 7
      AND a.plate = public.normalize_plate(_plate)
  ) v
  ORDER BY v.sort_date DESC, v.sort_num DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.lookup_vehicle(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_vehicle(text) TO anon, authenticated;