# Adaptar a IA de inspeção ao relatório técnico da OS

## Situação atual (verificada)
- `generateInspectionDiagnosis` (src/lib/inspection-diagnosis.functions.ts) exige login + `has_role(admin)`, usa `openai/gpt-6-astra` pelo Gateway e devolve só `{ diagnosis }`.
- O schema (src/lib/inspection-diagnosis.ts) recebe dados do checklist; a UI (inspection-diagnosis.tsx) mostra a sugestão e aplica ao campo `diagnosis` da OS.
- Ainda não existe tabela, tela nem PDF de "relatório técnico" (nenhuma ocorrência de `executed_parts`/`inspection_observations`). É pré-requisito desta etapa ou de uma etapa anterior.

## O que será feito (somente em branch/draft separado, banco isolado do draft)
1. Relatório técnico por OS (se ainda não criado): campos diagnosis, executed_parts, rejected_items, inspection_observations, estado (rascunho / enviado / aprovado pela secretaria).
2. Sugestão da IA: botão "Gerar sugestão da IA" no relatório; resultado aparece numa caixa identificada "Sugestão da IA — revise antes de usar". Nunca preenche campos sozinha.
3. Aplicar explicitamente: botões "Aplicar ao diagnóstico" / "Descartar". Ao aplicar, o texto entra no campo editável; só vai ao relatório/PDF após salvar. Fica registrado quem aplicou, quando, e que veio de IA.
4. Aprovação da secretaria: ao aprovar, registra revisor humano; PDF mostra a nota "Texto com apoio de IA, revisado por <nome> em <data>" apenas se houve conteúdo de IA aplicado.
5. PDF do relatório em arquivo próprio (`src/lib/technical-report-pdf.ts`), sem tocar em `quote-pdf.ts`.

## Permissões
- Gerar/aplicar sugestão: admin, secretaria, ou mecânico com atribuição ativa na OS (`is_mechanic_assigned`).
- Checagem no servidor: nova RPC SECURITY DEFINER `can_edit_technical_report(_order_id)` chamada via `context.supabase` (nunca admin client); a função recebe `orderId` e busca ela mesma os dados técnicos no banco — o cliente não envia o texto que alimenta a IA, evitando forjar dados de outra OS.
- Aprovar relatório: só admin/secretaria. Mecânico não aprovado/desativado (`user_roles.is_active=false`) é bloqueado.
- Dados enviados à IA: os 4 campos + modelo/ano do veículo, quilometragem e queixa. Sem nome, telefone, CPF, placa, valores.

## Migração necessária (sim)
- Tabela `technical_reports` (1 por OS) + RLS + GRANTs, se não existir.
- Tabela `technical_report_ai_suggestions`: report_id, order_id, generated_by, generated_at, model, input_hash, suggestion_text, status (sugerida/aplicada/descartada), applied_by, applied_at, applied_field.
- Colunas no relatório: `ai_assisted boolean`, `reviewed_by`, `reviewed_at`.
- RPCs: `record_ai_suggestion`, `apply_ai_suggestion`, `approve_technical_report` (SECURITY DEFINER com checagem de papel/atribuição). Sem UPDATE/DELETE direto nas sugestões (trilha imutável).
- Aplicada só no banco do draft; nada no banco ativo.

## Arquivos
- Novos: `src/lib/technical-report-ai.ts` (schemas zod + prompt), `src/lib/technical-report-ai.functions.ts`, `src/components/painel/technical-report-ai.tsx`, `src/lib/technical-report-pdf.ts`, testes em `src/test/technical-report-ai.test.ts`.
- Alterados: tela do relatório técnico da OS (mecânico e secretaria); `AGENTS.md` (regra da IA no relatório).
- Inalterados: quote-pdf, fluxo de orçamento, layout global, IA atual do checklist (continua para admin).

## Validação
- Testes: schema rejeita campos pessoais; texto de IA só entra após "aplicar"; PDF marca apoio de IA somente quando aplicado.
- Playwright no draft: mecânico atribuído gera/aplica; mecânico não atribuído recebe negação; secretaria corrige e aprova; admin vê trilha.

## Riscos e limitações
- IA pode errar; mitigado por revisão obrigatória e prompt restrito a dados recebidos.
- Custo de créditos de IA por geração; limitar a 1 geração a cada ~30s por relatório.
- Texto aplicado pode ser editado depois; a trilha guarda o texto original sugerido, não garante que o final seja igual.
- Depende do relatório técnico existir; se for criado em outra etapa, o schema deve ser alinhado.
- Testes com papéis exigem contas de teste no banco do draft.
- Nada é publicado; aceitar o draft aplicará as migrações ao banco ativo — decisão sua.
