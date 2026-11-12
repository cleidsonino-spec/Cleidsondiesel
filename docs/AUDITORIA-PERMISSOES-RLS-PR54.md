# Auditoria de permissões e RLS — PR #54

Data da revisão: 2026-11-12  
Branch: `integration/modulos-oficina-main`  
Commit revisado: `f0d8763e1726a74f20e7c84bd87928831097f023`

## Escopo e limites

Revisão estática das migrações versionadas de financeiro, estoque, equipe/mecânicos, autorizações, portal do cliente, garantias e transições de OS. Foram lidos também os limites do projeto em `AGENTS.md`.

Esta revisão não acessou banco, não executou SQL, não testou chamadas reais pela API e não confirma o estado do schema implantado. Portanto, as conclusões abaixo descrevem o código versionado, não a configuração efetiva de produção.

## Controles encontrados

### Financeiro — admin

Em `20261112130000_manual_finance_module.sql`:
- RLS habilitado em pagamentos e despesas.
- Grants autenticados limitados a SELECT/INSERT; sem UPDATE/DELETE direto.
- Policies de leitura e inserção exigem papel admin.
- O vínculo de autoria não pode ser preenchido com outro usuário.
- O trigger de pagamento bloqueia OS cancelada e recebimento acima do total, com bloqueio da linha da OS para serializar concorrência.
- Aprovação de orçamento não é tratada como pagamento.

**Resultado estático:** restrição coerente com financeiro exclusivo do administrador.

### Estoque e fornecedores — admin

Em `20261112150000_inventory_suppliers.sql` e `20261113130000_harden_inventory_movements.sql`:
- RLS habilitado nas três tabelas.
- Policies exigem admin.
- Movimento é o mecanismo de alteração de saldo; saldo negativo é bloqueado.
- UPDATE direto de itens foi revogado para authenticated.
- A função de trigger é SECURITY DEFINER, tem search_path fixo e EXECUTE revogado para PUBLIC/anon/authenticated.
- A chave de idempotência passa a ser obrigatória.

**Resultado estático:** controles de acesso e integridade coerentes. Continua pendente validar que todas as telas e caminhos de inserção enviam a chave de idempotência e tratam conflito.

### Mecânicos e histórico técnico

Em `20261111180500_create_mechanic_core_tables.sql`, `20261111221000_diagnosis_and_service_assignment.sql`, `20261113210000_fix_diagnosis_assignment_status.sql`, `20261113220000_close_diagnosis_assignment.sql`, `20261113230000_secure_mechanic_progress_log.sql` e migrações correlatas:
- Atribuição de OS é feita por admin/secretaria e valida papel de mecânico.
- Mecânico só pode concluir diagnóstico, registrar andamento ou concluir serviço se tiver atribuição ativa à OS.
- O andamento valida também que a OS está em serviço.
- Conclusão técnica registra o mecânico responsável e encerra sua atribuição na mesma transação.
- Leituras de atribuições e logs são limitadas a gestão e ao mecânico atribuído.
- RPCs operacionais removem EXECUTE de PUBLIC/anon e concedem a authenticated, com validação de papel/atribuição dentro da função.

**Resultado estático:** separação entre gestão e execução por mecânico está presente nas funções e policies examinadas.

### Secretaria e OS

Em `20261113370000_secretary_operational_access.sql` e `20261113310000_restrict_direct_service_order_status_updates.sql`:
- Secretaria recebe leitura operacional de clientes, veículos, OS e agenda, além de abertura/edição de OS conforme policies.
- UPDATE de status da OS foi revogado para authenticated.
- O GRANT de UPDATE autenticado é restrito a colunas operacionais explicitamente listadas.
- As transições de status permanecem nas RPCs controladas.

**Resultado estático:** a secretaria tem acesso operacional sem receber alteração direta do status.

### Autorizações e entrega

Em `20261113160000_customer_authorizations.sql` e `20261113320000_finalize_delivery_through_authorized_rpc.sql`:
- Registros de autorização não aceitam INSERT/UPDATE/DELETE direto pela API autenticada.
- RPC de registro exige admin/secretaria, nome, aceite explícito e estado compatível da OS/orçamento.
- Finalização exige admin/secretaria, OS pronta e registro prévio de confirmação de entrega.
- O próprio schema documenta que nome digitado + checkbox não é assinatura certificada.

**Resultado estático:** fluxo operacional protegido por RPC; a confirmação continua sendo evidência operacional, não identidade certificada.

### Portal do cliente

Em `20261113170000_customer_portal_secure_access.sql`, `20261113270000_revoke_customer_portal_access.sql` e `20261113360000_customer_portal_warranty_return_updates.sql`:
- Tabela de tokens não é acessível diretamente a anon/authenticated.
- Link usa token aleatório de 64 caracteres hexadecimais; banco guarda hash SHA-256.
- Emissão e revogação exigem admin/secretaria.
- Consulta pública é feita por RPC SECURITY DEFINER, com validação do token, expiração e revogação.
- Consulta por placa foi revogada.
- O payload público contém dados selecionados da OS, orçamento, garantia e atualizações destinadas ao cliente; não inclui os logs técnicos internos nas versões examinadas.

**Resultado estático:** desenho de acesso individual por bearer token, sem lookup público por placa. Quem obtiver o link válido poderá consultar os dados permitidos até expiração/revogação; o link não comprova identidade independente.

### Garantias

Em `20261113380000_harden_warranty_access.sql`:
- RLS habilitado e grants limitados.
- Policies permissiva e restritiva exigem admin/secretaria; a restritiva impede que policies permissivas antigas ampliem o acesso.

**Resultado estático:** controle explícito para impedir acesso de mecânicos/usuários comuns, mesmo com policy permissiva antiga.

## Ponto de hardening recomendado

A função `public.is_mechanic_assigned(uuid, uuid)` é SECURITY DEFINER e tem EXECUTE concedido a authenticated. A função retorna somente um booleano, mas aceita um UUID de usuário fornecido pelo chamador, permitindo consultar se um usuário arbitrário está atribuído a uma OS arbitrária. Não expõe os dados da OS, mas funciona como um pequeno oráculo de associação.

**Recomendação:** avaliar uma versão que limite a consulta pública ao próprio `auth.uid()`, mantendo a lógica interna necessária às RPCs, ou retirar a exposição direta se não houver chamada legítima pelo cliente. Não foi alterada porque as migrações Supabase são gerenciadas pelo fluxo do projeto e não devem ser editadas manualmente.

## Testes ainda necessários

1. Executar testes de RLS/API com perfis admin, secretaria, mecânico atribuído, mecânico não atribuído, usuário comum e anon.
2. Tentar SELECT/INSERT/UPDATE/DELETE diretamente em cada tabela protegida, não apenas pela interface.
3. Testar RPCs com usuário sem papel, OS de outro mecânico, status inválido, token expirado e token revogado.
4. Confirmar no banco de teste que policies antigas não ampliam acessos, especialmente nas tabelas de OS, clientes, veículos, pagamentos e estoque.
5. Confirmar o comportamento de idempotência do estoque e do financeiro na interface.

## Situação operacional

- Nenhuma migration foi aplicada.
- Nenhum banco foi acessado ou alterado.
- Nenhum deploy foi realizado.
- PR #54 permanece em rascunho e não mesclada.
- No commit revisado, os workflows Android e Web terminaram com sucesso; isso não substitui os testes de integração/RLS acima.


## Complemento da revisão direta de RPCs e payload público

Revisão adicional das definições efetivas das funções, considerando as migrações posteriores que substituem funções criadas anteriormente:

- A função `mechanic_update_order_status` inicialmente permitia ao mecânico selecionar `em_servico` ou `pronto`. A migração posterior `20261112120000_record_mechanic_service_completion.sql` substitui essa definição: na versão final examinada, o mecânico só pode enviar `pronto`, e a função exige OS em `em_servico`, atribuição ativa e grava conclusão única. Não tratar a definição antiga como vulnerabilidade ativa.
- A sobrecarga antiga de `mechanic_complete_diagnosis(uuid,text)` tem EXECUTE revogado para PUBLIC, anon e authenticated em `20261113240000_disable_legacy_diagnosis_rpc.sql`.
- A versão final de `get_customer_portal(text)`, substituída em `20261113360000_customer_portal_warranty_return_updates.sql`, não inclui o campo interno `diagnosis` nem os logs técnicos. Também constrói o snapshot do orçamento com campos selecionados, em vez de devolver o JSON integral. Isso corrige a exposição mais ampla da definição inicial da função.
- O payload público ainda inclui dados da OS destinados ao acompanhamento, como número, status, veículo, placa, reclamação registrada pelo cliente e datas; acesso condicionado ao token bearer válido.

### Achado residual confirmado

A definição de `public.is_mechanic_assigned(uuid,uuid)` em `20261111180500_create_mechanic_core_tables.sql` continua concedendo EXECUTE a authenticated e aceita qualquer UUID de mecânico como segundo argumento. O retorno é somente booleano, mas permite testar associações de terceiros. É um achado de hardening de baixo impacto relativo, não uma leitura direta de dados nem evidência de acesso a OS sem atribuição.

A recomendação permanece restringir a função exposta ao próprio `auth.uid()` ou remover EXECUTE para authenticated se a função só for necessária internamente. A mudança não foi feita porque exige migração SQL, fora do escopo permitido para esta etapa.


## Revisão de cadastro de clientes, veículos e operações de OS

Arquivos e definições revisados:
- `AGENTS.md`
- `drizzle/migrations/0006_customers_vehicles_and_warranty_module.sql`
- `supabase/migrations/20261113370000_secretary_operational_access.sql`
- `supabase/migrations/20261113310000_restrict_direct_service_order_status_updates.sql`
- `src/components/painel/registry-page.tsx`
- `src/lib/registry.ts`
- `src/routes/_authenticated/painel.tsx`
- `src/routes/_authenticated/painel.clientes.tsx`
- `src/routes/_authenticated/painel.ordens.nova.tsx`
- `src/routes/_authenticated/painel.ordens.$id.tsx`

### Achado confirmado — leitura ampla do cadastro pela secretaria

A regra do projeto em `AGENTS.md` declara os cadastros de clientes e veículos como admin-only. A migração `20261113370000_secretary_operational_access.sql` acrescenta policies SELECT para secretaria nas duas tabelas. A consulta compartilhada em `src/lib/registry.ts` usa `select("*")`, e a rota de clientes carrega clientes, veículos e garantias para a secretaria.

Assim, o papel secretaria pode ler todos os campos retornados do cadastro, incluindo CPF/CNPJ, telefone, e-mail, endereço e observações, além dos dados dos veículos. A tela oculta ações de edição/exclusão para não-admin, mas isso não reduz o que a API devolve; a autorização precisa ser aplicada no banco.

**Classificação:** divergência real entre a regra documentada e o acesso concedido. Não é evidência de acesso por mecânicos ou usuários comuns; o alcance identificado é o perfil secretaria.

**Correção recomendada:** decidir explicitamente quais dados a secretaria precisa para abrir e atender OS. Preferir uma RPC/visão de leitura mínima com apenas nome, telefone e dados essenciais do veículo, preservando CPF/CNPJ, endereço, e-mail e observações restritos ao administrador. Se a regra for manter o cadastro integral admin-only, remover a policy de leitura da secretaria e fornecer um fluxo de busca mínimo separado para abertura de OS. Não foi alterada porque requer mudança de schema/policies, e o projeto proíbe editar migrações manualmente.

### Controles de OS observados

- A secretaria pode abrir OS somente com status inicial `recebido`, conforme policy de INSERT.
- A secretaria tem policy UPDATE, mas o grant posterior restringe as colunas editáveis e remove `status`; portanto não pode alterar diretamente o status por UPDATE.
- A rota de edição remove `status` do payload antes de atualizar; transições ficam nas RPCs autorizadas.
- A exclusão de OS é apresentada somente ao admin na interface. O acesso efetivo à exclusão continua dependente de grants e policies do banco; não foi encontrado, nesta revisão focada, um caminho que autorize secretaria a excluir.
- Cadastro de cliente/veículo só mostra ações de edição e exclusão para admin na interface. A proteção real contra chamadas diretas depende das policies admin originais e dos grants de tabela.

### Limites desta verificação

A revisão é estática. Não foram executadas chamadas diretas REST/PostgREST com contas reais, nem testados privilégios efetivos no banco. Não se afirma que a divergência foi explorada em ambiente ativo.

## Complemento — exposição de dados pessoais nas telas e consultas compartilhadas (2026-11-12)

### Confirmação no frontend
- src/lib/registry.ts mantém select(*) tanto para clientes quanto para veículos.
- As rotas painel.clientes.tsx e painel.veiculos.tsx carregam essas consultas para a tela de cadastro; o componente recebe isAdmin para esconder ações de escrita, mas não limita os campos retornados pela consulta.
- Em registry-page.tsx, a listagem de clientes exibe CPF/CNPJ e e-mail; o histórico também exibe documento, e-mail e endereço. As informações não são ocultadas condicionalmente por isAdmin.
- A tela de veículos exibe placa, modelo, ano e nome do proprietário, sem exibir diretamente CPF/CNPJ.
- O formulário de nova OS usa as mesmas consultas amplas, embora utilize principalmente nome e telefone do cliente e placa/modelo/ano/quilometragem do veículo. Logo, dados como CPF/CNPJ, e-mail, endereço e observações cadastrais também chegam ao navegador nesse fluxo.

### Impacto
A secretaria não apenas tem permissão de SELECT ampla no schema versionado: as telas e consultas compartilhadas efetivamente recebem e, em algumas telas, exibem campos pessoais que não são necessários para abrir uma OS. Ocultar elementos da interface reduziria exposição visual acidental, mas não protegeria os dados da resposta da API nem do estado/cache do navegador.

### Recomendação de correção segura
1. Manter cadastro completo e edição integral restritos ao admin.
2. Criar, pelo fluxo gerenciado de schema, uma RPC/visão operacional de leitura mínima para secretaria: nome e telefone do cliente; placa, modelo, ano, quilometragem e vínculo do veículo; sem documento, e-mail, endereço ou observações cadastrais.
3. Remover a policy SELECT ampla da secretaria em customers e vehicles, concedendo apenas execução/leitura do recurso mínimo com checagem explícita de papel.
4. Separar consultas admin e operacionais no frontend; não usar select(*) em consultas compartilhadas.
5. Renderizar CPF/CNPJ, e-mail e endereço somente na interface administrativa, mesmo depois de restringir a API.
6. Testar com sessão de secretaria a resposta REST/RPC, cache React Query, HTML renderizado e tentativas diretas de SELECT; confirmar que mecânico, usuário comum e anon não recebem dados cadastrais.

### Limites e decisão
- Nenhuma mudança de UI foi feita nesta etapa: esconder campos apenas na tela seria cosmético enquanto a API continuar devolvendo os dados.
- Não foram editadas migrations, consultado banco live, executadas chamadas API reais ou realizados testes com contas/perfis.
- O projeto proíbe edição manual de migrations; a correção efetiva depende do fluxo gerenciado autorizado.


## Revisão específica — isolamento do financeiro por perfil (2026-11-12)

### Tabelas de recebimentos e despesas

Arquivos revisados:
- `supabase/migrations/20261112130000_manual_finance_module.sql`
- `supabase/migrations/20261113120000_protect_paid_order_totals.sql`
- `supabase/migrations/20261113150000_financial_idempotency.sql`
- `supabase/migrations/20261113200000_financial_idempotency_keys.sql`
- `src/routes/_authenticated/painel.financeiro.tsx`
- `src/routes/_authenticated/painel.index.tsx`
- `src/lib/queries.ts`
- `AGENTS.md`

Controles confirmados no código versionado:
- `service_order_payments` e `shop_expenses` têm RLS habilitado.
- Grants para `authenticated` permitem SELECT e INSERT, mas não UPDATE nem DELETE direto.
- Policies SELECT e INSERT exigem `has_role(auth.uid(),'admin')`; secretaria, mecânico e usuário comum não satisfazem essas policies.
- INSERT também vincula `created_by` ao usuário da sessão por policy/trigger.
- A interface financeira só executa sua consulta quando `isAdmin` é verdadeiro e apresenta mensagem de acesso restrito aos demais perfis.
- A tela consulta os lançamentos diretamente nas duas tabelas; não foi identificada RPC ou view pública alternativa para listar recebimentos/despesas.
- As chaves idempotentes evitam duplicação em retries, e os triggers mantêm as validações de saldo da OS.

**Resultado estático:** o isolamento do caixa (recebimentos e despesas) está aplicado no banco e reforçado na interface. Uma chamada REST/PostgREST direta feita por secretaria, mecânico ou usuário comum deve ser bloqueada pelas policies RLS, mesmo que tente ignorar a tela.

### Distinção importante — valores comerciais da OS

A tabela `service_orders` contém `parts_value` e `labor_value`, e a consulta compartilhada de OS usa `select("*")`. A migration de acesso operacional concede SELECT de OS à secretaria. Assim, os valores de peças e mão de obra/orçamento podem estar visíveis à secretaria junto com os dados operacionais da OS.

Esses valores são o preço/orçamento do serviço, não o registro de dinheiro efetivamente recebido nem as despesas da oficina. Os lançamentos reais de caixa continuam isolados nas tabelas admin-only. Não classificar a leitura do valor orçado como acesso à tabela financeira.

A interface do painel geral também mostra o total da OS na lista e nas ordens aguardando aprovação. Isso é coerente com o fluxo de atendimento/orçamento existente; não expõe o saldo de caixa, pagamentos registrados ou despesas.

### Limites e testes pendentes
- Não foram feitas chamadas REST reais com sessões de admin, secretaria, mecânico e usuário comum; a conclusão é estática e não comprova a configuração do banco implantado.
- Não foi acessado banco, executado SQL, aplicado migration ou feito deploy.
- Recomenda-se validar em ambiente de teste: SELECT/INSERT/UPDATE/DELETE nas duas tabelas para cada perfil; confirmar que admin consegue inserir e consultar; confirmar que demais perfis recebem negação RLS.
- Verificar também que nenhuma nova RPC/view SECURITY DEFINER seja adicionada futuramente com retorno de pagamentos ou despesas sem checagem explícita de papel.


## Revisão específica — isolamento de OS para mecânicos (2026-11-12)

### Controles confirmados
- `service_order_assignments` tem RLS habilitado e SELECT concedido a authenticated; a policy limita o mecânico às linhas em que `mechanic_user_id = auth.uid()`. Admin e secretaria podem consultar as atribuições para gestão.
- O painel `/equipe` filtra as atribuições do mecânico pelo próprio usuário e por `active = true`, e solicita somente campos operacionais selecionados da OS relacionada.
- `technical_service_logs` tem SELECT limitado a admin/secretaria e ao mecânico com atribuição ativa à OS correspondente.
- As RPCs de diagnóstico, andamento e conclusão verificam papel de mecânico e atribuição ativa antes de alterar a OS. A conclusão registra o mecânico e encerra a atribuição na mesma transação.
- O layout administrativo `/painel` não libera o painel geral para o perfil mecânico; o mecânico usa a rota separada `/equipe`.

### Achado prioritário — falta de leitura da OS atribuída na policy RLS
A policy inicial de leitura de `service_orders` permite admin; a migração `20261113370000_secretary_operational_access.sql` acrescenta SELECT para secretaria. Nas migrações de mecânicos revisadas, não foi encontrada policy SELECT para mecânico na tabela `service_orders`.

Entretanto, `src/routes/_authenticated/equipe.tsx` consulta `service_order_assignments` com relacionamento aninhado `service_orders(...)`. A policy que permite ao mecânico ler sua atribuição não concede, por si só, leitura da linha relacionada em `service_orders`. Com RLS ativo e sem policy de leitura correspondente, o relacionamento pode retornar nulo/indisponível; o painel não recebe os dados necessários para mostrar a OS e operar os botões de diagnóstico/conclusão.

**Classificação:** provável bloqueio funcional do painel do mecânico no banco versionado, a confirmar com sessão real. Não é evidência de que o mecânico consiga ler OS de terceiros; o controle atual tende a negar a leitura da própria OS relacionada.

### Correção recomendada — sem ampliar a exposição de colunas
Não recomendo simplesmente criar uma policy SELECT ampla em `service_orders` para mecânicos: RLS controla linhas, não colunas. Uma policy de leitura permitiria consultar também todos os campos concedidos por privilégios de coluna, potencialmente incluindo telefone, dados comerciais, valores de peças/mão de obra e outros campos não necessários ao mecânico.

Preferir uma RPC SECURITY DEFINER, com `search_path` fixo, EXECUTE somente para authenticated e validação explícita de:
1. papel `mecanico`;
2. `auth.uid()` como mecânico da atribuição;
3. atribuição ativa para a OS solicitada;
4. retorno somente da lista mínima de campos usados no painel: número, veículo, placa, reclamação, diagnóstico, prazo, status e verificações técnicas de manutenção.

A consulta do painel deve usar essa RPC para obter os dados mínimos, sem depender de relacionamento direto que exija SELECT amplo em `service_orders`. Os logs técnicos devem continuar limitados às OS com atribuição ativa, conforme a regra operacional atual. A RPC também deve negar OS não atribuída, mesmo quando chamada diretamente pela API com UUID arbitrário.

### Limites e testes pendentes
- Revisão estática de policies, grants, RPCs e frontend; nenhuma chamada REST real foi executada com usuário mecânico.
- Não foi acessado banco, aplicado SQL/migration, alterado schema ou feito deploy.
- A correção depende do fluxo gerenciado de schema: `AGENTS.md` proíbe edição manual de `supabase/migrations/` e `drizzle/`.
- Testes necessários: mecânico A consulta OS atribuída; mecânico A tenta consultar OS atribuída somente ao mecânico B; tenta consultar OS sem atribuição; tenta chamar RPC diretamente com UUID de terceiro; verificar ausência de telefone, CPF/CNPJ, valores financeiros e dados de caixa; confirmar que admin/secretaria mantêm seus fluxos.
