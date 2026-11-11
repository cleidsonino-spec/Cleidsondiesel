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


## Etapa C — permissões operacionais adicionais (aplicada em 2026-11-10)

```sql
BEGIN;

DROP POLICY IF EXISTS "Anyone can request appointment" ON public.appointments;
CREATE POLICY "Anyone can request appointment" ON public.appointments FOR INSERT TO anon WITH CHECK (status = 'pendente'::public.appointment_status);

DROP POLICY IF EXISTS "Secretaria insert orders" ON public.service_orders;
CREATE POLICY "Secretaria insert orders" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "Secretaria update orders" ON public.service_orders;
CREATE POLICY "Secretaria update orders" ON public.service_orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'secretaria'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "Secretaria manage customers" ON public.customers;
CREATE POLICY "Secretaria manage customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "Secretaria update customers" ON public.customers;
CREATE POLICY "Secretaria update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'secretaria'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "Secretaria read vehicles" ON public.vehicles;
CREATE POLICY "Secretaria read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));

COMMIT;
```

### Resultado e limites da etapa C

- A política de solicitação pública de agendamento agora vale somente para `anon`; usuários autenticados com papel de mecânico não conseguem inserir agendamentos por essa política.
- Mecânicos continuam com SELECT na agenda completa, sem INSERT, UPDATE ou DELETE.
- Secretária pode inserir e atualizar OS; exclusão continua restrita ao administrador.
- Secretária pode inserir e atualizar clientes e consultar veículos.
- Mecânico continua sem INSERT/UPDATE/DELETE em `service_orders`, `customers` ou `vehicles`.
- Atribuição de OS e registro técnico mantêm as políticas da etapa B.
- Login individual, telas e provisionamento seguro de contas ainda não estão implementados.


## Etapa D — atribuição, apontamentos e conferência técnica (aplicada em 2026-11-10)

```sql
BEGIN;
CREATE OR REPLACE FUNCTION public.staff_assign_service_order(_service_order_id uuid, _mechanic_user_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE _assignment_id uuid; BEGIN IF auth.uid() IS NULL OR (NOT public.has_role(auth.uid(),'admin'::public.app_role) AND NOT public.has_role(auth.uid(),'secretaria'::public.app_role)) THEN RAISE EXCEPTION 'Sem permissão para atribuir ordem de serviço'; END IF; IF NOT EXISTS (SELECT 1 FROM public.service_orders WHERE id=_service_order_id) THEN RAISE EXCEPTION 'Ordem de serviço não encontrada'; END IF; IF NOT public.has_role(_mechanic_user_id,'mecanico'::public.app_role) THEN RAISE EXCEPTION 'O usuário selecionado não possui perfil de mecânico'; END IF; UPDATE public.service_order_assignments SET active=false WHERE service_order_id=_service_order_id AND active=true; INSERT INTO public.service_order_assignments(service_order_id,mechanic_user_id,assigned_by,active) VALUES(_service_order_id,_mechanic_user_id,auth.uid(),true) RETURNING id INTO _assignment_id; RETURN _assignment_id; END; $$;
CREATE OR REPLACE FUNCTION public.mechanic_add_technical_log(_service_order_id uuid,_procedure text,_description text,_result text DEFAULT NULL,_observations text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE _log_id uuid; BEGIN IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'mecanico'::public.app_role) OR NOT public.is_mechanic_assigned(_service_order_id,auth.uid()) THEN RAISE EXCEPTION 'Você não está atribuído a esta ordem de serviço'; END IF; IF length(trim(coalesce(_procedure,'')))=0 OR length(trim(coalesce(_description,'')))=0 THEN RAISE EXCEPTION 'Procedimento e descrição são obrigatórios'; END IF; INSERT INTO public.technical_service_logs(service_order_id,mechanic_user_id,procedure,description,result,observations) VALUES(_service_order_id,auth.uid(),trim(_procedure),trim(_description),nullif(trim(coalesce(_result,'')),''),nullif(trim(coalesce(_observations,'')),'')) RETURNING id INTO _log_id; RETURN _log_id; END; $$;
CREATE TABLE IF NOT EXISTS public.verified_service_procedures(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,technical_log_id uuid NOT NULL UNIQUE REFERENCES public.technical_service_logs(id) ON DELETE RESTRICT,reviewed_by uuid NOT NULL DEFAULT auth.uid(),procedure text NOT NULL,description text NOT NULL,result text,observations text,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.verified_service_procedures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verified_procedures_read_staff ON public.verified_service_procedures;
CREATE POLICY verified_procedures_read_staff ON public.verified_service_procedures FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'secretaria'::public.app_role));
CREATE OR REPLACE FUNCTION public.staff_verify_technical_log(_technical_log_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE _log public.technical_service_logs%ROWTYPE; _verified_id uuid; BEGIN IF auth.uid() IS NULL OR (NOT public.has_role(auth.uid(),'admin'::public.app_role) AND NOT public.has_role(auth.uid(),'secretaria'::public.app_role)) THEN RAISE EXCEPTION 'Somente administrador ou secretária pode conferir procedimentos'; END IF; SELECT * INTO _log FROM public.technical_service_logs WHERE id=_technical_log_id; IF NOT FOUND THEN RAISE EXCEPTION 'Registro técnico não encontrado'; END IF; INSERT INTO public.verified_service_procedures(service_order_id,technical_log_id,reviewed_by,procedure,description,result,observations) VALUES(_log.service_order_id,_log.id,auth.uid(),_log.procedure,_log.description,_log.result,_log.observations) RETURNING id INTO _verified_id; RETURN _verified_id; END; $$;
REVOKE ALL ON FUNCTION public.staff_assign_service_order(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mechanic_add_technical_log(uuid,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.staff_verify_technical_log(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_assign_service_order(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mechanic_add_technical_log(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_verify_technical_log(uuid) TO authenticated;
COMMIT;
```

### Verificação da etapa D

- As três funções existem como `SECURITY DEFINER`; execução concedida a `authenticated` e negada a `anon`.
- Atribuição exige administrador/secretária, OS existente e usuário com papel `mecanico`; desativa atribuição ativa anterior e cria a nova.
- Registro técnico exige papel `mecanico` e atribuição ativa do usuário à OS; os logs não ficam legíveis para mecânicos.
- Conferência exige administrador/secretária e copia o log para `verified_service_procedures`; cada log pode ser conferido uma única vez.
- A tabela de procedimentos conferidos tem SELECT apenas para administrador/secretária.
- Não foram inseridos registros de teste, criadas contas, alteradas notificações ou realizadas publicações.
- A integração dessas funções às telas e a exibição/impressão dos procedimentos conferidos ainda precisam ser implementadas no frontend.


## Etapa E — resumo de serviços por mecânico (aplicada em 2026-11-10)

```sql
CREATE OR REPLACE FUNCTION public.staff_mechanic_service_counts()
RETURNS TABLE (mechanic_user_id uuid, mechanic_name text, assigned_orders bigint, active_orders bigint, completed_orders bigint, technical_entries bigint, verified_procedures bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR (NOT public.has_role(auth.uid(),'admin'::public.app_role) AND NOT public.has_role(auth.uid(),'secretaria'::public.app_role)) THEN RAISE EXCEPTION 'Somente administrador ou secretária pode consultar a produção dos mecânicos'; END IF;
 RETURN QUERY SELECT ur.user_id, COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''),NULLIF(u.raw_user_meta_data->>'name',''),NULLIF(u.email,''),'Mecânico sem nome')::text,
 COUNT(DISTINCT a.service_order_id) FILTER (WHERE a.active=true),
 COUNT(DISTINCT a.service_order_id) FILTER (WHERE a.active=true AND so.status IN ('recebido','em_analise','aguardando_aprovacao','em_servico')),
 COUNT(DISTINCT a.service_order_id) FILTER (WHERE a.active=true AND so.status IN ('pronto','entregue')),
 COUNT(DISTINCT l.id), COUNT(DISTINCT v.id)
 FROM public.user_roles ur JOIN auth.users u ON u.id=ur.user_id
 LEFT JOIN public.service_order_assignments a ON a.mechanic_user_id=ur.user_id AND a.active=true
 LEFT JOIN public.service_orders so ON so.id=a.service_order_id
 LEFT JOIN public.technical_service_logs l ON l.mechanic_user_id=ur.user_id
 LEFT JOIN public.verified_service_procedures v ON v.technical_log_id=l.id
 WHERE ur.role='mecanico'::public.app_role GROUP BY ur.user_id,u.raw_user_meta_data,u.email
 ORDER BY COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''),NULLIF(u.raw_user_meta_data->>'name',''),NULLIF(u.email,''),'Mecânico sem nome');
END; $$;
REVOKE ALL ON FUNCTION public.staff_mechanic_service_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_mechanic_service_counts() TO authenticated;
```

### Colunas retornadas

- `assigned_orders`: OS atualmente atribuídas ao mecânico.
- `active_orders`: OS atribuídas ainda em andamento (recebido, em análise, aguardando aprovação ou em serviço).
- `completed_orders`: OS atribuídas com status pronto ou entregue.
- `technical_entries`: registros técnicos feitos pelo mecânico.
- `verified_procedures`: procedimentos desses registros que foram conferidos pela secretaria/administração.

A função valida o papel admin/secretaria internamente. Execução foi verificada para `authenticated` e negada a `anon`. Para preencher o painel, o frontend chama `supabase.rpc('staff_mechanic_service_counts')`. A integração das telas foi implementada na branch de trabalho; ainda depende de validação com contas reais e não foi publicada.


## Etapa F — conclusão de agendamento e emissão de orçamento pela secretaria

Aplicada diretamente no Supabase em 2026-11-11:

- Criada `public.secretaria_complete_appointment(_appointment_id uuid)`, SECURITY DEFINER, que exige administrador ou secretária e muda somente agendamentos pendentes/confirmados para concluído.
- A função não permite que mecânicos ou usuários comuns alterem agendamentos.
- Atualizada `public.issue_quote_approval(_order_id uuid)` para permitir administrador ou secretária. A função continua validando o papel internamente e bloqueia OS canceladas, entregues ou prontas.
- Execução concedida a `authenticated`; negada a `anon` e `PUBLIC`.

## Integração frontend na branch feature/painel-funcionario-secretaria

- Painel do mecânico com lista de OS atribuídas via RLS, detalhe somente leitura e formulário para registrar procedimento, resultado e observações por RPC.
- Agenda completa para mecânicos somente para consulta; telefone e ação de WhatsApp ficam ocultos para esse perfil.
- Ferramenta de atribuição/transferência de OS para administrador e secretária.
- Registros técnicos visíveis somente para administrador e secretária; conferência por RPC e inclusão dos procedimentos conferidos na impressão da OS.
- Rotas comerciais protegidas contra acesso direto por mecânicos.
- Cadastro de clientes: secretária pode criar/editar, mas não excluir; veículos ficam somente para consulta pela secretária; garantias permanecem exclusivas do administrador.
- Ao criar OS a partir de agendamento, a conclusão do agendamento usa a RPC autorizada, não UPDATE direto.
- Logout de funcionário não tenta remover registro de dispositivo push do administrador.

## Validação realizada

- Vitest e build de produção passaram no GitHub Actions para o commit `93fab0aa289713cd243cd6cfdbf66d03ad0b54c4`.
- As funções de equipe foram verificadas como SECURITY DEFINER, EXECUTE permitido a `authenticated` e negado a `anon`.
- Política de solicitação pública de agendamento verificada como INSERT exclusivo para `anon`, com status inicial pendente.
- Nenhuma conta de secretaria ou mecânico foi criada. O login por nome de usuário e senha ainda não está implementado; a tela atual usa e-mail/senha e provedores OAuth. Não provisionar funcionários até implementar um fluxo de autenticação de servidor seguro. Teste visual com contas reais ainda pendente.
- Nenhum deploy foi feito.
