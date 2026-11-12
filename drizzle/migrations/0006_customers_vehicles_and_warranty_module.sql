CREATE TABLE public.customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text, email text, address text, notes text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT customer_name_not_empty CHECK (length(trim(name)) > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_admin ON public.customers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.customers(id), plate text NOT NULL UNIQUE, model text NOT NULL, year text, mileage text, notes text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT vehicle_model_not_empty CHECK (length(trim(model)) > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicles_admin ON public.vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX vehicles_customer_idx ON public.vehicles(customer_id);
CREATE TRIGGER vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE FUNCTION public.validate_registry_vehicle() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.plate := public.normalize_plate(NEW.plate); IF NEW.plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN RAISE EXCEPTION 'Placa inválida'; END IF; RETURN NEW; END $$;
CREATE TRIGGER registry_vehicle_validation BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.validate_registry_vehicle();
ALTER TABLE public.service_orders ADD COLUMN customer_id uuid REFERENCES public.customers(id), ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id);
CREATE INDEX orders_customer_idx ON public.service_orders(customer_id);
CREATE INDEX orders_vehicle_idx ON public.service_orders(vehicle_id);
CREATE FUNCTION public.validate_order_registry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = NEW.vehicle_id AND v.customer_id = NEW.customer_id AND v.plate = public.normalize_plate(NEW.plate)) THEN RAISE EXCEPTION 'O veículo deve pertencer ao cliente e corresponder à placa da OS'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_registry_validation BEFORE INSERT OR UPDATE OF customer_id, vehicle_id, plate ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_registry();
-- A tabela de garantias precisa existir antes de receber cobertura, auditoria e retornos.
-- IF NOT EXISTS preserva a tabela e os registros quando ela já existe no banco.
CREATE TABLE IF NOT EXISTS public.warranties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 service_order_id uuid NOT NULL UNIQUE REFERENCES public.service_orders(id) ON DELETE RESTRICT,
 start_date date NOT NULL,
 duration_months integer NOT NULL CHECK (duration_months BETWEEN 1 AND 120),
 end_date date NOT NULL CHECK (end_date >= start_date),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.warranties TO authenticated;
GRANT ALL ON public.warranties TO service_role;
CREATE INDEX IF NOT EXISTS warranties_service_order_idx ON public.warranties(service_order_id);
DROP TRIGGER IF EXISTS warranties_updated_at ON public.warranties;
CREATE TRIGGER warranties_updated_at BEFORE UPDATE ON public.warranties
 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.warranties ADD COLUMN coverage text NOT NULL DEFAULT '', ADD COLUMN terms text NOT NULL DEFAULT '';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranties TO authenticated;
GRANT ALL ON public.warranties TO service_role;
CREATE FUNCTION public.validate_warranty_dates() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.duration_months < 1 OR NEW.duration_months > 120 THEN RAISE EXCEPTION 'Informe um prazo entre 1 e 120 meses'; END IF;
 NEW.end_date := (NEW.start_date + make_interval(months => NEW.duration_months))::date;
 RETURN NEW;
END $$;
CREATE TRIGGER warranty_dates BEFORE INSERT OR UPDATE ON public.warranties FOR EACH ROW EXECUTE FUNCTION public.validate_warranty_dates();
CREATE OR REPLACE FUNCTION public.lookup_vehicle(_plate text) RETURNS TABLE(vehicle text, vehicle_year text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT x.vehicle, x.vehicle_year FROM (
 SELECT v.model AS vehicle, v.year AS vehicle_year, 1 AS priority, v.updated_at AS date_value FROM public.vehicles v WHERE v.plate = public.normalize_plate(_plate)
 UNION ALL SELECT o.vehicle, o.vehicle_year, 0, o.created_at FROM public.service_orders o WHERE o.plate = public.normalize_plate(_plate)
 UNION ALL SELECT a.vehicle, NULL::text, 0, a.created_at FROM public.appointments a WHERE a.plate = public.normalize_plate(_plate)
 ) x ORDER BY x.priority DESC, x.date_value DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lookup_vehicle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_vehicle(text) TO anon, authenticated;
