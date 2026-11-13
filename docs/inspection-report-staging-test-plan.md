# Homologação — relatório técnico de inspeção

Este roteiro deve ser executado somente em ambiente de homologação, com OS fictícia. Não executar em produção.

## Pré-condições
- [ ] Aplicar as três migrations em ordem cronológica: 20261113100000_service_order_inspection_report.sql, 20261113143000_inspection_report_review_workflow.sql e 20261113160000_secure_inspection_report_pdf.sql.
- [ ] Confirmar tabela, policies RLS, triggers e RPC de PDF.
- [ ] Separar uma OS fictícia atribuída ao mecânico de teste e outra não atribuída.
- [ ] Ter contas distintas: mecânico atribuído, mecânico não atribuído, secretaria, administração e usuário sem papel autorizado.
- [ ] Confirmar serviço/chave de IA em homologação. Falta de créditos bloqueia apenas o teste de IA.

## Matriz de testes funcionais
| # | Perfil / ação | Resultado esperado |
|---|---|---|
| 1 | Mecânico atribuído abre a OS | Pode visualizar e criar relatório opcional |
| 2 | Mecânico preenche as quatro seções e salva | Dados persistem; status draft |
| 3 | Mecânico envia para revisão | Status pending_review; autor/data registrados pelo banco |
| 4 | Mecânico tenta editar após envio | Alteração recusada |
| 5 | Mecânico não atribuído tenta acessar a OS/relatório | Acesso negado |
| 6 | Secretaria abre central de relatórios | Enxerga pendentes, busca, filtros e link para OS |
| 7 | Secretaria corrige e aprova | Conteúdo salvo; status approved; revisor/data registrados |
| 8 | Administração tenta aprovar novamente | Não altera; segunda aprovação não é necessária |
| 9 | Mecânico tenta editar relatório aprovado | Alteração recusada |
| 10 | Secretaria/admin tenta PDF antes da aprovação | RPC recusa |
| 11 | Mecânico/usuário sem papel tenta RPC de PDF | RPC recusa |
| 12 | Secretaria/admin emite PDF aprovado | PDF contém cabeçalho e as quatro seções |
| 13 | Secretaria/admin compartilha PDF | Compartilhamento somente após aprovação e ação explícita |
| 14 | Pesquisar por OS, cliente, veículo e placa | Resultados correspondem corretamente |
| 15 | Relatório draft ou pending_review | Não permite emissão |
| 16 | OS sem relatório | OS continua funcionando normalmente |
| 17 | Conferir orçamento e PDF do orçamento | Relatório não aparece no orçamento |
| 18 | Conferir navegação por perfil | Central só para secretaria/admin; mecânico usa relatório na OS atribuída |

## Verificações de segurança
- [ ] Anônimo não consulta nem chama RPC.
- [ ] Usuário sem papel/atribuição não consulta relatórios.
- [ ] Mecânico não altera id, service_order_id, created_by ou created_at.
- [ ] Mecânico não define reviewed_by/reviewed_at nem aprova/devolve.
- [ ] Metadados de envio não podem ser falsificados pelo cliente.
- [ ] Relatório aprovado não pode ser alterado.
- [ ] RPC retorna somente os quatro campos e somente para secretaria/admin.

## Critério de aceite
A funcionalidade só será considerada validada quando todos os testes aplicáveis passarem com contas de homologação, incluindo RLS e abertura/compartilhamento do PDF. Build verde sozinho não é aceite funcional.

Não executar migrations em produção nem fazer merge/publicação como parte deste roteiro.