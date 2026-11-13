# Relatório Técnico da OS — plano refinado (somente planejamento)

## Decisões confirmadas
- Relatório opcional, 1 por OS, totalmente separado do orçamento e do PDF do orçamento.
- Campos: Diagnóstico, Peças/serviços executados, Itens reprovados, Observações da inspeção.
- PDF próprio e compartilhável, emitido SOMENTE pela administração (mecânico e secretaria não emitem, nem provisório); cabeçalho CLEIDSON DIESEL + "RELATÓRIO EMITIDO PELA CLEIDSON DIESEL".
- Mecânico atribuído preenche; secretaria pode corrigir/completar ao aprovar.
- IA gera só sugestão preliminar separada; nunca preenche campos; aplicar exige clique explícito; tudo com trilha de auditoria.
- Tabela base: `public.service_order_inspection_reports` (da branch GitHub separada). Não criar `technical_reports`.
- Projeto principal publicado: não alterar, não publicar, não aplicar no banco ativo.

## Etapas
1. Revisar a branch separada: estrutura de `service_order_inspection_reports`, RLS, GRANTs, funções e telas existentes. Ajustar o plano ao que ela já tem (nada aqui foi verificado ainda, pois a branch não está neste workspace).
2. Completar o schema na branch (se faltar): estados (rascunho / enviado / aprovado / devolvido), `submitted_by/at`, `approved_by/at`, `ai_assisted`, e histórico de correções da secretaria (valor antes/depois por campo).
3. Trilha da IA: tabela de sugestões ligada ao relatório (quem gerou, quando, modelo, texto sugerido, status sugerida/aplicada/descartada, quem aplicou, em qual campo). Sem UPDATE/DELETE direto; só RPCs.
4. Função server-side de sugestão: recebe apenas `orderId`; busca os 4 campos + modelo/ano, km e queixa no servidor; nunca envia nome, telefone, CPF, placa ou valores. Reaproveita prompt e tratamento de erros da IA atual.
5. Tela do relatório na OS (mecânico e secretaria): campos editáveis, caixa "Sugestão da IA — revise antes de usar" com Aplicar/Descartar, botão Enviar (mecânico) e Aprovar/Devolver (secretaria).
6. PDF do relatório (só admin) em arquivo próprio, com logo e cabeçalho definidos; nota de "conteúdo com apoio de IA revisado por humano" quando aplicável.
7. Testes e validação no ambiente isolado da branch.

## Permissões (checadas no banco, não só na tela)
| Ação | Admin | Secretaria | Mecânico atribuído | Mecânico não atribuído |
|---|---|---|---|---|
| Ver relatório | sim | sim | sim | não |
| Editar rascunho | sim | sim | sim (até enviar) | não |
| Gerar/aplicar sugestão IA | sim | sim | sim (até enviar) | não |
| Corrigir e aprovar | sim | sim | não | não |
| Emitir/gerar PDF | sim | não | não | não |
- Contas desativadas (`is_active=false`) bloqueadas em todas as ações.
- Mecânico continua sem ver valores do orçamento.
- Botão de PDF só aparece para admin; o bloqueio não depende só da tela: os dados completos para montar o PDF vêm por função que checa `has_role(admin)`.
- Verificação de papel via `has_role` / `is_mechanic_assigned` com o usuário logado, nunca com acesso administrativo.

## Testes
- Regras puras: sugestão nunca altera campos sem "aplicar"; dados pessoais ficam fora do envio à IA; nota de IA só aparece no PDF se houve aplicação.
- PDF: admin consegue gerar; secretaria e mecânico não veem o botão e a função de dados do PDF os recusa.
- Permissões no banco: mecânico não atribuído negado; mecânico não edita após envio; só admin/secretaria aprovam; desativado bloqueado.
- Fluxo ponta a ponta na branch: mecânico preenche + aplica IA + envia → secretaria corrige + aprova → admin gera PDF; trilha registra cada passo.
- Confirmar que orçamento e PDF do orçamento seguem idênticos.

## Decisões em aberto
1. Admin pode emitir PDF antes da aprovação da secretaria, ou só após aprovado?
2. Mecânico pode editar depois de enviado/devolvido?
3. Relatório aprovado pode ser reaberto? Se sim, por quem, e o PDF antigo fica invalidado?
4. Itens reprovados: texto livre ou vindos do checklist de inspeção?
5. Peças executadas: texto livre ou ligado às peças da OS (sem valores)?
6. Cliente recebe o PDF só por compartilhamento manual, ou também por link?
7. A IA atual do checklist (só admin) continua igual ou passa a usar o mesmo fluxo?

## Riscos
- O schema da branch pode diferir deste plano; etapa 1 define o ajuste.
- Aceitar a branch aplicaria as migrações no banco ativo — decisão sua, fora desta etapa.
- IA pode errar; mitigado por revisão humana e prompt restrito.
- Custo de créditos por geração; prever limite de frequência.
- Texto aplicado pode ser editado depois; a trilha guarda o original sugerido.
- Testes de papéis exigem contas de teste no ambiente isolado.
- Não pude atualizar o roadmap nesta etapa (modo de planejamento).
