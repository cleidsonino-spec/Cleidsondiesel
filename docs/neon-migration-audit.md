# Auditoria de compatibilidade: aplicativo e Neon

## Estado verificado no código

A aplicação ainda usa Supabase diretamente em rotas e funções de servidor. O banco Neon não está integrado às operações do aplicativo.

O repositório contém migrações históricas da aplicação em `drizzle/migrations`:
- `0000_oficina_schema.sql`: usuários/roles ligados a `auth.users`, agendamentos, ordens de serviço, políticas e funções de consulta pública.
- `0001_order_parts_and_shop_hours.sql`: peças discriminadas e regras de horário.
- `0002_customer_quote_approval.sql`: aprovação de orçamento por token.
- `0003_approval_identity_and_auto_status.sql`: validação de CPF e atualização de status.
- `0004_lookup_vehicle_by_plate.sql`: consulta pública de veículo por placa.
- `0005_order_inspection_checklist.sql`: checklist de inspeção.

## Incompatibilidade identificada

A migration simplificada `0001_initial_workshop_schema.sql` criou tabelas `customers`, `vehicles`, `service_orders`, `payments` e `warranties` com um modelo diferente do modelo legado da aplicação.

Em particular:
- A aplicação legada usa `service_orders.number`, `plate`, `customer_name`, `vehicle`, `complaint`, `entry_date`, `due_date` e outros campos.
- A tabela simplificada usa `order_number`, `customer_id`, `vehicle_id`, `description`, `received_at` e `completed_at`.
- A migration legada de permissões referencia `auth.users`, `auth.uid()`, papéis e funções específicas do Supabase. Ela não pode ser aplicada sem adaptação a um PostgreSQL Neon independente.

## Regra de segurança

Não executar as migrations legadas diretamente no Neon atual. Não renomear nem apagar tabelas. Primeiro inspecionar o schema que existe realmente no Neon, decidir a estratégia de compatibilidade e preparar backup/exportação antes de qualquer alteração.

## Diagnóstico somente leitura

O arquivo `database/diagnostics/inspect_neon_schema.sql` lista apenas nomes e metadados de colunas das tabelas relevantes. Ele não lê dados pessoais e não altera o banco.

## Próximas etapas técnicas

1. Executar o diagnóstico no Neon e comparar o resultado com o schema esperado.
2. Definir um schema de destino compatível com as operações atuais da aplicação, incluindo agendamentos, ordens, orçamento, consulta pública e garantias.
3. Projetar migração de autenticação independente mantendo login Google e autorização administrativa.
4. Preparar migração de dados com validação e plano de retorno.
5. Só então integrar as rotas ao Neon e testar em ambiente separado.

O aplicativo publicado e o login atual devem permanecer intactos até a conclusão dos testes.


## Rascunho aditivo preparado

Foi criado `database/migrations/0002_legacy_compatibility_draft.sql` na branch de testes.

O rascunho:
- mantém as cinco tabelas existentes e seus campos atuais;
- acrescenta à `service_orders` os campos que o aplicativo antigo espera;
- cria `appointments` e `quote_approvals`;
- adiciona índices e vínculo opcional entre ordem e agendamento;
- não cria autenticação, permissões ou endpoints;
- não copia automaticamente dados entre os modelos novo e antigo.

**Não executar ainda no Neon.** Antes disso, precisamos definir a autenticação independente e revisar como os registros atuais serão associados aos clientes e veículos. A aplicação continua usando Supabase e nada foi publicado.
