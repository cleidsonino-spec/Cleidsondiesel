# Auditoria — integridade de valores, orçamento, financeiro e estoque

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`

## Escopo e arquivos revisados

- `src/routes/_authenticated/painel.ordens.$id.tsx`
- `src/components/painel/order-form.tsx`
- `src/lib/parts.ts`
- `src/lib/status.ts`
- `src/routes/_authenticated/painel.financeiro.tsx`
- `src/routes/_authenticated/painel.estoque.tsx`
- `src/components/painel/approval-actions.tsx`
- `src/components/painel/quote-pdf-actions.tsx`
- `supabase/migrations/20261112130000_manual_finance_module.sql`
- `supabase/migrations/20261113120000_protect_paid_order_totals.sql`
- `supabase/migrations/20261113130000_harden_inventory_movements.sql`
- `supabase/migrations/20261113150000_financial_idempotency.sql`
- `supabase/migrations/20261113190000_inventory_cost_snapshot.sql`
- `supabase/migrations/20261113200000_financial_idempotency_keys.sql`
- `supabase/migrations/20261111182000_diagnosis_quote_workflow.sql`
- `supabase/migrations/20261112100000_fix_quote_approval_validation.sql`
- `supabase/migrations/20261112150000_inventory_suppliers.sql`

Análise estática de código e migrações versionadas. Não houve acesso ao banco nem execução de testes de integração.

## Resultado geral

Há controles úteis para impedir recebimentos acima do total, preservar idempotência de pagamentos/despesas e manter saldo de estoque por movimentos. Entretanto, a consistência entre os itens detalhados de peças e o campo agregado `parts_value` depende atualmente do frontend. Também há fragilidades na validação/conversão de valores digitados e uma lacuna na vinculação obrigatória das saídas de estoque às OS quando se pretende medir custo por serviço.

## Achados

### 1. Soma das peças depende do frontend — prioridade alta

`toOrderInput()` converte `part_items` e calcula `parts_value` por `partsTotal()`. O formulário salva esses campos juntos. Isso mantém coerência no caminho normal da interface.

Porém, as políticas e permissões permitem atualização autenticada das colunas operacionais da OS, incluindo `part_items` e `parts_value`. A proteção financeira `prevent_order_total_below_received()` compara apenas o total agregado (peças + mão de obra) com os pagamentos existentes. Ela não valida que `parts_value` seja igual à soma das linhas em `part_items`.

Risco: uma chamada direta à API ou um futuro caminho de gravação pode salvar itens detalhados somando R$ 500,00 e `parts_value` de R$ 450,00 (ou o inverso). O PDF mostra a lista e o total agregado separadamente, o que pode produzir orçamento inconsistente.

Recomendação: validação no banco, na mesma transação do UPDATE, calculando a soma das linhas com regra única de arredondamento e rejeitando divergências. Definir também como tratar registros antigos sem `part_items` ou com formato legado; não reescrever dados históricos automaticamente. Manter validação no frontend como conveniência, não como controle de integridade.

### 2. Conversão de valor inválido pode virar zero — prioridade média

`parseMoney()` retorna zero tanto para campo vazio quanto para conteúdo não numérico ou negativo. O formulário usa esse resultado ao gerar o payload, sem diferenciar claramente “valor zero intencional” de “entrada inválida”. A função também normaliza separadores de forma permissiva, podendo interpretar entradas malformadas de maneira inesperada.

Risco: erro de digitação no preço unitário ou mão de obra pode ser salvo como R$ 0,00 sem que o operador perceba.

Recomendação: separar valor vazio (se permitido) de valor inválido, aceitar explicitamente os formatos brasileiros suportados (ex.: `1234,56` e `1.234,56`), rejeitar entradas ambíguas/malformadas e mostrar erro no campo. Fazer a validação final no banco para valores não negativos e escala de duas casas. Não presumir que todo valor zero seja erro, pois pode haver serviço/peça sem cobrança.

### 3. Proteção de pagamentos acima do total — controle positivo, teste concorrente pendente

O trigger `validate_service_order_payment()` bloqueia pagamentos em OS cancelada e calcula o saldo sob bloqueio `FOR UPDATE` da OS. O trigger `prevent_order_total_below_received()` bloqueia a redução do total abaixo dos pagamentos já registrados. Ambos ajudam a manter o teto financeiro.

A tabela de pagamentos é imutável para usuários autenticados (sem UPDATE/DELETE concedido) e usa chave idempotente única. A interface mantém a mesma chave em tentativas repetidas com os mesmos dados e consulta se o lançamento já foi gravado após erro de rede.

Limite: não foi possível comprovar por teste de concorrência que duas tentativas simultâneas, atualização de total e pagamento, e retry após timeout se comportam corretamente em todos os cenários. Executar testes concorrentes em banco descartável antes de produção.

### 4. Aprovação do orçamento vinculada ao snapshot — controle positivo

A emissão de aprovação registra `quote_snapshot(o)`. Na aprovação pública, a função compara o snapshot armazenado com `quote_snapshot(o)` atual e rejeita se a OS foi alterada. Emite novo link quando necessário e revoga links pendentes/aprovados anteriores ao emitir outro.

Isso reduz o risco de o cliente aprovar um orçamento e a oficina alterar silenciosamente os valores depois. Ainda é necessário testar alteração de cada campo que compõe o snapshot, reemissão, expiração, revogação e aprovação concorrente. O PDF gerado na tela é um artefato local; as condições comerciais digitadas no PDF não alteram o cadastro da OS nem o snapshot persistido.

### 5. Saída de estoque pode não estar vinculada à OS — prioridade média

A tela de estoque permite registrar saída com vínculo de OS opcional. A migration grava `service_order_id` nullable e snapshot de custo unitário no movimento. O saldo é atualizado pelo livro de movimentos, saídas acima do saldo são bloqueadas e a chave idempotente é obrigatória.

Risco: se a oficina quiser medir custo real de peças por OS, uma saída sem vínculo não entra corretamente no custo daquela OS. O sistema não consegue inferir depois qual serviço consumiu o item.

Recomendação: manter vínculo opcional para movimentações gerais, mas exigir OS para saídas marcadas como consumo de serviço/instalação. Diferenciar claramente retirada interna, perda/ajuste e consumo em OS. Testar se o dashboard de custo ignora movimentos sem OS sem os atribuir indevidamente.

### 6. Snapshot de custo em saídas — cuidado com custo zero

A versão atual do trigger usa `COALESCE(NEW.unit_cost, NULLIF(v_unit_cost, 0))` para saídas. Isso evita inventar custo quando o cadastro não tem custo, mas também converte custo cadastrado explicitamente como zero em NULL. Se custo zero for um valor válido (doação, cortesia ou item sem custo), a distinção entre zero conhecido e custo desconhecido se perde.

Recomendação: definir a semântica de custo zero. Se zero for válido, preservar `v_unit_cost` diretamente quando existir cadastro confiável, inclusive zero; usar NULL apenas quando o custo realmente for desconhecido. Testar movimentos antigos sem custo e novos movimentos com custo zero.

### 7. Despesas e compras de estoque — processo manual, sem duplicação automática

A tabela `shop_expenses` é independente do livro de movimentos. A UI informa que despesas avulsas não devem duplicar compras de estoque; não há integração automática de uma entrada de estoque com uma despesa. Isso evita duplicação automática, mas exige disciplina operacional e não cria conciliação entre nota de compra, fornecedor, entrada e pagamento.

Recomendação: em etapa futura, avaliar vínculo opcional de documento/compra com entradas de estoque e despesas, sem lançar duas vezes no caixa. Não implementar integração bancária.

## Plano de testes de aceitação

1. Alterar quantidade/preço de cada peça e confirmar que soma detalhada e `parts_value` coincidem.
2. Tentar UPDATE direto da API com `part_items` e `parts_value` divergentes; o banco deve rejeitar.
3. Testar valores `0`, vazio, negativo, `1234,56`, `1.234,56`, `1,234.56`, letras e separadores repetidos.
4. Confirmar que o total da OS é sempre peças + mão de obra, com duas casas e arredondamento definido.
5. Emitir orçamento, alterar qualquer campo de preço/peça e tentar aprovar link antigo; deve ser rejeitado.
6. Reemitir orçamento e confirmar revogação do link anterior.
7. Registrar pagamentos parciais, pagamento total, retry após timeout e duas tentativas concorrentes; nunca ultrapassar o total nem duplicar lançamento.
8. Tentar reduzir o total abaixo do recebido; o banco deve rejeitar.
9. Registrar saídas de estoque com OS, sem OS, custo conhecido, custo zero e custo desconhecido.
10. Confirmar que saídas sem OS não são atribuídas a uma OS e que saídas com OS entram uma única vez nos indicadores.
11. Registrar compra de estoque e despesa avulsa para confirmar que o fluxo manual não duplica valor no caixa.
12. Repetir cenários com usuários sem papel admin; RLS deve bloquear financeiro e estoque.

## Limites desta etapa

- Não foi executado banco de dados, API real ou teste automatizado.
- Nenhuma migração foi criada, editada ou aplicada.
- Nenhum dado de produção foi alterado.
- O `AGENTS.md` proíbe editar manualmente `supabase/migrations/` e `drizzle/`; qualquer alteração de schema precisa seguir o fluxo gerenciado do projeto.
- Não foi feita alteração no frontend nesta etapa; os achados que exigem controle de integridade devem ser resolvidos na camada correta, sem criar validação visual que finja garantir a API.
