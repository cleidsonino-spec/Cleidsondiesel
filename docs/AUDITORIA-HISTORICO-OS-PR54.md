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
