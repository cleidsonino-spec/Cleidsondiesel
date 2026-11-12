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


## Revisão específica — troca e encerramento de atribuição de mecânicos (2026-11-12)

### Controles confirmados
- A RPC `assign_order_to_mechanic` exige admin ou secretaria, bloqueia a linha da OS com `FOR UPDATE`, valida o papel `mecanico` do usuário selecionado, encerra todas as atribuições ativas da OS e insere a nova atribuição na mesma transação.
- A troca gera eventos distintos na linha do tempo: encerramento da atribuição anterior (`mechanic_unassigned`) e nova atribuição (`mechanic_assigned`), com usuário responsável pela mudança, mecânico, IDs e horários.
- Concluir diagnóstico encerra a atribuição ativa após gravar o diagnóstico e o log técnico.
- Concluir serviço registra o mecânico em `service_order_completions` e encerra sua atribuição ativa na mesma função/transação.
- O histórico técnico não é apagado na troca. Admin e secretaria podem consultar os logs; mecânicos só podem consultar logs enquanto possuem atribuição ativa para a OS.
- O painel atualiza a lista por Realtime ao receber alterações em `service_order_assignments`.

### Riscos e lacunas identificados
1. **Concorrência entre troca e ação do mecânico (prioridade alta).** As RPCs de iniciar/concluir diagnóstico, registrar andamento e concluir serviço verificam a atribuição ativa antes de executar a mutação. A função de troca bloqueia a linha da OS, mas as RPCs do mecânico não fazem uma validação final da atribuição depois de adquirir o mesmo bloqueio. Uma troca concorrente pode ocorrer entre a checagem de atribuição e a gravação da ação, permitindo que uma ação iniciada pelo mecânico anterior termine após a transferência. É necessário serializar todas essas operações pela mesma linha da OS e revalidar papel/atribuição ativa depois de obter o lock, dentro da transação.
2. **Validação do usuário selecionado na RPC.** A interface lista apenas convites de mecânico aceitos e não revogados, mas a RPC `assign_order_to_mechanic` valida apenas `has_role(..., 'mecanico')`. Chamada direta pode tentar atribuir um usuário que ainda mantenha papel de mecânico, mas cujo convite esteja revogado/inativo. A regra de elegibilidade deve ser aplicada também no banco, não só no seletor.
3. **Consulta de atribuição ativa.** A UI usa `maybeSingle()`; o fluxo transacional atual encerra as atribuições anteriores antes de inserir a nova, mas não foi identificada restrição UNIQUE parcial garantindo uma única atribuição ativa por OS. Recomenda-se índice único parcial para `service_order_id WHERE active`, após saneamento de eventuais duplicidades históricas.
4. **Histórico para o mecânico anterior.** Após a troca, a policy de logs deixa de permitir ao mecânico anterior consultar o histórico daquela OS, pois exige atribuição ativa. Isso não apaga o histórico: admin e secretaria continuam com acesso. Decidir se o mecânico anterior deve manter leitura somente dos registros que ele próprio criou; se sim, criar leitura histórica restrita por `mechanic_user_id = auth.uid()`, sem permitir novas gravações.

### Correção recomendada
- Alterar, pelo fluxo gerenciado de schema, todas as RPCs de ação do mecânico para bloquear a OS com `SELECT ... FOR UPDATE` antes de validar a atribuição e repetir a validação após adquirir o lock.
- Aplicar a mesma ordem de bloqueio em `assign_order_to_mechanic`, diagnóstico, andamento e conclusão para evitar deadlocks e janelas de corrida.
- Validar que o usuário designado possui papel mecânico e convite aceito, utilizado e não revogado, ou um estado de equipe equivalente que seja a fonte oficial.
- Adicionar unicidade de atribuição ativa por OS e teste de concorrência.
- Preservar todos os logs e eventos existentes. Se a oficina quiser histórico visível ao antigo responsável, liberar apenas leitura dos próprios registros, sem reativar acesso operacional.

### Limites e testes pendentes
- Auditoria estática dos arquivos e migrations versionados; não foram feitas sessões simultâneas reais nem chamadas REST/RPC.
- Nenhum banco foi acessado, migration criada/executada ou deploy realizado.
- `AGENTS.md` proíbe editar migrations manualmente; correções dependem do fluxo gerenciado de schema.
- Testes necessários: A é substituído por B; A tenta registrar andamento depois da troca; A tenta concluir diagnóstico/serviço depois da troca; convite revogado; duas trocas simultâneas; uma única atribuição ativa; preservação de logs e timeline; leitura histórica por A conforme decisão da oficina.


## Revisão específica — notificações após troca de mecânico (2026-11-12)

### Comportamento confirmado no código
- O painel `/equipe` do mecânico assina Realtime em `service_order_assignments` sem filtro explícito de OS. A policy RLS de SELECT limita os registros de atribuição do mecânico ao próprio `mechanic_user_id = auth.uid()`; portanto, eventos visíveis ao mecânico são limitados pelas permissões da tabela.
- Quando uma atribuição própria é inserida ou encerrada, o callback Realtime incrementa o contador e mostra uma notificação genérica de que a lista foi atualizada; em seguida recarrega as atribuições ativas. O novo responsável deve receber o evento de inserção da sua atribuição; o antigo pode receber o evento de encerramento da sua própria linha e recarregar a lista sem a OS.
- O carregamento da lista filtra `mechanic_user_id = user.id` e `active = true`, então o mecânico anterior deixa de ver a OS após a atualização da lista, desde que a consulta relacionada à OS esteja autorizada pelo RLS.
- A notificação push nativa de `src/lib/push-notifications.ts` registra token do aparelho no Worker, mas o envio de push implementado em `supabase/functions/_shared/push.ts` consulta exclusivamente usuários com papel `admin`. A função `notify-admin` também encaminha apenas eventos de agendamento, criação de OS, OS pronta e garantia.
- O trigger push observado é disparado por INSERT de agendamento/OS/garantia e UPDATE de status da OS. Não há trigger de push para INSERT/UPDATE em `service_order_assignments`.
- A migration que injeta `mechanic_name` no payload quando diagnóstico é concluído não torna o envio direcionado: o worker atual continua chamando `sendToAdmins`, e o nome do mecânico não é usado para selecionar destinatários.
- Não foi encontrado fluxo de push específico para avisar o mecânico antigo da retirada da OS nem o novo responsável da atribuição.

### Conclusão
- **Notificação dentro do aplicativo:** há atualização genérica em tempo real para alterações de atribuições que o mecânico pode ler, seguida de recarga da lista ativa. O código não identifica explicitamente “OS atribuída” versus “OS retirada”; a atualização depende de Realtime e da policy.
- **Push Android:** não há direcionamento para mecânicos na implementação revisada; o envio atual é somente para administradores.
- **Sem vazamento comprovado no push:** o fluxo atual não encaminha payload de atribuição a todos os mecânicos; a lacuna é ausência de push específico, não evidência de exposição de OS de terceiros.
- A subscription Realtime não contém filtro por usuário no cliente; o isolamento depende da RLS de `service_order_assignments`. Isso deve ser confirmado com duas sessões reais, pois não foram executados testes de Realtime autenticado.

### Correção recomendada
- Criar eventos de atribuição e retirada com destinatário explícito, derivados da transação de troca.
- Enviar push ao token do novo mecânico com aviso de nova OS e ao anterior com aviso de retirada, sem incluir CPF, telefone, endereço, valores ou detalhes desnecessários.
- No app, distinguir mensagens “Nova OS atribuída” e “OS transferida para outro mecânico”; atualizar a lista ativa após o evento.
- Resolver tokens por usuário autenticado e verificar o papel/atribuição no servidor; nunca confiar em destinatário fornecido pelo cliente.
- Tratar tokens inválidos e revogados, deduplicar notificações e evitar que falha de push reverta a troca de responsável.
- Testar troca A→B com duas sessões: B recebe a atribuição; A recebe a retirada e deixa de ver a OS na lista ativa; notificações não revelam dados de OS não atribuídas.

### Limites
- Auditoria estática dos arquivos versionados. Não houve sessão Android real, chamada ao Worker, envio FCM, acesso ao banco ou teste Realtime autenticado.
- Nenhuma migration criada/aplicada, nenhuma configuração de push alterada e nenhum deploy realizado.
- `AGENTS.md` proíbe edição manual de migrations; eventual alteração de trigger/schema deve seguir o fluxo gerenciado.
