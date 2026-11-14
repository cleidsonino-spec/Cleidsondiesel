-- Ficha de recebimento independente da ordem de serviço.
CREATE TABLE IF NOT EXISTS public.vehicle_intake_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL CHECK (char_length(trim(customer_name)) BETWEEN 2 AND 160),
  vehicle text NOT NULL CHECK (char_length(trim(vehicle)) BETWEEN 2 AND 160),
  plate text NOT NULL CHECK (char_length(trim(plate)) BETWEEN 5 AND 12),
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  received_by_name text NOT NULL CHECK (char_length(trim(received_by_name)) BETWEEN 2 AND 160),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_intake_records_received_at_idx
  ON public.vehicle_intake_records(received_at DESC);
ALTER TABLE public.vehicle_intake_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vehicle_intake_records FROM anon, authenticated;
GRANT SELECT, INSERT ON public.vehicle_intake_records TO authenticated;
GRANT ALL ON public.vehicle_intake_records TO service_role;
DROP POLICY IF EXISTS vehicle_intake_staff_read ON public.vehicle_intake_records;
CREATE POLICY vehicle_intake_staff_read
  ON public.vehicle_intake_records FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );
DROP POLICY IF EXISTS vehicle_intake_staff_insert ON public.vehicle_intake_records;
CREATE POLICY vehicle_intake_staff_insert
  ON public.vehicle_intake_records FOR INSERT TO authenticated
  WITH CHECK (
    received_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    )
  );
COMMENT ON TABLE public.vehicle_intake_records IS
  'Ficha simples e independente de recebimento do veículo; observações opcionais.';
