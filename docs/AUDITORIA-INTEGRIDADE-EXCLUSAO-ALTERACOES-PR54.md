# Auditoria de integridade após exclusões e alterações administrativas — PR #54

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`  
Escopo: revisão estática de grants, RLS, FKs, triggers e trilhas de auditoria para OS, financeiro, estoque, recebimento, autorizações e garantias.

## Resumo

Os registros financeiros, movimentações de estoque, recebimentos, autorizações, eventos de histórico e garantias possuem controles relevantes contra exclusão ou alteração direta por usuários autenticados. A OS, porém, ainda pode ser fisicamente excluída por administrador quando não há relação protegida por FK. Isso deixa um risco residual para OS legadas ou incompletas sem registros dependentes. Além disso, alterações administrativas em campos editáveis da OS continuam sem histórico de versões.

A revisão é estática: não houve teste com API, perfis reais ou banco.

## Controles confirmados

### Ordens de serviço
- A policy de DELETE da tabela `service_orders` é exclusiva de admin.
- A secretaria não recebeu policy de DELETE nas migrations revisadas.
- O histórico de status usa FK para OS com `ON DELETE RESTRICT`.
- O recebimento, autorizações, pagamentos, movimentações de estoque e retornos em garantia também usam referências restritivas à OS em suas definições revisadas.
- Mudanças de status não podem ser feitas por UPDATE direto de usuários autenticados; o acesso à coluna `status` foi revogado e as transições dependem dos fluxos autorizados.
- A edição operacional de outros campos continua permitida conforme grants/RLS; não foi encontrada trilha genérica de versões desses campos.

### Financeiro
- `service_order_payments` e `shop_expenses` concedem a authenticated somente SELECT e INSERT; UPDATE e DELETE não são concedidos.
- RLS restringe leitura e inserção a admin.
- Pagamentos têm FK `service_order_id ... ON DELETE RESTRICT`, preservando a OS enquanto houver recebimentos vinculados.
- Idempotência por chave única protege contra repetição acidental de lançamentos.
- Trigger impede pagamento em OS cancelada, acima do saldo e redução do total abaixo dos recebimentos registrados.
- Despesas não são vinculadas a uma OS; são lançamentos independentes e imutáveis para usuários autenticados.

### Estoque
- Movimentações têm FKs restritivas para item, fornecedor e OS.
- Usuários autenticados recebem SELECT/INSERT, não UPDATE/DELETE, em `inventory_movements`.
- Saldo é alterado pelo trigger de movimento; UPDATE direto de `inventory_items` foi revogado para authenticated.
- Movimentos possuem chave de idempotência obrigatória e única após as migrations de endurecimento.
- O histórico de movimentação permanece como livro de movimentos; não há estorno automático no cancelamento da OS.

### Recebimento e autorizações
- Ficha de recebimento referencia OS com `ON DELETE RESTRICT`; authenticated recebe SELECT/INSERT, não UPDATE/DELETE.
- Autorizações do cliente também referenciam OS com `ON DELETE RESTRICT`; authenticated recebe SELECT, sem INSERT/UPDATE/DELETE direto. A escrita ocorre por RPC.
- Esses registros não são apagados pelo fluxo normal da interface revisado.

### Garantias e retornos
- Garantias têm trigger que bloqueia DELETE e registra snapshots antes/depois das alterações.
- Retornos referenciam garantia e OS com `ON DELETE RESTRICT`; a escrita ocorre por RPC e os eventos de retorno guardam snapshots.
- A garantia não pode ser transferida para outra OS nem ter autoria/data de início alteradas.

## Riscos e lacunas residuais

### 1. Exclusão física de OS legada sem registros dependentes
A policy permite DELETE para admin. FKs restritivas impedem apagar OS com histórico, pagamento, recebimento, autorização, movimento de estoque ou retorno vinculado. Porém, uma OS antiga ou incompleta sem nenhuma dessas relações pode não ter uma FK que impeça a exclusão. O histórico de status informa que eventos anteriores à ativação não são reconstruídos.

**Risco:** perda definitiva da OS e dos dados operacionais que existirem apenas na própria linha, caso um admin exclua uma OS sem relações protegidas.

**Recomendação:** decidir se a oficina deve proibir DELETE físico de todas as OS, inclusive legadas, e manter cancelamento como única forma de encerramento administrativo. Se confirmado, implementar por mudança gerenciada de schema/policy, preservando o fluxo de cancelamento e sem apagar dados antigos.

### 2. Alterações administrativas sem versionamento completo
A edição de campos da OS não registra genericamente valor anterior/novo. A trilha atual cobre status e eventos operacionais específicos, mas não demonstra histórico para reclamação, diagnóstico, valores, datas, quilometragem, observações e demais campos editáveis.

**Risco:** uma alteração administrativa acidental ou indevida pode sobrescrever o conteúdo anterior sem possibilidade de reconstrução pela linha do tempo existente.

**Recomendação:** auditoria de UPDATE da OS no banco, com usuário autenticado, timestamp, campos alterados e snapshots mínimos anterior/novo. Evitar incluir dados pessoais desnecessários e restringir leitura da trilha a admin.

### 3. Exclusão de agendamento pode desvincular a OS
A definição inicial de `service_orders.appointment_id` usa `ON DELETE SET NULL`. Portanto, excluir um agendamento relacionado pode remover o vínculo da OS com a agenda sem excluir a OS. Não foi comprovada trilha específica dessa desvinculação. Isso não apaga a OS nem os registros financeiros, mas pode dificultar a rastreabilidade da origem do atendimento.

**Recomendação:** avaliar se agendamentos devem ser cancelados/inativados em vez de excluídos e se a OS deve preservar um snapshot ou evento da referência original.

## Testes necessários antes de declarar proteção completa

1. Admin tenta excluir OS sem relações dependentes; secretaria tenta o mesmo.
2. Admin tenta excluir OS com histórico, pagamento, recebimento, autorização, movimento de estoque e garantia/retorno.
3. Testar OS legada sem evento inicial e sem relações dependentes.
4. Tentar UPDATE/DELETE direto em pagamentos, despesas, movimentos, recebimentos, autorizações e eventos usando API autenticada.
5. Alterar campos operacionais da OS e verificar se a auditoria de versões registra antes/depois após eventual implementação.
6. Excluir/cancelar agendamento vinculado e verificar preservação do vínculo histórico com a OS.
7. Confirmar que cancelamento preserva todos os registros e não executa estornos ou baixas de estoque implícitos.

## Limites e decisões pendentes

- Não houve alteração de código ou migration.
- Nenhum banco Supabase foi acessado; nenhuma migration foi executada.
- Nenhum teste real de RLS/API ou concorrência foi realizado.
- As conclusões de permissões são leitura estática das migrations versionadas.
- O repositório proíbe edição manual de `supabase/migrations/` e `drizzle/`; não foi contornado esse limite.
- O fluxo de cancelamento seguro continua especificado, mas não foi implementado nesta etapa.
- Nenhum deploy foi realizado.
