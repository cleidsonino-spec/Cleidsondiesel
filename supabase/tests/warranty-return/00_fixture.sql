-- Synthetic-only schema for CI. Never points to the production Supabase project.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TYPE public.app_role AS ENUM ('admin', 'secretaria', 'mecanico', 'user');
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role AND active)
$$;
CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigserial UNIQUE,
  customer_id uuid,
  vehicle_id uuid,
  customer_name text NOT NULL DEFAULT 'Cliente teste',
  phone text,
  vehicle text NOT NULL DEFAULT 'Veículo teste',
  vehicle_year text,
  plate text,
  mileage text,
  complaint text NOT NULL DEFAULT 'Falha teste',
  diagnosis text,
  parts text,
  part_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  parts_value numeric NOT NULL DEFAULT 0,
  labor_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'recebido',
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  notes text,
  inspection_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id),
  duration_months integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  coverage text,
  terms text
);
CREATE TABLE public.service_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id),
  mechanic_user_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);
-- Regra real do banco: somente um mecânico ativo por OS.
CREATE UNIQUE INDEX service_order_assignments_one_active_mechanic
  ON public.service_order_assignments(service_order_id)
  WHERE active;
CREATE OR REPLACE FUNCTION public.is_mechanic_assigned(_order_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.service_order_assignments
    WHERE service_order_id=_order_id AND mechanic_user_id=_user_id AND active)
$$;
CREATE TABLE public.technical_service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id),
  mechanic_user_id uuid,
  procedure text,
  description text,
  result text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mechanic_assigned(uuid, uuid) TO authenticated;
