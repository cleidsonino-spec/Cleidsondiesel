# Auditoria estática — financeiro, estoque, recebimento e garantia

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`  
PR: https://github.com/cleidsonino-spec/Cleidsondiesel/pull/54

## Escopo

Revisão estática das migrações versionadas de financeiro manual, estoque/fornecedores, ficha de recebimento, garantias/retornos e portal do cliente. Não houve conexão com banco, execução SQL, deploy ou alteração de dados.

## Resultado por módulo

### Financeiro manual

Migrações revisadas:
- `20261112130000_manual_finance_module.sql`
- `20261113120000_protect_paid_order_totals.sql`
- `20261113150000_financial_idempotency.sql`
- `20261113200000_financial_idempotency_keys.sql`

Pontos confirmados:
- Recebimentos são lançamentos separados e vinculados à OS; aprovação de orçamento não é pagamento.
- Pagamentos e despesas não recebem permissões de UPDATE/DELETE para usuários autenticados nas migrações analisadas.
- O trigger de pagamento bloqueia OS cancelada e recebimento acima do total, bloqueando a linha da OS com `FOR UPDATE` durante a validação.
- A alteração do total da OS é bloqueada quando deixaria os pagamentos registrados acima do novo total.
- A autoria é definida no banco com `auth.uid()`; as políticas exigem admin e autoria correspondente.
- Chaves idempotentes UUID são preenchidas para registros anteriores e passam a ser obrigatórias e únicas.

Observação: as migrações `20261113150000` e `20261113200000` repetem parte da configuração da chave idempotente financeira. A segunda é compatível com a primeira no cenário de instalação sequencial, usando `IF NOT EXISTS` e o mesmo tipo UUID; é redundância de manutenção, não evidência de falha por si só.

### Estoque e fornecedores

Migrações revisadas:
- `20261112150000_inventory_suppliers.sql`
- `20261113130000_harden_inventory_movements.sql`
- `20261113190000_inventory_cost_snapshot.sql`

Pontos confirmados:
- O saldo é alterado por movimentos de entrada/saída, com bloqueio de saldo negativo.
- A função do trigger foi endurecida como `SECURITY DEFINER`, com `search_path` fixo e execução direta revogada para usuários comuns.
- UPDATE direto de `inventory_items` foi revogado para `authenticated`; o saldo permanece controlado pelo trigger.
- Movimentos recebem chave idempotente obrigatória e única.
- Saídas preservam snapshot do custo unitário, sem inventar custo histórico para movimentos antigos.
- Tabelas de estoque e fornecedores têm acesso operacional restrito por RLS ao administrador.

Ponto para teste de integração: confirmar que todas as telas e caminhos de inserção de movimentos fornecem `idempotency_key` e tratam conflito de chave sem duplicar lançamentos. A migração torna a coluna NOT NULL e não define default nela.

### Recebimento do veículo

Migrações revisadas:
- `20261112170000_vehicle_intake_records.sql`
- `20261112200000_enforce_vehicle_intake_before_progress.sql`
- `20261112210000_vehicle_intake_customer_confirmation.sql`
- `20261112220000_prevent_disabling_required_vehicle_intake.sql`

Pontos confirmados:
- A ficha é única por OS, com responsável autenticado, odômetro/horímetro, combustível, condição externa, danos, acessórios e observações.
- Fotos são opcionais.
- A inserção é restrita a admin/secretaria e exige `received_by = auth.uid()`.
- Para novos registros, a confirmação exige nome de quem entregou, nome de quem recebeu, checkbox/aceite e texto de consentimento idêntico ao apresentado.
- Novas OS exigem ficha antes de avançar; o desenho preserva OS antigas com `intake_required=false`.
- A confirmação de nome e checkbox é registro operacional, não assinatura digital certificada nem prova independente da identidade do cliente.

Ponto para teste de integração: testar criação de nova OS, inclusão da ficha, tentativa de avanço sem ficha, OS antiga sem ficha e tentativa de alterar `intake_required`. A revisão estática não confirma comportamento no banco real.

### Garantias, retornos e portal do cliente

Migrações revisadas:
- `drizzle/migrations/0006_customers_vehicles_and_warranty_module.sql`
- `supabase/migrations/20261113350000_warranty_returns_and_audit.sql`
- `supabase/migrations/20261113360000_customer_portal_warranty_return_updates.sql`
- `supabase/migrations/20261113380000_harden_warranty_access.sql`

Correção da auditoria anterior:
- A tabela `public.warranties` **é criada** em `0006_customers_vehicles_and_warranty_module.sql`. A afirmação anterior de que ela estava ausente estava incorreta e foi corrigida no documento `REVISAO-ORDEM-MIGRACOES-PR54.md`.

Pontos confirmados:
- Garantia é vinculada de forma única à OS original e tem validação de prazo.
- Mudanças de garantia e retornos geram trilha de auditoria.
- Retornos só podem ser registrados por admin/secretaria via RPC; encerramento exige justificativa/solução, e o fluxo não permite encerrar diretamente um retorno recém-recebido sem passar pela análise.
- Acesso às garantias é reforçado por RLS e políticas restritivas para admin/secretaria.
- O portal público recebe apenas status/data/atualização destinada ao cliente do retorno, não diagnóstico interno, peças, mão de obra ou resolução técnica.
- O acesso ao portal depende de token individual; não há consulta pública por placa.

Ponto para teste de integração: validar em ambiente de teste a emissão, expiração e revogação do token, o isolamento entre OS de clientes diferentes, o ciclo de retorno em garantia e a separação entre atualização pública e dados técnicos internos.

## Riscos e validações pendentes

1. Testes de integração devem confirmar o contrato da chave `idempotency_key` no frontend e nas chamadas de estoque.
2. Confirmar a presença/configuração das extensões, schemas e segredos usados pelo push em ambiente controlado; o sucesso de build do Worker não valida a configuração do banco.
3. Fazer teste de migração em banco descartável com o mesmo ponto de partida esperado, incluindo a sequência Drizzle/Supabase intercalada conforme dependências.
4. Testar RLS com perfis admin, secretaria, mecânico, usuário comum e anon, incluindo tentativas diretas via API.
5. Confirmar a estrutura preexistente do banco de destino antes de aplicar migrações que usam `CREATE TABLE IF NOT EXISTS`; essa cláusula não corrige automaticamente uma tabela preexistente com colunas ou constraints incompatíveis.

## Conclusão

Nesta revisão estática, os módulos financeiro, estoque, recebimento e garantia/portal apresentam controles relevantes de autorização, trilha e integridade nas migrações versionadas. Não foi encontrada justificativa suficiente para alterar SQL nesta etapa. A prontidão para uso real continua condicionada à validação de migrações e testes de integração em ambiente de teste; CI de frontend/Worker não substitui esses testes.

Nenhuma migração foi aplicada. Nenhum banco foi acessado. Nenhum deploy foi realizado. A PR permanece aberta e não mesclada.
