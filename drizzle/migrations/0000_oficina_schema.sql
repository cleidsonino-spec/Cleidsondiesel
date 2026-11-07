-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- First account becomes admin (shop owner)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Plate normalization helper
CREATE OR REPLACE FUNCTION public.normalize_plate(_p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT upper(regexp_replace(coalesce(_p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Appointments
CREATE TYPE public.appointment_status AS ENUM ('pendente', 'confirmado', 'concluido', 'cancelado');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 8 AND 30),
  plate text NOT NULL CHECK (char_length(plate) BETWEEN 7 AND 8),
  vehicle text NOT NULL CHECK (char_length(vehicle) BETWEEN 2 AND 120),
  service_type text NOT NULL CHECK (char_length(service_type) BETWEEN 2 AND 120),
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  status public.appointment_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can request appointment" ON public.appointments FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pendente');
CREATE POLICY "Admins read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.plate := public.normalize_plate(NEW.plate);
  IF TG_OP = 'INSERT' AND NEW.scheduled_date < current_date THEN
    RAISE EXCEPTION 'A data do agendamento não pode estar no passado';
  END IF;
  IF TG_OP = 'INSERT' AND EXTRACT(DOW FROM NEW.scheduled_date) = 0 THEN
    RAISE EXCEPTION 'Não atendemos aos domingos';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointments_validate BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX appointments_slot_unique ON public.appointments (scheduled_date, scheduled_time)
  WHERE status <> 'cancelado';
CREATE INDEX appointments_plate_idx ON public.appointments (plate);

-- Occupied time slots (public, no personal data)
CREATE OR REPLACE FUNCTION public.booked_slots(_date date)
RETURNS SETOF time LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT scheduled_time FROM public.appointments
  WHERE scheduled_date = _date AND status <> 'cancelado'
$$;
REVOKE ALL ON FUNCTION public.booked_slots(date) FROM public;
GRANT EXECUTE ON FUNCTION public.booked_slots(date) TO anon, authenticated;

-- Service orders
CREATE TYPE public.order_status AS ENUM ('recebido', 'em_analise', 'aguardando_aprovacao', 'em_servico', 'pronto', 'entregue', 'cancelado');

CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number serial UNIQUE,
  plate text NOT NULL CHECK (char_length(plate) BETWEEN 7 AND 8),
  customer_name text NOT NULL,
  phone text,
  vehicle text NOT NULL,
  vehicle_year text,
  mileage text,
  complaint text NOT NULL,
  diagnosis text,
  parts text,
  parts_value numeric(12,2) NOT NULL DEFAULT 0,
  labor_value numeric(12,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'recebido',
  entry_date date NOT NULL DEFAULT current_date,
  due_date date,
  notes text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.service_orders_number_seq TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read orders" ON public.service_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert orders" ON public.service_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update orders" ON public.service_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete orders" ON public.service_orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.normalize_order_plate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.plate := public.normalize_plate(NEW.plate);
  RETURN NEW;
END;
$$;
CREATE TRIGGER service_orders_plate BEFORE INSERT OR UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.normalize_order_plate();
CREATE TRIGGER service_orders_updated_at BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX service_orders_plate_idx ON public.service_orders (plate);

-- Public lookup by plate: limited fields only (no phone, no values)
CREATE OR REPLACE FUNCTION public.lookup_plate(_plate text)
RETURNS TABLE (
  number integer,
  status public.order_status,
  vehicle text,
  complaint text,
  entry_date date,
  due_date date,
  updated_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.number, o.status, o.vehicle, o.complaint, o.entry_date, o.due_date, o.updated_at
  FROM public.service_orders o
  WHERE char_length(public.normalize_plate(_plate)) >= 7
    AND o.plate = public.normalize_plate(_plate)
  ORDER BY o.entry_date DESC, o.number DESC
  LIMIT 10
$$;
REVOKE ALL ON FUNCTION public.lookup_plate(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_plate(text) TO anon, authenticated;
