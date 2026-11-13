# Relatório Técnico da OS — plano refinado (somente planejamento)

## Decisões confirmadas
- Relatório opcional, 1 por OS, totalmente separado do orçamento e do PDF do orçamento.
- Campos: Diagnóstico, Peças/serviços executados, Itens reprovados, Observações da inspeção.
- PDF próprio e compartilhável, emitido e compartilhado SOMENTE pela administração e pela secretaria (mecânico não emite, nem provisório); cabeçalho CLEIDSON DIESEL + "RELATÓRIO EMITIDO PELA CLEIDSON DIESEL".
- Mecânico atribuído preenche e envia para revisão; não aprova e não emite PDF.
- Administração OU secretaria revisa, corrige/complementa e aprova (uma única aprovação, sem aprovação dupla) ou devolve.
- PDF só pode ser emitido/compartilhado após o relatório estar aprovado.
- IA gera só sugestão preliminar separada; nunca preenche campos; aplicar exige clique explícito; tudo com trilha de auditoria.
- Tabela base: `public.service_order_inspection_reports` (da branch GitHub separada). Não criar `technical_reports`.
- Projeto principal publicado: não alterar, não publicar, não aplicar no banco ativo.

## Etapas
1. Revisar a branch separada: estrutura de `service_order_inspection_reports`, RLS, GRANTs, funções e telas existentes. Ajustar o plano ao que ela já tem (nada aqui foi verificado ainda, pois a branch não está neste workspace).
2. Completar o schema na branch (se faltar): estados (rascunho / enviado / aprovado / devolvido), `submitted_by/at`, `approved_by/at`, `ai_assisted`, e histórico de correções da secretaria (valor antes/depois por campo).
3. Trilha da IA: tabela de sugestões ligada ao relatório (quem gerou, quando, modelo, texto sugerido, status sugerida/aplicada/descartada, quem aplicou, em qual campo). Sem UPDATE/DELETE direto; só RPCs.
4. Função server-side de sugestão: recebe apenas `orderId`; busca os 4 campos + modelo/ano, km e queixa no servidor; nunca envia nome, telefone, CPF, placa ou valores. Reaproveita prompt e tratamento de erros da IA atual.
5. Tela do relatório na OS (mecânico, secretaria e admin): campos editáveis, caixa "Sugestão da IA — revise antes de usar" com Aplicar/Descartar, botão Enviar (mecânico) e Aprovar/Devolver (admin ou secretaria; uma aprovação basta).
6. PDF do relatório (admin e secretaria) em arquivo próprio, com logo e cabeçalho definidos; nota de "conteúdo com apoio de IA revisado por humano" quando aplicável.
7. Testes e validação no ambiente isolado da branch.

## Permissões (checadas no banco, não só na tela)
| Ação | Admin | Secretaria | Mecânico atribuído | Mecânico não atribuído |
|---|---|---|---|---|
| Ver relatório | sim | sim | sim | não |
| Editar rascunho | sim | sim | sim (até enviar) | não |
| Gerar/aplicar sugestão IA | sim | sim | sim (até enviar) | não |
| Revisar, corrigir e aprovar/devolver | sim | sim | não | não |
| Emitir/gerar e compartilhar PDF (só após aprovado) | sim | sim | não | não |
- Contas desativadas (`is_active=false`) bloqueadas em todas as ações.
- Mecânico continua sem ver valores do orçamento.
- Botões de PDF/compartilhar só aparecem para admin e secretaria; o bloqueio não depende só da tela: os dados para montar o PDF vêm por função que checa `has_role(admin)` ou `has_role(secretaria)` com conta ativa.
- Verificação de papel via `has_role` / `is_mechanic_assigned` com o usuário logado, nunca com acesso administrativo.

## Testes
- Regras puras: sugestão nunca altera campos sem "aplicar"; dados pessoais ficam fora do envio à IA; nota de IA só aparece no PDF se houve aplicação.
- Aprovação: admin aprova sozinho; secretaria aprova sozinha; mecânico atribuído recebe negação ao tentar aprovar; após uma aprovação o relatório fica aprovado sem pedir outra.
- PDF: com relatório não aprovado, admin e secretaria são recusados; após aprovado, admin e secretaria geram e compartilham; mecânico (atribuído ou não) não vê o botão e a função de dados do PDF o recusa; secretaria desativada é recusada.
- Permissões no banco: mecânico não atribuído negado; mecânico não edita após envio; desativado bloqueado.
- Fluxo ponta a ponta na branch: mecânico preenche + aplica IA + envia → secretaria corrige + aprova → PDF; repetir com admin aprovando no lugar da secretaria; trilha registra cada passo.
- Confirmar que orçamento e PDF do orçamento seguem idênticos.

## Decisões em aberto
1. Mecânico pode editar depois de enviado/devolvido?
2. Relatório aprovado pode ser reaberto? Se sim, por quem, e o PDF antigo fica invalidado?
3. Itens reprovados: texto livre ou vindos do checklist de inspeção?
4. Peças executadas: texto livre ou ligado às peças da OS (sem valores)?
5. Cliente recebe o PDF só por compartilhamento manual, ou também por link?
6. A IA atual do checklist (só admin) continua igual ou passa a usar o mesmo fluxo?

## Riscos
- O schema da branch pode diferir deste plano; etapa 1 define o ajuste.
- Aceitar a branch aplicaria as migrações no banco ativo — decisão sua, fora desta etapa.
- IA pode errar; mitigado por revisão humana e prompt restrito.
- Custo de créditos por geração; prever limite de frequência.
- Texto aplicado pode ser editado depois; a trilha guarda o original sugerido.
- Testes de papéis exigem contas de teste no ambiente isolado.
- Não pude atualizar o roadmap nesta etapa (modo de planejamento).
