# Especificação — auditoria de edições das ordens de serviço

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`

## Objetivo

Preservar uma trilha confiável das alterações feitas nos campos de uma OS, permitindo responder: o que mudou, qual era o valor anterior, qual passou a ser o novo valor, quem realizou a alteração e quando ela ocorreu.

Esta especificação complementa `docs/AUDITORIA-HISTORICO-OS-PR54.md`. Não implementa schema nem altera o comportamento atual.

## Diagnóstico confirmado no código

A rota `src/routes/_authenticated/painel.ordens.$id.tsx` transforma os dados do formulário e executa `UPDATE service_orders` diretamente. O status é removido do payload, corretamente, para que transições continuem restritas às RPCs do fluxo.

O formulário compartilhado `src/components/painel/order-form.tsx` monta o payload com estes campos:

- Identificação e vínculo: `customer_id`, `vehicle_id`, `plate`, `customer_name`, `phone`, `vehicle`, `vehicle_year`, `mileage`.
- Serviço: `complaint`, `diagnosis`, `parts`, `part_items`, `inspection_checklist`.
- Valores: `parts_value`, `labor_value`.
- Datas e observações: `entry_date`, `due_date`, `notes`.
- O payload também contém `status`, mas a rota de edição o remove antes de salvar.

A migration `20261113310000_restrict_direct_service_order_status_updates.sql` permite UPDATE autenticado nas colunas operacionais acima e em `fuel_filter_replacement` e `system_cleaning`, mas não no status. O trigger de `service_order_status_events` só captura criação e mudança de status; não registra alterações dos demais campos.

Conclusão: a tela atual salva alterações sem criar, nesse caminho, um histórico de valores anteriores. A trilha de status existente não cobre essa necessidade.

## Modelo recomendado

Criar, por fluxo gerenciado de alteração de schema, uma tabela append-only, por exemplo `public.service_order_field_changes`, com:

- `id`: UUID gerado no banco.
- `service_order_id`: FK para a OS, com proteção contra exclusão em cascata.
- `field_name`: nome de uma coluna permitida, validado por lista explícita.
- `old_value` e `new_value`: JSONB com representação tipada dos valores, incluindo NULL.
- `changed_at`: timestamp do servidor.
- `changed_by`: `auth.uid()`, permitindo NULL apenas quando uma operação de sistema legítima não tiver usuário humano.
- `source`: origem controlada, se necessária (ex.: painel, RPC autorizada); não aceitar texto arbitrário do navegador.

Cada campo alterado deve gerar um evento próprio, ou um evento por salvamento contendo diff estruturado. Preferência: um registro por campo, pois facilita pesquisa e leitura cronológica. Todos os registros do mesmo UPDATE devem ser gravados na mesma transação da alteração da OS.

## Campos a auditar

Auditar somente campos de negócio que podem ser editados e cuja mudança importa para a operação:

- Reclamação/serviço solicitado, diagnóstico, descrição de peças e serviços.
- Itens de peças e respectivos valores/quantidades.
- Mão de obra e valor agregado das peças.
- Quilometragem/horímetro, datas de entrada e previsão.
- Observações internas e checklist de inspeção.
- Vínculos de cliente/veículo e snapshots operacionais de nome, telefone, placa, modelo e ano, se a oficina decidir que precisa recuperar correções desses dados.
- Recomendações técnicas `fuel_filter_replacement` e `system_cleaning`, se forem editáveis por alguma tela/RPC.

Não auditar `status` por esse mecanismo: ele já possui trilha própria e suas transições devem continuar exclusivamente nos fluxos autorizados. Não incluir campos derivados, timestamps técnicos ou valores recalculáveis sem necessidade.

## Privacidade e acesso

- Não registrar snapshots completos de cliente ou veículo.
- Evitar CPF/CNPJ, endereço, e-mail e outros dados pessoais que não sejam necessários para explicar a alteração.
- Se nome/telefone forem auditados por serem snapshots gravados na OS, restringir a leitura do histórico a admin e secretaria e não expor esses valores no portal do cliente.
- Mecânicos e usuários sem permissão de gestão não devem consultar a trilha administrativa completa.
- Portal do cliente nunca recebe valores anteriores, observações internas, checklist interno ou justificativas administrativas.
- RLS deve permitir apenas leitura aos perfis autorizados. Nenhum usuário autenticado, anon ou cliente deve inserir, editar ou apagar eventos diretamente.
- Não disponibilizar UPDATE/DELETE dos eventos nem uma ação de “limpar histórico”.

## Integridade no banco

- A captura deve ocorrer por trigger AFTER UPDATE, comparando cada coluna com `IS DISTINCT FROM`, para detectar corretamente NULL ↔ valor e ignorar campos inalterados.
- O trigger deve gravar os valores OLD e NEW apenas das colunas explicitamente permitidas.
- A gravação precisa ser transacional: se a auditoria falhar, a alteração da OS também deve falhar; não aceitar salvamento silencioso sem histórico.
- Identidade deve vir do contexto autenticado no banco (`auth.uid()`), não de um UUID enviado pelo frontend.
- Funções auxiliares SECURITY DEFINER, se necessárias, devem ter `search_path` fixo e EXECUTE restrito.
- A chave da OS deve permanecer vinculada por FK sem cascade delete, para preservar a integridade do histórico.
- Atualizações de campos derivados por trigger não devem gerar eventos duplicados ou ruído; definir explicitamente quais colunas representam mudanças de negócio.

## Interface recomendada

Na tela de detalhes da OS, adicionar seção “Histórico de alterações” separada da linha do tempo de status, com:

- Data e hora.
- Usuário responsável (nome de exibição resolvido com segurança; manter UUID como referência técnica).
- Campo alterado.
- Valor anterior e novo valor, com formatação adequada para moeda, datas, texto e listas.
- Agrupamento por salvamento quando múltiplos campos forem alterados juntos.

A seção deve ser somente leitura, disponível a admin e secretaria. Textos longos podem ser recolhidos para não tornar a tela excessiva. Não mostrar dados pessoais desnecessários.

## Testes de aceitação obrigatórios

1. Alterar somente reclamação: registrar exatamente uma alteração, com valor anterior e novo.
2. Alterar diagnóstico de NULL para texto e de texto para NULL: registrar os dois casos.
3. Alterar lista de peças, quantidade, preço unitário e total: preservar diff coerente, sem duplicar eventos por cálculo derivado.
4. Alterar valores, quilometragem, datas, observações e checklist: registrar cada campo efetivamente modificado.
5. Salvar sem alterar nada: não criar eventos.
6. Forçar falha ao gravar auditoria: confirmar rollback da edição da OS.
7. Fazer UPDATE direto pela API autenticada: confirmar que o trigger registra igualmente.
8. Tentar INSERT/UPDATE/DELETE direto no histórico por admin, secretaria, mecânico, usuário comum e anon: negar escrita a todos.
9. Confirmar leitura apenas por admin e secretaria; portal e usuário sem acesso não recebem histórico.
10. Confirmar que mudança de status continua aparecendo somente na trilha de status e não é duplicada como edição comum.
11. Confirmar que operações legítimas de serviço/estoque e atualizações derivadas não produzem ruído ou eventos duplicados.
12. Testar OS antigas: não inventar versões anteriores que não existem; registrar apenas mudanças ocorridas depois da ativação.

## Dependências e limites

- O arquivo `AGENTS.md` proíbe editar manualmente `supabase/migrations/` e `drizzle/`; o schema deve ser alterado pelo fluxo gerenciado do projeto.
- Como o usuário não autorizou uso do Lovable nem acesso ao Supabase, esta etapa se limita à auditoria e especificação. Não criar uma tela desconectada de uma tabela inexistente.
- Nenhum banco foi acessado, nenhuma migration foi executada e nenhum deploy foi feito.
- A implementação só poderá ser considerada concluída após schema gerenciado, UI conectada e testes de integração/RLS em ambiente descartável.
