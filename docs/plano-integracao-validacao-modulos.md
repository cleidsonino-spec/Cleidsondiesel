# Plano de integração e validação — Cleidson Diesel

## Estado atual

Os PRs abaixo são propostas independentes baseadas em `main`. Nenhum deles deve ser considerado funcional em produção até integração, migração controlada e testes no ambiente real.

| PR | Área | Alterações principais | Dependências/atenção |
|---|---|---|---|
| #33 | Andamento do serviço | Corrige valor de procedimento e mensagem de erro | Testar com mecânico atribuído e OS real de teste |
| #34 | Notificações | Protege acesso a `OLD.status` em trigger compartilhado | Validar trigger em appointments, service_orders e warranties |
| #35 | Desempenho mecânicos | Contagem de serviços concluídos | Confirmar persistência do mecânico que concluiu e impedir duplicidade |
| #36 | Financeiro | Recebimentos e despesas manuais | Validar RLS, pagamentos parciais, limite do total e OS cancelada |
| #38 | Estoque | Produtos, fornecedores e movimentações | Validar RLS, bloqueio de saldo negativo e movimentação concorrente |
| #39 | Recebimento | Dados obrigatórios de entrada do veículo | Preservar edição de OS antigas sem recibo |
| #40 | Assinaturas | Registro eletrônico de recebimento e entrega | Validar consentimento, identidade, estado da OS e imutabilidade |
| #41 | Histórico | Linha do tempo por veículo | Validar correspondência por vehicle_id e fallback por placa |
| #42 | Portal cliente | Link individual com token e expiração | Validar isolamento entre clientes, revogação e expiração |
| #43 | Retornos garantia | Registro e avaliação de retorno | Validar vínculo à OS/garantia e transições de estado |
| #44 | Lembretes | WhatsApp manual e registro do envio | Envio continua manual; testar permissões e auditoria |
| #45 | Indicadores | Indicadores operacionais | Valores lançados não equivalem a recebimentos ou lucro |

## Conflitos conhecidos

Há arquivos alterados por mais de um PR. A integração deve consolidar manualmente as mudanças, nunca simplesmente escolher uma das versões:

- `src/routes/_authenticated/painel.tsx`: PRs #36, #38 e #45.
- `src/routes/_authenticated/painel.ordens.$id.tsx`: PRs #39, #40, #41, #42 e #43.
- `src/routes/_authenticated/painel.index.tsx`: PR #35.

O PR #35 e o PR #45 também precisam ser conferidos em conjunto para manter os indicadores e links de navegação coerentes.

## Sequência recomendada

1. Revisar e validar a correção de trigger do PR #34 antes de depender das notificações.
2. Corrigir e testar o fluxo de andamento do PR #33.
3. Consolidar navegação e módulos de operação: #35, #36 e #38.
4. Consolidar a página de detalhes da OS: #39, #40, #41, #42 e #43.
5. Integrar lembretes #44 e indicadores #45 após conferir as interfaces e os tipos resultantes.
6. Executar testes automatizados, build e validações de banco em ambiente de teste.
7. Só então preparar um único conjunto coerente para revisão e aprovação de integração.

## Roteiro de testes funcionais

### Ordens e equipe
- Criar OS, atribuir mecânico, registrar diagnóstico e encaminhar orçamento.
- Aprovar orçamento pelo link seguro.
- Atualizar andamento e concluir serviço.
- Confirmar que só o mecânico responsável recebe crédito pela conclusão e que uma OS não é contada duas vezes.
- Confirmar que diagnósticos e serviços em andamento não contam como concluídos.

### Financeiro
- Registrar pagamento integral e parcial.
- Confirmar saldo a receber e status calculado.
- Bloquear recebimento acima do total da OS e recebimento em OS cancelada.
- Registrar despesa manual e conferir fluxo de caixa.
- Confirmar que orçamento aprovado não é tratado como pagamento recebido.

### Estoque
- Cadastrar produto e fornecedor.
- Registrar entrada e saída.
- Bloquear saída que torne o saldo negativo.
- Vincular saída à OS sem gerar baixa duplicada.
- Confirmar trilha de movimentações e permissões.

### Recebimento, assinatura e histórico
- Criar nova OS exigindo dados obrigatórios de recebimento.
- Editar OS antiga sem forçar dados retroativos.
- Registrar assinatura de recebimento e entrega nos estados permitidos.
- Tentar alterar ou apagar assinatura e confirmar bloqueio.
- Consultar histórico por veículo e por placa, incluindo garantias e OS anteriores.

### Portal do cliente e garantia
- Emitir link individual, abrir sem autenticação e confirmar que só retorna dados liberados daquela OS.
- Testar token inválido, expirado e revogado.
- Registrar retorno de garantia ligado à OS original.
- Validar transições, cobertura e exigência de solução antes da conclusão.

### Agendamentos e lembretes
- Criar, confirmar, cancelar e remarcar agendamento.
- Confirmar que agendamento não cria OS automaticamente.
- Abrir WhatsApp com mensagem correta.
- Registrar envio somente depois da ação manual.
- Confirmar que o histórico identifica data, usuário e canal.

### Indicadores
- Comparar contagem de OS e totais com registros de teste conhecidos.
- Conferir filtros de 30, 90 e 365 dias e histórico completo.
- Confirmar que valores lançados em OS não são apresentados como recebidos ou lucro.

## Regras de segurança para a integração

- Não aplicar migrações diretamente no banco de produção durante a fase de revisão.
- Primeiro validar em ambiente de teste com backup e plano de reversão.
- Não solicitar nem armazenar senha bancária; financeiro é manual.
- Não enviar WhatsApp automaticamente sem integração autorizada e consentimento apropriado.
- Não expor informações internas, financeiras ou de outros clientes no portal público.
- Não integrar recursos de multiempresa ou revenda nesta fase.
- Não mesclar PRs enquanto os conflitos e testes acima não estiverem resolvidos.

## Critério de conclusão

A fase só pode ser considerada concluída quando o conjunto integrado tiver build aprovado, testes automatizados aprovados, migrações revisadas e testadas em ambiente não produtivo, e testes funcionais dos fluxos críticos. A abertura de um PR ou a aprovação isolada de build não comprova funcionamento em produção.
