# Roteiro de homologação funcional — Cleidson Diesel

Este roteiro valida a integração dos módulos na branch `integration/homologacao-modulos-2026-11-12`. Deve ser executado somente em ambiente de homologação isolado, com usuários e registros fictícios. Não executar no banco de produção.

## Pré-condições
- [ ] Projeto apontado para um projeto Supabase de homologação separado da produção.
- [ ] Backup/snapshot do banco de homologação disponível.
- [ ] Migrations da branch aplicadas na ordem lexical, após revisão do diff.
- [ ] Usuários fictícios com papéis admin, secretaria e mecânico.
- [ ] OS, cliente, veículo, garantia, produto e fornecedor fictícios.
- [ ] Nenhum dado real de cliente ou credencial compartilhado no teste.

## Casos de teste

| ID | Área | Ação | Resultado esperado |
|---|---|---|---|
| H-01 | Desempenho | Mecânico atribuído conclui OS aprovada e em serviço | OS passa a pronta e cria exatamente um registro para o mecânico autenticado |
| H-02 | Desempenho | Mesmo mecânico tenta concluir novamente a OS pronta | Operação recusada; contagem permanece 1 |
| H-03 | Desempenho | Mecânico não atribuído tenta concluir OS | Operação recusada; nenhum registro criado |
| H-04 | Desempenho | OS em diagnóstico ou aguardando aprovação não é concluída | Não aparece na contagem de serviços concluídos |
| H-05 | Financeiro | Admin lança pagamento parcial em OS válida | Recebido aumenta; saldo a receber diminui |
| H-06 | Financeiro | Admin tenta lançar pagamento maior que saldo | Banco recusa; nenhum lançamento parcial é gravado |
| H-07 | Financeiro | Usuário não admin tenta consultar ou lançar pagamento/despesa | Acesso negado por RLS |
| H-08 | Financeiro | OS já recebeu pagamento e tentam reduzir seu total abaixo do recebido | Atualização recusada |
| H-09 | Financeiro | Orçamento aprovado sem pagamento registrado | Não aparece como valor recebido |
| H-10 | Estoque | Admin registra entrada | Movimento é gravado e saldo aumenta uma vez |
| H-11 | Estoque | Admin registra saída dentro do saldo | Movimento é gravado e saldo diminui uma vez |
| H-12 | Estoque | Tentativa de saída maior que saldo | Operação recusada; saldo não fica negativo |
| H-13 | Estoque | Tentativa de alterar saldo diretamente ou editar/excluir movimento | Operação recusada |
| H-14 | Recebimento | Nova OS é criada sem um dos campos obrigatórios de entrada | Banco recusa a gravação |
| H-15 | Recebimento | Nova OS com data/hora, responsável, hodômetro/horímetro e combustível | Registro é salvo; avarias/observações podem ficar vazias |
| H-16 | Recebimento | OS antiga sem objeto de recebimento é editada | Não é exigido preenchimento retroativo |
| H-17 | Assinatura | Admin/secretaria registra assinatura de recebimento com vistoria completa | Snapshot contém os dados da OS e do recebimento |
| H-18 | Assinatura | Tentativa de assinar recebimento sem vistoria ou antes do status recebido | Operação recusada |
| H-19 | Assinatura | Tentativa de alterar/excluir assinatura existente | Operação recusada |
| H-20 | Portal | Admin/secretaria emite link para uma OS | Token é exibido uma única vez; banco armazena somente hash |
| H-21 | Portal | Token válido consulta portal | Retorna apenas dados liberados daquela OS |
| H-22 | Portal | Token expirado, revogado ou inválido | Nenhum dado é retornado |
| H-23 | Portal | Emissão de novo link para mesma OS | Link anterior é revogado |
| H-24 | Garantia | Secretaria registra retorno ligado à garantia da OS de origem | Retorno é criado com autor autenticado |
| H-25 | Garantia | Retorno avança recebido → em avaliação → coberto/não coberto → concluído | Só transições previstas são aceitas; avaliação e solução são obrigatórias |
| H-26 | Garantia | Tentativa de pular etapa, alterar origem ou reabrir concluído | Operação recusada |
| H-27 | Lembretes | Secretaria registra lembrete para agendamento confirmado | Log append-only é gravado; interface não afirma entrega automática |
| H-28 | Lembretes | Tentativa de registrar lembrete para agendamento não confirmado | Operação recusada |
| H-29 | Histórico | Usuário admin consulta histórico da OS/veículo | Exibe OS, recebimento, pagamentos, movimentos relacionados, assinaturas e garantia |
| H-30 | Histórico | Mecânico consulta histórico sem permissão financeira/assinaturas | Tela não tenta consultar registros restritos nem expõe esses dados |
| H-31 | Indicadores | Filtra período com conclusões registradas | Contagem e evolução usam data real de conclusão |
| H-32 | Indicadores | OS sem registro de conclusão histórico | Não é atribuída retroativamente a um mecânico |

## Verificações de regressão
- [ ] Abrir, editar, salvar e consultar OS já existentes.
- [ ] Fluxo de diagnóstico, orçamento, aprovação por link e encaminhamento para execução.
- [ ] Painel da equipe e registro de andamento.
- [ ] Agenda e conversão manual de agendamento em OS.
- [ ] Permissões por papel: admin, secretaria e mecânico.
- [ ] Layout responsivo em celular e desktop.
- [ ] Mensagens de erro não expõem tokens, CPF, dados internos ou detalhes de infraestrutura.

## Critério de aprovação
A homologação só pode ser considerada aprovada após todos os casos aplicáveis passarem em banco isolado, com evidências de execução e sem regressões. Build de frontend bem-sucedido, isoladamente, não valida migrations, RLS, triggers, RPCs ou concorrência.

## Situação atual
- Build de frontend e Workers preview build foram aprovados no PR integrado.
- Revisão estática de migrations e componentes foi realizada.
- Execução dos casos acima em PostgreSQL/Supabase isolado: **pendente**.
- Nenhuma migration foi aplicada em banco real; nenhum deploy de produção ou merge foi realizado.
