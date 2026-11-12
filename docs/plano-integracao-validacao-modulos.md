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


## Revisão integrada dos módulos — 12/11/2026

### Resultado da revisão estática conjunta

A revisão foi feita sobre os arquivos das branches dos PRs #33–#46, comparando cada branch com `main`. As branches analisadas estão à frente de `main` e sem commits atrás no momento da comparação, mas continuam independentes. Isso não substitui a validação em um ambiente integrado.

#### Achados que precisam ser resolvidos antes da integração

1. **Indicadores (#45) dependem do registro de conclusão (#35).** O painel atual classifica OS concluídas pelo status atual (`pronto`/`entregue`) e agrupa pelo `entry_date`. Isso não representa necessariamente quando o serviço foi concluído. Integrar o relatório à tabela `service_order_completions` e usar `completed_at` para os totais por período. A consulta do painel de desempenho (#35) também precisa de paginação/contagem no servidor para não ficar limitada ao teto de linhas da API em oficinas com histórico grande.
2. **Assinatura de recebimento (#39/#40).** A função de assinatura cria snapshot da OS, mas não inclui o JSON `vehicle_receipt` com hodômetro/horímetro, combustível, avarias e observações. Além disso, a função permite assinar recebimento apenas pelo status `recebido`, sem exigir que os campos obrigatórios da vistoria estejam preenchidos. Antes de aceitar a assinatura, validar os campos no servidor e incluir o snapshot completo do recebimento.
3. **Recebimento (#39).** O formulário exige os campos principais na criação, mas a migration protege apenas que `vehicle_receipt` seja um objeto JSON. A regra de obrigatoriedade deve ser validada no servidor no fluxo de criação/recebimento, sem exigir preenchimento retroativo em OS antigas.
4. **Retornos de garantia (#43).** O trigger impede reabrir um retorno concluído e exige solução para concluir, mas não restringe as transições intermediárias. Definir e validar transições permitidas no banco, impedindo saltos de estado incoerentes e alterações após conclusão.
5. **Financeiro (#36).** O trigger bloqueia pagamentos acima do total atual da OS e serializa lançamentos por OS. Falta proteger o caso inverso: uma edição posterior de peças/mão de obra pode reduzir o total da OS abaixo do que já foi recebido. A integração deve impedir essa redução ou exigir ajuste financeiro auditável.
6. **Estoque (#38).** O saldo é atualizado transacionalmente por movimentação e saídas sem saldo são bloqueadas. Reforçar a autoria no banco: a política de INSERT permite que um administrador informe `created_by` diferente do próprio usuário. O registro de movimentação deve atribuir o autor pelo servidor (`auth.uid()`) e não confiar no payload.
7. **Histórico do veículo (#41).** A primeira versão consulta OS e garantias. Depois da integração dos módulos, ampliar a linha do tempo para exibir recebimentos/assinaturas, pagamentos e movimentações de estoque vinculadas à OS, mantendo os dados internos fora do portal público.

#### Itens revisados sem bloqueio estático identificado

- **#33 andamento:** a alteração usa a categoria `outro`, compatível com a constraint conhecida, e preserva a mensagem real do backend. O teste de gravação com mecânico atribuído continua pendente.
- **#34 trigger push:** a função revisada acessa `OLD.status` somente dentro dos blocos de `service_orders` e `UPDATE`. Os triggers existentes são INSERT em `appointments`, INSERT/UPDATE de status em `service_orders` e INSERT em `warranties`, o que corresponde ao escopo da correção.
- **#42 portal:** token de 256 bits, hash no banco, expiração/revogação e retorno de uma única OS com campos explicitamente selecionados. Ainda exige testes de token inválido/expirado/revogado e de isolamento com papel anon.
- **#44 lembretes:** o envio continua manual; a RPC registra apenas o ato informado pela equipe e não afirma entrega automática do WhatsApp.
- **#36/#38/#45 navegação:** cada PR altera separadamente `src/routes/_authenticated/painel.tsx`. Consolidar os três links e tipos de rota em uma única alteração.
- **#39–#43 detalhes da OS:** todos alteram `src/routes/_authenticated/painel.ordens.$id.tsx`. Consolidar imports, consultas e componentes em uma única versão, sem sobrescrever as adições anteriores.

### Estado de CI observado

As execuções de validação do GitHub Actions consultadas para os commits registrados dos PRs #33, #34, #35, #36, #38, #39, #41, #44, #45 e #46 estavam concluídas com sucesso. Isso comprova a execução bem-sucedida do workflow nesses SHAs específicos, não a integração entre branches, nem a aplicação das migrations ou o funcionamento com dados reais. Para #40, #42 e #43, o estado de CI precisa ser confirmado no SHA atual antes da integração.

### Limites desta revisão

- Revisão estática de código e SQL versionado; nenhum teste foi executado contra o banco real.
- Nenhuma migration foi aplicada, nenhum dado foi alterado, nenhum PR foi mesclado e nenhum deploy foi realizado.
- A validação de RLS, triggers e RPCs com usuários reais continua pendente de ambiente de teste autorizado.
- Não foi usado crédito da Lovable.


### Correções preparadas após a revisão integrada

Foram adicionadas alterações corretivas às branches dos módulos, sem mesclar PRs:

- **#35 desempenho:** paginação em lotes de 500 para registros de conclusão.
- **#39 recebimento:** trigger de banco exige os quatro campos mínimos para novas OS recebidas e para transição de status para `recebido`; OS antigas não são obrigadas a preencher dados retroativamente.
- **#40 assinatura:** valida os campos mínimos do recebimento no servidor e inclui `vehicle_receipt` completo no snapshot imutável.
- **#43 garantia:** máquina de estados no banco e na interface; exige avaliação antes de avançar e solução antes de concluir.
- **#36 financeiro:** impede reduzir o total da OS abaixo do total já recebido e força autoria do usuário da sessão em pagamentos/despesas.
- **#38 estoque:** valida administrador e força autoria da movimentação pela sessão autenticada.
- **#45 indicadores:** passa a contar conclusões usando `service_order_completions.completed_at`, com evolução mensal pela data real de conclusão, em vez de inferir pela data de entrada ou pelo status atual.

### CI das correções

O workflow `Validate Cleidson Diesel web app` foi consultado após os commits corretivos e concluiu com sucesso nos SHAs atuais registrados:

| PR | SHA validado | Resultado |
|---|---|---|
| #33 | `a672149d` | success |
| #34 | `de948723` | success |
| #35 | `9c572a5a` | success |
| #36 | `2dd3396c` | success |
| #38 | `faa79f84` | success |
| #39 | `fa15d494` | success |
| #40 | `265bfd48` | success |
| #41 | `46ecc19b` | success |
| #43 | `13249ffc` | success |
| #44 | `324e4656` | success |
| #45 | `ac95f53a` | success |
| #46 | `0f6d6680` | success |

O PR #42 não recebeu alteração nesta rodada; seu CI e seus testes de isolamento continuam conforme a revisão anterior. O workflow acima é validação automatizada do repositório e não substitui testes de integração com o banco.

### Próxima preparação de integração

A integração deve ocorrer em uma branch única de homologação, na sequência: #33/#34, #35, #36, #38, #39/#40, #41, #42/#43, #44 e #45. Resolver em conjunto os arquivos compartilhados `src/routes/_authenticated/painel.tsx` e `src/routes/_authenticated/painel.ordens.$id.tsx`. Aplicar migrations somente em banco de teste autorizado, na ordem cronológica e após revisão de dependências. Validar RLS, papéis, triggers, RPCs, portal anon, pagamentos concorrentes, saldo de estoque, assinatura e transições de garantia.

Nenhum PR foi mesclado, nenhum deploy foi realizado e nenhuma migration foi aplicada ao banco real.


- **#41 histórico:** ampliada a linha do tempo interna para mostrar vistoria de recebimento, recebimentos financeiros, movimentações de estoque vinculadas e assinaturas, com consultas em lotes. Depende das migrations #36, #38, #39 e #40 no ambiente integrado; o portal público não utiliza essa consulta interna.
- **CI #41 após a ampliação:** commit `b06227be81433d18886ca295265bc8da90bd2ec7` enviado; execução ainda não apareceu no momento da consulta.
