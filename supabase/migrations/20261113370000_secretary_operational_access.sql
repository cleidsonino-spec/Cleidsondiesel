-- Concede à secretaria o acesso operacional que a interface já oferece.
-- Mantém exclusão de OS restrita ao administrador e status controlado por RPCs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers'
      AND policyname = 'Secretaria read customers'
  ) THEN
    CREATE POLICY "Secretaria read customers"
      ON public.customers FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicles'
      AND policyname = 'Secretaria read vehicles'
  ) THEN
    CREATE POLICY "Secretaria read vehicles"
      ON public.vehicles FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_orders'
      AND policyname = 'Secretaria read service orders'
  ) THEN
    CREATE POLICY "Secretaria read service orders"
      ON public.service_orders FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_orders'
      AND policyname = 'Secretaria insert service orders'
  ) THEN
    CREATE POLICY "Secretaria insert service orders"
      ON public.service_orders FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'secretaria'::public.app_role)
        AND status = 'recebido'::public.order_status
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_orders'
      AND policyname = 'Secretaria update service orders'
  ) THEN
    CREATE POLICY "Secretaria update service orders"
      ON public.service_orders FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments'
      AND policyname = 'Secretaria read appointments'
  ) THEN
    CREATE POLICY "Secretaria read appointments"
      ON public.appointments FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments'
      AND policyname = 'Secretaria update appointments'
  ) THEN
    CREATE POLICY "Secretaria update appointments"
      ON public.appointments FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
  END IF;
END
$$;

COMMENT ON POLICY "Secretaria insert service orders" ON public.service_orders IS
  'Secretaria pode abrir OS somente no status inicial recebido; a ficha de recebimento obrigatória é aplicada pelo trigger da OS.';
COMMENT ON POLICY "Secretaria update service orders" ON public.service_orders IS
  'Secretaria pode editar campos operacionais permitidos por privilégios de coluna; mudanças de status continuam exclusivas das RPCs.';
