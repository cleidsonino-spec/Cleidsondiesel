-- Mecânicos só podem consultar a ficha vinculada às OS que estão atribuídas a eles.
DROP POLICY IF EXISTS vehicle_intake_assigned_mechanic_read
  ON public.vehicle_intake_records;

CREATE POLICY vehicle_intake_assigned_mechanic_read
  ON public.vehicle_intake_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.service_orders AS so
      WHERE so.vehicle_intake_id = vehicle_intake_records.id
        AND public.is_mechanic_assigned(so.id, auth.uid())
    )
  );
