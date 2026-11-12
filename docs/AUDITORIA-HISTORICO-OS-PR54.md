# Auditoria de integridade do histórico das ordens de serviço — PR #54

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`

## Escopo

Revisão estática do formulário de criação/edição de OS, da ação de exclusão e das migrações de linha do tempo. Nenhum banco foi acessado e nenhum teste de API foi executado.

## Controles confirmados no código

- A criação de OS grava um evento inicial por trigger na tabela `service_order_status_events`.
- Mudanças de status são registradas por trigger no banco, sem depender da tela.
- Recebimento, registros técnicos, autorizações, atribuições, conclusão técnica e alterações de estado de aprovação de orçamento alimentam eventos da linha do tempo.
- A tabela de eventos não concede INSERT/UPDATE/DELETE direto a PUBLIC, anon ou authenticated; a gravação é feita por funções trigger SECURITY DEFINER.
- A FK de `service_order_status_events.service_order_id` usa `ON DELETE RESTRICT`, protegendo a OS contra exclusão quando há eventos vinculados.
- A interface mostra a ação de excluir OS somente para admin. Se a exclusão for bloqueada por FK, apresenta mensagem para preservar os registros e usar cancelamento.

## Lacuna identificada — edição de campos da OS não gera histórico de versões

O trigger de status registra somente INSERT e UPDATE OF status. A linha do tempo unificada registra eventos de outras tabelas operacionais, mas não registra versões anteriores de campos editáveis da própria OS.

A tela permite atualizar diretamente campos como reclamação, diagnóstico, peças, valores, datas, quilometragem e observações. Assim, a auditoria examinada não demonstra que os valores anteriores desses campos sejam preservados quando são alterados. O histórico de status continua preservado, mas isso não equivale a um histórico completo de edições.

**Recomendação:** criar trilha de auditoria de alterações da OS no banco, com registro de campo alterado, valor anterior/novo, data/hora e usuário autenticado, evitando armazenar dados sensíveis desnecessários. Deve ser feita por migração gerenciada pelo projeto; não alterar migrations manualmente nesta revisão.

## Limite sobre OS antigas

A migração documenta que eventos anteriores à ativação do histórico não são reconstruídos. OS antigas sem eventos vinculados podem não receber a mesma proteção de exclusão fornecida pela FK do histórico. É necessário testar esse cenário em banco descartável e decidir se exclusão de OS deve ser proibida também para registros legados.

## Resultado

**Parcialmente protegido.** A criação e as transições de status, além de vários eventos operacionais, têm trilha no banco e proteção contra exclusão quando há eventos. A preservação de versões dos campos editáveis ainda não está comprovada e é uma pendência real antes de considerar a auditoria histórica completa.

## Próximos testes necessários

1. Alterar reclamação, diagnóstico, peças, valores, datas e observações e confirmar se a versão anterior fica recuperável.
2. Tentar excluir OS nova com eventos e OS antiga sem eventos, usando admin e secretaria.
3. Tentar UPDATE/DELETE direto na tabela de eventos por API autenticada.
4. Confirmar que cancelamento preserva OS, pagamentos, recebimento, autorizações, garantia e histórico.
5. Validar todos os cenários em banco descartável, sem usar dados de produção.

## Auditoria complementar — cancelamento, exclusão e edição (2026-11-12)

Arquivos conferidos nesta etapa:
- `src/routes/_authenticated/painel.ordens.$id.tsx`
- `src/routes/_authenticated/painel.index.tsx`
- `src/components/painel/order-form.tsx`
- `src/lib/status.ts`
- `src/lib/queries.ts`
- `supabase/migrations/20261113280000_service_order_status_history.sql`
- `supabase/migrations/20261113310000_restrict_direct_service_order_status_updates.sql`
- `supabase/migrations/20261113320000_finalize_delivery_through_authorized_rpc.sql`
- `supabase/migrations/20261113340000_idempotent_delivery_finalization.sql`

### Controles confirmados
- A tela de edição não permite alterar status pelo formulário (`allowStatusEdit={false}`) e remove `status` do payload antes do UPDATE.
- A migration de restrição revoga UPDATE geral da tabela para `authenticated` e concede UPDATE apenas em colunas operacionais listadas, sem incluir `status`.
- A finalização de entrega ocorre por RPC autorizada a admin/secretaria, exige OS pronta e confirmação de entrega registrada; a versão posterior torna a repetição idempotente.
- A exclusão na interface só é exibida para admin. A tela trata erro de FK (23503) com mensagem para preservar histórico e usar cancelamento.
- A listagem do painel oferece filtros por status, mas não apresenta ação de cancelamento na listagem examinada.

### Lacuna encontrada — cancelamento não comprovado como fluxo utilizável
- `cancelado` existe na lista de status e pode ser filtrado, mas a tela de detalhe desabilita a edição do status.
- A migration de permissões retira o UPDATE direto de `status`; as RPCs de transição revisadas cobrem atribuição, diagnóstico, conclusão e entrega, mas não foi localizado neste fluxo revisado um comando/RPC de cancelamento disponível na interface.
- Portanto, a mensagem de exclusão orienta “usar o cancelamento”, mas a existência de um caminho operacional acessível para cancelar uma OS não está comprovada. Isso deve ser resolvido por fluxo explícito e autorizado, sem permitir UPDATE direto do status.

### Exclusão e integridade — limite da conclusão
- A FK do histórico protege contra exclusão física quando há eventos vinculados. Isso não demonstra, por si só, proteção uniforme de OS legadas sem eventos nem cobre todas as relações possíveis.
- A interface restringe o botão a admin, mas a garantia efetiva contra chamadas diretas depende das policies/grants vigentes no banco; não houve teste com API ou banco nesta etapa.
- A edição de campos continua sem versionamento dos valores anteriores, conforme a lacuna já descrita acima.

### Próximas ações recomendadas
1. Definir e implementar por migração gerenciada uma RPC de cancelamento, com autorização admin/secretaria, justificativa obrigatória, validação de estados permitidos e evento auditável; conectar um botão explícito na tela.
2. Confirmar a política de DELETE em RLS/grants e testar tentativa direta via API para admin, secretaria, mecânico e usuário sem acesso.
3. Testar exclusão de OS nova com histórico e OS legada sem histórico em banco descartável.
4. Não liberar cancelamento de OS entregue nem permitir apagar registros financeiros, recebimento, autorizações ou garantias vinculados.

### Limites
Revisão estática de código e migrations versionadas. Nenhum banco foi acessado, nenhuma migration foi executada e nenhum teste de API foi realizado. A implementação de RPC/migration permanece bloqueada pelas regras do repositório que proíbem editar migrations manualmente.
