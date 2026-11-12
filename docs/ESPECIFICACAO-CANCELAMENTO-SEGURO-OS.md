# Especificação — cancelamento seguro de ordem de serviço

Data: 2026-11-12
Branch: `integration/modulos-oficina-main`
Escopo: uso interno da oficina Cleidson Diesel

## 1. Objetivo

Disponibilizar cancelamento explícito de uma OS sem exclusão física e sem perda de histórico, com autorização por perfil, justificativa obrigatória e registro auditável de quem realizou a operação.

Cancelar uma OS não é apagar a OS, não é estornar automaticamente pagamentos e não é apagar serviços, peças, recebimento, autorizações ou garantia.

## 2. Perfis autorizados

- Admin: pode solicitar o cancelamento.
- Secretaria: pode solicitar o cancelamento, sujeito às mesmas validações e trilha de auditoria.
- Mecânico: não pode cancelar; pode registrar diagnóstico e execução conforme as permissões existentes.
- Usuário sem acesso: não pode consultar nem cancelar OS.

A autorização deve ser verificada no servidor/RPC usando a identidade autenticada e os papéis existentes. Ocultar o botão na interface não é controle de segurança suficiente.

## 3. Estados e regras de transição

Permitir cancelamento somente a partir destes estados:
- `recebido`
- `em_analise`
- `aguardando_aprovacao`
- `aprovado_aguardando_encaminhamento`
- `em_servico`

Bloquear cancelamento quando a OS estiver:
- `pronto`: o serviço foi concluído e aguarda retirada; manter o fluxo de entrega/retirada.
- `entregue`: encerrada fisicamente; não reabrir nem cancelar por esta operação.
- `cancelado`: já cancelada; uma repetição deve responder como já cancelada sem criar evento duplicado.

A transição deve ser atômica e concorrente-segura: bloquear a linha da OS durante a validação e a atualização. Revalidar o status dentro da operação no banco, nunca confiar no status que veio da tela.

## 4. Justificativa e dados de auditoria

Exigir justificativa digitada com pelo menos 10 e no máximo 1000 caracteres, removendo espaços excedentes nas extremidades. Não aceitar justificativa vazia ou composta somente por espaços.

Registrar em tabela de auditoria própria, imutável para usuários comuns:
- ID da OS;
- status anterior;
- status final (`cancelado`);
- justificativa interna;
- usuário autenticado que solicitou;
- data/hora do servidor;
- identificador único da operação para impedir duplicidade em reenvio.

O registro deve ser gravado na mesma transação da mudança de status. Se a auditoria falhar, o cancelamento também deve falhar.

A trilha de status existente deve continuar registrando a transição. Não ampliar diretamente o conjunto de tipos de evento sem revisar a constraint atual. A tabela específica de cancelamento guarda a justificativa e o contexto completo.

## 5. Integridade dos dados

O cancelamento:
- não exclui a OS;
- não remove nem altera pagamentos recebidos;
- não apaga despesas, movimentações de estoque ou snapshots de custo;
- não remove a ficha de recebimento nem fotografias;
- não apaga autorizações do cliente;
- não apaga diagnósticos, logs técnicos, atribuições ou conclusão do mecânico;
- não apaga garantias nem retornos já registrados;
- não altera automaticamente agendamento relacionado;
- não realiza estorno financeiro ou devolução de peças automaticamente.

Se houver pagamentos, saldo pendente, peças consumidas ou garantia vinculada, a tela deve avisar e direcionar a conferência manual correspondente. A operação de cancelamento não deve inventar estorno ou alterar valores financeiros.

## 6. Interface proposta

Na tela de detalhe da OS, exibir a ação **Cancelar OS** somente para admin e secretaria e somente nos estados permitidos.

Ao acionar:
1. Abrir confirmação com número da OS, placa e cliente.
2. Exibir aviso de que o cancelamento é permanente como estado operacional e não apaga registros.
3. Exigir justificativa.
4. Enviar solicitação à RPC autorizada.
5. Exibir sucesso somente após confirmação do servidor.
6. Atualizar consultas da OS, listagem e linha do tempo.
7. Mostrar o status Cancelado e a justificativa/autor/data na área interna de histórico.

Não permitir cancelar com um clique nem usar o DELETE da OS como alternativa.

## 7. Contrato sugerido da operação no banco

Nome sugerido: `public.cancel_service_order(_order_id uuid, _reason text, _request_key uuid)`.

Comportamento esperado:
- exigir sessão autenticada;
- autorizar somente admin ou secretaria;
- validar tamanho e conteúdo da justificativa;
- bloquear a OS com `SELECT ... FOR UPDATE`;
- validar que o status atual está na lista permitida;
- tratar reenvio idempotente sem gerar novo registro;
- inserir o registro de cancelamento com `auth.uid()` e horário do servidor;
- atualizar status para `cancelado`;
- deixar o trigger existente registrar a mudança de status;
- executar tudo na mesma transação;
- revogar execução de PUBLIC e anon e conceder apenas a authenticated, mantendo a checagem de papel dentro da função;
- definir `search_path` fixo e qualificar objetos.

A função deve retornar um resultado inequívoco (cancelada agora ou já cancelada), sem expor dados internos desnecessários.

## 8. Privacidade e portal do cliente

A justificativa é interna e não deve ser enviada automaticamente ao portal do cliente. Se for necessário comunicar o motivo ao cliente, usar um campo separado de mensagem pública, opcional e revisado pela equipe. Nunca reutilizar a justificativa interna como texto público.

A consulta pública deve continuar limitada aos campos expressamente permitidos. Não expor nome do funcionário, dados financeiros internos, logs técnicos ou justificativa interna.

## 9. Testes de aceitação obrigatórios

### Permissões
- Admin consegue cancelar OS elegível.
- Secretaria consegue cancelar OS elegível.
- Mecânico recebe acesso negado, inclusive por chamada direta à RPC.
- Usuário comum/anon recebe acesso negado.

### Estados
- Cada estado permitido é cancelado com justificativa válida.
- OS `pronto` não pode ser cancelada.
- OS `entregue` não pode ser cancelada.
- OS já cancelada não gera segunda auditoria nem segundo evento.

### Integridade e concorrência
- Duas solicitações simultâneas não duplicam o cancelamento.
- Justificativa inválida impede qualquer alteração.
- Falha ao gravar auditoria reverte também a alteração do status.
- Pagamentos, despesas, estoque, recebimento, fotos, autorizações, logs e garantias permanecem intactos.
- Histórico registra status anterior, status final, autor e horário.
- Tentativa de DELETE continua sujeita às policies e FKs existentes.

### Interface e portal
- A ação só aparece aos perfis e estados permitidos.
- A tela só informa sucesso após resposta positiva da RPC.
- A OS cancelada continua consultável internamente.
- A justificativa interna não aparece no portal público.

Todos os testes devem ocorrer em ambiente descartável/de teste, nunca no banco de produção.

## 10. Restrições de implementação

O arquivo `AGENTS.md` proíbe adicionar ou editar manualmente arquivos em `supabase/migrations/` e `drizzle/`. Portanto, esta especificação não implementa SQL nem altera o banco. A criação da RPC, tabela de auditoria, grants e policies precisa ser feita pelo fluxo gerenciado autorizado pelo projeto. Depois disso, a interface pode ser conectada ao contrato real e os testes podem ser executados em ambiente de teste.

## 11. Estado

- Especificação funcional e de segurança registrada.
- Nenhuma RPC criada.
- Nenhuma migration criada ou executada.
- Nenhum banco acessado.
- Nenhum deploy realizado.

## 12. Atualização da revisão — 2026-11-12

### Interface
- Commit `4ed9dad7d35eb1583e52bbd0f9b3cd4c9c2ad593` removeu da tela de detalhes da OS o botão, o diálogo e a função frontend que executavam `DELETE` em `service_orders`.
- A tela agora informa que a exclusão física está desativada na interface enquanto o cancelamento seguro não estiver disponível.
- O arquivo foi relido após o commit; não contém mais a chamada `.delete()` nem o diálogo de exclusão.

### Risco residual confirmado no código versionado
- A migration histórica `drizzle/migrations/0000_oficina_schema.sql` concede `DELETE` em `public.service_orders` para `authenticated` e cria a policy `Admins delete orders`, que permite a exclusão por administradores.
- A migration `20261113310000_restrict_direct_service_order_status_updates.sql` restringe atualizações de status, mas não revoga o privilégio `DELETE` nem remove a policy de exclusão.
- Portanto, remover o botão protege contra exclusão acidental pela interface, mas **não bloqueia uma chamada direta à API feita por um administrador**. A proteção definitiva depende de mudança de schema gerenciada: revogar `DELETE` para `authenticated` e remover a policy permissiva, preservando o acesso de serviço estritamente necessário.
- A busca no repositório não encontrou implementação de `public.cancel_service_order` nem tabela específica de auditoria de cancelamento.

### Estado e limites
- Nenhuma migration histórica foi editada.
- Nenhuma migration nova foi criada ou aplicada.
- Nenhum banco foi acessado e nenhuma chamada direta à API foi testada.
- O commit da interface não tem execução de workflow registrada no momento da consulta.
- A PR #54 permanece aberta, em rascunho e não mesclada.
- **Bloqueio para conclusão:** a camada de banco precisa ser corrigida pelo fluxo gerenciado permitido pelo projeto antes de ativar o botão de cancelamento. Depois disso, conectar a UI à RPC real e testar perfis, estados permitidos, concorrência, idempotência e preservação dos registros em ambiente descartável.
