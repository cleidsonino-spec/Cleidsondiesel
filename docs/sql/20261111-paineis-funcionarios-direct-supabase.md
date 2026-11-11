# Migração direta — painéis de funcionários

Projeto: Cleidson Diesel  
Data: 2026-11-11  
Destino: Supabase PostgreSQL  
Execução: acesso SQL direto autorizado pelo proprietário, sem agente/créditos Lovable.

> Aplicar em duas etapas separadas. A etapa A adiciona valores ao enum. A etapa B cria tabelas e políticas. Não criar contas de funcionários nesta migração. Não publicar o app.

## Etapa A — executar isoladamente

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mecanico';
```

## Etapa B — executar após a etapa A

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.service_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  mechanic_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS service_order_assignments_one_active_mechanic
  ON public.service_order_assignments(service_order_id)
  WHERE active;

CREATE INDEX IF NOT EXISTS service_order_assignments_mechanic_active
  ON public.service_order_assignments(mechanic_user_id, active);

CREATE TABLE IF NOT EXISTS public.technical_service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  mechanic_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  procedure text NOT NULL CHECK (procedure IN (
    'remocao_bomba', 'remocao_bicos', 'teste_bomba', 'teste_bicos',
    'scanner', 'diagnostico_eletronico', 'reparo', 'montagem_instalacao',
    'teste_final', 'outro'
  )),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 4000),
  result text CHECK (result IS NULL OR length(result) <= 2000),
  observations text CHECK (observations IS NULL OR length(observations) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technical_service_logs_order_created
  ON public.technical_service_logs(service_order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_mechanic_assigned(_order_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_order_assignments a
    WHERE a.service_order_id = _order_id
      AND a.mechanic_user_id = _user_id
      AND a.active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_mechanic_assigned(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mechanic_assigned(uuid, uuid) TO authenticated;

ALTER TABLE public.service_order_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_service_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.service_order_assignments TO authenticated;
GRANT SELECT, INSERT ON public.technical_service_logs TO authenticated;

DROP POLICY IF EXISTS assignments_read_authorized ON public.service_order_assignments;
CREATE POLICY assignments_read_authorized
ON public.service_order_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR (mechanic_user_id = auth.uid() AND active = true)
);

DROP POLICY IF EXISTS assignments_manage_staff ON public.service_order_assignments;
CREATE POLICY assignments_manage_staff
ON public.service_order_assignments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
);

DROP POLICY IF EXISTS assignments_update_staff ON public.service_order_assignments;
CREATE POLICY assignments_update_staff
ON public.service_order_assignments FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
);

DROP POLICY IF EXISTS technical_logs_read_authorized ON public.technical_service_logs;
CREATE POLICY technical_logs_read_authorized
ON public.technical_service_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR (
    mechanic_user_id = auth.uid()
    AND public.is_mechanic_assigned(service_order_id, auth.uid())
  )
);

DROP POLICY IF EXISTS technical_logs_insert_assigned_mechanic ON public.technical_service_logs;
CREATE POLICY technical_logs_insert_assigned_mechanic
ON public.technical_service_logs FOR INSERT TO authenticated
WITH CHECK (
  mechanic_user_id = auth.uid()
  AND public.has_role(auth.uid(), 'mecanico'::public.app_role)
  AND public.is_mechanic_assigned(service_order_id, auth.uid())
);

DROP POLICY IF EXISTS service_orders_read_staff ON public.service_orders;
CREATE POLICY service_orders_read_staff
ON public.service_orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'secretaria'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'mecanico'::public.app_role)
    AND public.is_mechanic_assigned(id, auth.uid())
  )
);

DROP POLICY IF EXISTS customers_read_secretaria ON public.customers;
CREATE POLICY customers_read_secretaria
ON public.customers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS appointments_read_secretaria ON public.appointments;
CREATE POLICY appointments_read_secretaria
ON public.appointments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY appointments_read_mecanico
ON public.appointments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'mecanico'::public.app_role));

CREATE POLICY quote_approvals_read_secretaria
ON public.quote_approvals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE OR REPLACE FUNCTION public.secretaria_confirm_appointment(_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'secretaria'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar agendamentos';
  END IF;

  UPDATE public.appointments
  SET status = 'confirmado'
  WHERE id = _appointment_id
    AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou não está pendente';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.secretaria_confirm_appointment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secretaria_confirm_appointment(uuid) TO authenticated;

COMMIT;
```

## Limites desta migração

- Não cria contas nem credenciais.
- Não implementa ainda o login por nome de usuário.
- Não concede à secretária escrita direta nas tabelas comerciais.
- Não permite ao mecânico alterar a OS; ele só pode inserir apontamentos técnicos vinculados a uma OS atribuída.
- Não altera horário de funcionamento.
- Não dispara notificações de teste.
- A interface e o provisionamento seguro de funcionários precisam ser implementados e testados antes de liberar acesso.
