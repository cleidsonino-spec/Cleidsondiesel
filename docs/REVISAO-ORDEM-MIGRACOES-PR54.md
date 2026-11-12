# Revisão da ordem de migrações — PR #54

Data da revisão: 2026-11-12  
Branch: `integration/modulos-oficina-main`  
Commit analisado: `2a78b871f721c25a5b7e53b5b6b5f317c7301985`  
PR: https://github.com/cleidsonino-spec/Cleidsondiesel/pull/54

## Resultado

As migrações do projeto estão divididas entre `drizzle/migrations/` e `supabase/migrations/`. Não existe no `package.json` um comando de migração nem um script de CI que execute essas duas pastas em conjunto. O `drizzle.config.ts` apenas configura o Drizzle Kit com a variável `LOVABLE_DB_MIGRATION_URL`; isso não demonstra que a cadeia seja executada automaticamente.

O workflow `Deploy Cleidson Diesel push functions` é manual e publica Edge Functions. Ele não executa migrações SQL. Os workflows de validação fazem build do aplicativo, não validam o schema do banco.

**Conclusão: não há evidência versionada de um executor único que garanta a ordem entre Drizzle e Supabase. Não executar as duas pastas em lote nem presumir que a ordem alfabética/timestamp resolva as dependências.**

## Dependências cruzadas confirmadas

| Arquivo | Dependência relevante |
|---|---|
| `drizzle/migrations/0000_oficina_schema.sql` | Cria `app_role`, `has_role`, `service_orders` e `appointments`. |
| `drizzle/migrations/0006_customers_vehicles_and_warranty_module.sql` | A auditoria anterior já identificou que altera `public.warranties` sem haver criação dessa tabela na cadeia Drizzle versionada. Bloqueio para instalação limpa até reconciliar o schema. |
| `supabase/migrations/20261110170000_cloudflare_push_triggers.sql` | Cria o schema `push` e `push.notify_worker_on_change()`; depende de `net`, Vault e do segredo privado `push_webhook_secret`. |
| `drizzle/migrations/0007_push_extra_events.sql` | Usa `push.notify_worker_on_change()`, `push.notification_events`, `public.quote_approvals`, `public.service_orders`, `public.appointments`, `public.valid_cpf`, `public.quote_snapshot` e `pg_cron`. Portanto, não pode ser tratado como independente da migração Supabase de push. |
| `supabase/migrations/20261111180000_add_staff_roles.sql` | Altera `public.app_role`, que é criada na migração Drizzle 0000. |
| `supabase/migrations/20261111180500_create_mechanic_core_tables.sql` | Cria `service_order_assignments`, `technical_service_logs` e `is_mechanic_assigned`; depende de `service_orders`, `app_role` e `has_role`. |
| `drizzle/migrations/0008_staff_appointment_agenda.sql` | Consulta `service_order_assignments` e `technical_service_logs`; exige as estruturas da migração Supabase 20261111180500 antes de ser executada. |
| `supabase/migrations/20261111182000_diagnosis_quote_workflow.sql` | Usa as tabelas e funções de atribuição/histórico técnico e o fluxo de orçamento já existente. |
| `supabase/migrations/20261111221000_diagnosis_and_service_assignment.sql` | Usa `staff_invitations` e o status `aprovado_aguardando_encaminhamento`, criados/introduzidos por migrações Supabase anteriores na sequência. |
| `supabase/migrations/20261112090000_diagnosis_push_notification.sql` | Substitui a função de push e consulta atribuições e convites de equipe; requer essas estruturas prévias. |
| `supabase/migrations/20261112120000_record_mechanic_service_completion.sql` | Depende de `service_order_assignments` e `is_mechanic_assigned`. |

O journal do Drizzle inclui as migrações 0000 a 0008. Isso registra a sequência interna do Drizzle, mas não representa nem coordena a sequência Supabase.

## Bloqueios que permanecem

1. Resolver a tabela `public.warranties` ausente na cadeia Drizzle versionada antes de considerar uma instalação limpa.
2. Reconciliar as colunas `customers.customer_type` e `customers.document` já apontadas pela auditoria anterior.
3. Confirmar a disponibilidade das extensões `pg_net` e `pg_cron`, dos schemas `vault` e `net`, e do segredo privado do Worker antes de ativar push.
4. Validar os pré-requisitos e o schema de destino para todas as RPCs, triggers, enums e políticas RLS.
5. Definir um procedimento de execução que intercale as duas cadeias conforme as dependências reais, com preflight e interrupção imediata em erro.

## Limites desta revisão

- Revisão estática dos arquivos versionados; nenhum banco foi acessado.
- Nenhuma migração foi executada ou alterada nesta etapa.
- Nenhum segredo, credencial ou dado de produção foi consultado.
- Nenhum deploy foi realizado.
- A PR #54 permanece aberta, em rascunho e não mesclada.
- O CI do commit analisado concluiu com sucesso nos dois workflows de validação Web e Android; isso valida os builds indicados, não a execução SQL nem a compatibilidade com o banco real.

## Regra de manutenção

O arquivo `AGENTS.md` do repositório determina que arquivos de migração Drizzle/Supabase são gerenciados pelo fluxo do Lovable e não devem ser editados manualmente. Por isso, esta etapa registra a auditoria e os bloqueios, sem alterar SQL. Qualquer correção futura de schema deve seguir o fluxo autorizado do projeto e ser validada em ambiente de teste antes de produção.
