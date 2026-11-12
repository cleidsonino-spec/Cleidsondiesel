CREATE TABLE IF NOT EXISTS public.vehicle_intake_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service_order_id uuid NOT NULL UNIQUE REFERENCES public.service_orders(id) ON DELETE RESTRICT,
 received_at timestamptz NOT NULL DEFAULT now(),
 received_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 odometer text NOT NULL CHECK (char_length(trim(odometer)) BETWEEN 1 AND 40),
 fuel_level text NOT NULL CHECK (fuel_level IN ('vazio','1/4','1/2','3/4','cheio','nao_informado')),
 exterior_condition text NOT NULL CHECK (char_length(trim(exterior_condition)) BETWEEN 2 AND 3000),
 existing_damage text,
 accessories text,
 notes text,
 photo_urls text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_intake_records_received_at_idx ON public.vehicle_intake_records(received_at DESC);
ALTER TABLE public.vehicle_intake_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vehicle_intake_records FROM anon, authenticated;
GRANT SELECT, INSERT ON public.vehicle_intake_records TO authenticated;
GRANT ALL ON public.vehicle_intake_records TO service_role;
DROP POLICY IF EXISTS vehicle_intake_staff_read ON public.vehicle_intake_records;
CREATE POLICY vehicle_intake_staff_read ON public.vehicle_intake_records FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'secretaria'::public.app_role));
DROP POLICY IF EXISTS vehicle_intake_staff_insert ON public.vehicle_intake_records;
CREATE POLICY vehicle_intake_staff_insert ON public.vehicle_intake_records FOR INSERT TO authenticated
 WITH CHECK (received_by = auth.uid() AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'secretaria'::public.app_role)));
COMMENT ON TABLE public.vehicle_intake_records IS 'Registro de recebimento do veículo por OS. Fotografias são opcionais e armazenadas como referências URL. Registros são somente leitura após criação.';
