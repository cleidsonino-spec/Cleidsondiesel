# Auditoria do encerramento e da entrega das OS — PR #54

Data: 2026-11-12  
Branch revisada: `integration/modulos-oficina-main`  
Escopo: leitura estática do fluxo de autorização de entrega, finalização da OS, histórico, financeiro, garantia e portal.

## Resultado executivo

O fluxo principal de entrega está coerente no código revisado: conclusão técnica e entrega física são estados separados; a OS só pode passar de `pronto` para `entregue` por uma RPC autorizada, com confirmação de entrega previamente registrada. A transição de status é capturada pelo histórico. Não foi identificada integração que marque pagamentos como quitados ao entregar o veículo.

Esta é uma auditoria estática do branch. Não foram executados testes contra banco, API real ou perfis autenticados.

## Arquivos e definições revisados

- `src/components/painel/customer-authorization-actions.tsx`
- `src/routes/_authenticated/painel.ordens.$id.tsx`
- `src/lib/queries.ts`
- `src/components/painel/service-order-status-history.tsx`
- `src/components/painel/warranty-editor.tsx`
- `supabase/migrations/20261113160000_customer_authorizations.sql`
- `supabase/migrations/20261113250000_require_delivery_confirmation_before_close.sql`
- `supabase/migrations/20261113280000_service_order_status_history.sql`
- `supabase/migrations/20261113290000_unified_service_order_timeline.sql`
- `supabase/migrations/20261113300000_correct_timeline_identity_labels.sql`
- `supabase/migrations/20261113320000_finalize_delivery_through_authorized_rpc.sql`
- `supabase/migrations/20261113340000_idempotent_delivery_finalization.sql`
- Migrações de financeiro, garantia e portal já revisadas nas auditorias anteriores.

## Controles confirmados por leitura

### 1. Confirmação de entrega

- A interface apresenta a ação somente para administrador/secretaria e quando a OS está em `pronto`.
- A RPC `record_customer_authorization` verifica usuário autenticado e papel admin/secretaria.
- Para `delivery_confirmation`, exige status `pronto`, nome com 3–120 caracteres e confirmação explícita.
- A tabela limita a uma confirmação de cada tipo por OS, evitando duplicidade por duplo clique.
- O aceite registra `recorded_by`, `accepted_at`, método `typed_name_checkbox`, nome informado e texto de consentimento.
- Nome digitado e checkbox são registro operacional da equipe; não comprovam identidade de forma independente e não equivalem a assinatura digital certificada.

### 2. Finalização física

- A RPC `finalize_service_order_delivery` exige usuário autenticado com papel admin/secretaria.
- Bloqueia a linha da OS com `FOR UPDATE`, exige status `pronto` e confirmação de entrega registrada.
- Atualiza o status para `entregue`; o trigger de transição também impede entrega a partir de outro status e impede reabrir OS já entregue.
- A versão posterior da RPC torna a repetição após timeout idempotente, evitando nova transição e duplicação do evento de status.
- A interface apresenta o botão de finalização somente após carregar uma confirmação existente; durante a chamada, desabilita o botão e, em sucesso, invalida as consultas da lista, da OS e do histórico.

### 3. Histórico

- O trigger de status grava criação e mudança de status na tabela de eventos.
- A linha do tempo integrada grava a confirmação de entrega como evento operacional separado.
- A mudança para `entregue` aparece como transição de status e pode ser identificada como entrega do veículo.
- A tela diferencia o usuário autenticado da equipe (`changed_by`) do nome informado no aceite.
- Eventos anteriores à instalação das migrações não são reconstruídos, conforme aviso da própria interface.

### 4. Financeiro, garantia e portal

- O módulo financeiro mantém pagamentos manuais em tabela própria e não altera pagamentos ao finalizar a entrega.
- Não há regra revisada que exija quitação integral como pré-condição de entrega. Portanto, a oficina deve continuar conferindo o saldo separadamente; o status `entregue` não significa `pago`.
- A garantia é um fluxo separado. A interface permite sua emissão quando a OS está `pronto`; não há emissão automática provocada pela mudança para `entregue`.
- A garantia emitida permanece vinculada à OS original.
- O portal do cliente recebe status da OS e informações autorizadas de garantia/retorno; não recebe diagnóstico técnico interno, peças utilizadas ou mão de obra interna nos campos revisados.

## Ponto residual para endurecimento

A versão idempotente da RPC retorna imediatamente quando encontra a OS já em `entregue`, antes de conferir novamente a confirmação de entrega. Isso evita duplicar uma operação legítima após perda de resposta, mas também faz a RPC retornar sucesso para uma OS que já estivesse historicamente em `entregue` antes da adoção do fluxo de confirmação, mesmo que não exista aceite registrado.

- O retorno antecipado não altera a OS nem cria evento novo.
- A interface normal não oferece o botão para uma OS já entregue.
- Recomendação: ao retornar para uma OS já entregue, distinguir a repetição de uma finalização válida de um registro legado sem confirmação. A regra deve preservar OS históricas e não fabricar aceite retroativo; definir resposta explícita para o caso sem autorização.
- Qualquer ajuste exigiria migration SQL incremental e testes de regressão. Não foi feito nesta etapa.

## Testes ainda necessários

Executar em ambiente de teste descartável, depois de validar a ordem completa das migrações:

1. Admin e secretaria registram confirmação e finalizam OS pronta.
2. Mecânico e usuário sem papel autorizado não conseguem registrar confirmação nem finalizar por chamada direta.
3. OS em outros status não pode ser finalizada.
4. Duplo clique, concorrência e repetição após timeout não duplicam transição nem histórico.
5. OS entregue historicamente sem confirmação recebe tratamento explícito, sem aceite retroativo.
6. Entrega não altera pagamentos, despesas, saldo ou estado de quitação.
7. Garantia permanece vinculada à OS e portal mostra apenas os campos destinados ao cliente.
8. Falhas de consulta/autorização na interface não exibem ação de finalização.

## Limites desta etapa

- Nenhuma alteração de código ou migration.
- Nenhum acesso ao Supabase ou banco de produção.
- Nenhuma chamada a API autenticada real.
- Nenhum teste de integração executado.
- Nenhum deploy.
- A PR #54 permanece aberta, em rascunho e não mesclada.
