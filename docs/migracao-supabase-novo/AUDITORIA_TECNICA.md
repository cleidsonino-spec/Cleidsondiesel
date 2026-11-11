# Auditoria técnica — Supabase novo

Data da revisão: 2026-11-11  
Branch analisada: `feature/painel-funcionario-secretaria`

## Arquivos lidos

- `drizzle/migrations/0000_oficina_schema.sql` até `0007_push_extra_events.sql`
- `supabase/migrations/20261110170000_cloudflare_push_triggers.sql`
- `docs/sql/20261111-paineis-funcionarios-direct-supabase.md`
- `src/integrations/supabase/types.ts`
- `src/components/painel/warranty-editor.tsx`
- `src/lib/warranty.ts`

## Problemas que impedem uma execução automática segura

### Tabela warranties ausente na cadeia versionada

A migration 0006 faz `ALTER TABLE public.warranties ADD COLUMN ...`, mas não há `CREATE TABLE public.warranties` nas migrations do repositório. A UI espera os campos `service_order_id`, `duration_months`, `start_date`, `end_date`, `coverage`, `terms`, `created_at`, `updated_at` e `created_by`. A relação com `service_orders` é de uma garantia por OS (conforme os tipos gerados).

Não criar a tabela com suposições sem confirmar o schema original.

### Divergência de customers

O tipo gerado declara `customer_type` e `document`; a migration 0006 não declara esses campos. É necessário descobrir se são necessários na versão atual e acrescentar migration corretiva revisada.

### Push

A migration de triggers do Worker declara dependências de `net.http_post` e `vault.decrypted_secrets`, e espera o segredo Vault `push_webhook_secret`. A migration 0007 depende da função `push.notify_worker_on_change()`. A ordem precisa ser respeitada e as extensões/segredo validados antes de ligar os gatilhos.

### Painéis de funcionários

O documento direto contém SQL A–E e descreve a etapa F, mas não traz o SQL integral da F. O fluxo de autenticação/provisionamento de funcionários também não é criado por essas migrations. Não criar contas de funcionários automaticamente.

## Conclusão

A automação deve ficar bloqueada até reconciliar o schema e revisar as dependências. A execução parcial em um banco vazio não é uma migração completa e pode gerar uma instalação inconsistente.
