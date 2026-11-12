-- Keep fresh database installations aligned with the staff authorization
-- functions and generated Supabase types, which use these two staff roles.
-- Existing installations where the values are already present remain valid.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mecanico';
