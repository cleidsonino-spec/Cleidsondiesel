# Migração do Cleidson Diesel para o Supabase novo

Esta pasta organiza a migração sem alterar o aplicativo nem executar mudanças no banco.

## Estado confirmado

- Projeto Supabase novo: `xzwydgmbvlqyksvfplca`.
- O SQL Editor retornou `Success. No rows returned` na consulta de tabelas públicas; isso indica que não havia tabelas de negócio no schema `public` naquele momento.
- As migrations originais estão em `drizzle/migrations/` e a migração do Worker push está em `supabase/migrations/`.
- A branch de referência é `feature/painel-funcionario-secretaria`.

## Ordem identificada nos arquivos existentes

1. `drizzle/migrations/0000_oficina_schema.sql`
2. `drizzle/migrations/0001_order_parts_and_shop_hours.sql`
3. `drizzle/migrations/0002_customer_quote_approval.sql`
4. `drizzle/migrations/0003_approval_identity_and_auto_status.sql`
5. `drizzle/migrations/0004_lookup_vehicle_by_plate.sql`
6. `drizzle/migrations/0005_order_inspection_checklist.sql`
7. `drizzle/migrations/0006_customers_vehicles_and_warranty_module.sql`
8. `supabase/migrations/20261110170000_cloudflare_push_triggers.sql`
9. `drizzle/migrations/0007_push_extra_events.sql`

A migração de push precisa vir antes de `0007`, pois `0007` cria um trigger que chama `push.notify_worker_on_change()`.

## Bloqueios encontrados antes de automatizar

1. `0006_customers_vehicles_and_warranty_module.sql` altera `public.warranties`, mas não existe uma criação dessa tabela nas migrations versionadas encontradas. Em um banco novo e vazio, a execução falhará nesse ponto.
2. O tipo gerado em `src/integrations/supabase/types.ts` inclui `customers.customer_type` e `customers.document`, mas a migration `0006` não cria essas colunas. O schema versionado está desalinhado.
3. A migration de push depende de pg_net e do segredo Vault `push_webhook_secret`. O segredo não pode ser incluído no GitHub nem em SQL versionado; precisa ser configurado de forma privada no projeto de destino.
4. O documento `docs/sql/20261111-paineis-funcionarios-direct-supabase.md` contém etapas SQL A–E, mas a etapa F é descrita sem o SQL integral. A automação não deve inventar ou presumir esse código.
5. As migrations não copiam dados do banco antigo, contas do Supabase Auth, tokens de dispositivos, secrets de Edge Functions ou configuração do Worker Cloudflare.
6. O workflow de automação precisa de uma credencial de conexão do banco guardada como GitHub Actions Secret. Nenhuma senha ou chave deve ser colocada em arquivos ou enviada pelo chat.

## Regra de segurança

**Não executar a sequência integral ainda.** Primeiro corrigir e revisar os itens acima. Rodar as migrations atuais sem correção pode deixar o banco novo parcialmente criado. Nenhum arquivo do aplicativo, configuração de produção ou projeto antigo deve ser alterado durante esta preparação.

## Próxima fase

- Recuperar a definição correta da tabela `warranties` e reconciliar as colunas de `customers`.
- Consolidar as etapas A–F dos painéis em SQL versionado e idempotente, após revisão.
- Criar um workflow manual do GitHub Actions com preflight, execução ordenada, parada imediata em erro e relatório final.
- Só depois planejar a cópia de dados/Auth e a troca das variáveis do app.
