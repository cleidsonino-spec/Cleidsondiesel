# Auditoria de integridade após exclusões e alterações administrativas — PR #54

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`  
Escopo: revisão estática de grants, RLS, FKs, triggers e trilhas de auditoria para OS, financeiro, estoque, recebimento, autorizações e garantias.

## Resumo

Os registros financeiros, movimentações de estoque, recebimentos, autorizações, eventos de histórico e garantias possuem controles relevantes contra exclusão ou alteração direta por usuários autenticados. A OS, porém, ainda pode ser fisicamente excluída por administrador quando não há relação protegida por FK. Isso deixa um risco residual para OS legadas ou incompletas sem registros dependentes. Além disso, alterações administrativas em campos editáveis da OS continuam sem histórico de versões.

A revisão é estática: não houve teste com API, perfis reais ou banco.

## Controles confirmados

### Ordens de serviço
- A policy de DELETE da tabela `service_orders` é exclusiva de admin.
- A secretaria não recebeu policy de DELETE nas migrations revisadas.
- O histórico de status usa FK para OS com `ON DELETE RESTRICT`.
- O recebimento, autorizações, pagamentos, movimentações de estoque e retornos em garantia também usam referências restritivas à OS em suas definições revisadas.
- Mudanças de status não podem ser feitas por UPDATE direto de usuários autenticados; o acesso à coluna `status` foi revogado e as transições dependem dos fluxos autorizados.
- A edição operacional de outros campos continua permitida conforme grants/RLS; não foi encontrada trilha genérica de versões desses campos.

### Financeiro
- `service_order_payments` e `shop_expenses` concedem a authenticated somente SELECT e INSERT; UPDATE e DELETE não são concedidos.
- RLS restringe leitura e inserção a admin.
- Pagamentos têm FK `service_order_id ... ON DELETE RESTRICT`, preservando a OS enquanto houver recebimentos vinculados.
- Idempotência por chave única protege contra repetição acidental de lançamentos.
- Trigger impede pagamento em OS cancelada, acima do saldo e redução do total abaixo dos recebimentos registrados.
- Despesas não são vinculadas a uma OS; são lançamentos independentes e imutáveis para usuários autenticados.

### Estoque
- Movimentações têm FKs restritivas para item, fornecedor e OS.
- Usuários autenticados recebem SELECT/INSERT, não UPDATE/DELETE, em `inventory_movements`.
- Saldo é alterado pelo trigger de movimento; UPDATE direto de `inventory_items` foi revogado para authenticated.
- Movimentos possuem chave de idempotência obrigatória e única após as migrations de endurecimento.
- O histórico de movimentação permanece como livro de movimentos; não há estorno automático no cancelamento da OS.

### Recebimento e autorizações
- Ficha de recebimento referencia OS com `ON DELETE RESTRICT`; authenticated recebe SELECT/INSERT, não UPDATE/DELETE.
- Autorizações do cliente também referenciam OS com `ON DELETE RESTRICT`; authenticated recebe SELECT, sem INSERT/UPDATE/DELETE direto. A escrita ocorre por RPC.
- Esses registros não são apagados pelo fluxo normal da interface revisado.

### Garantias e retornos
- Garantias têm trigger que bloqueia DELETE e registra snapshots antes/depois das alterações.
- Retornos referenciam garantia e OS com `ON DELETE RESTRICT`; a escrita ocorre por RPC e os eventos de retorno guardam snapshots.
- A garantia não pode ser transferida para outra OS nem ter autoria/data de início alteradas.

## Riscos e lacunas residuais

### 1. Exclusão física de OS legada sem registros dependentes
A policy permite DELETE para admin. FKs restritivas impedem apagar OS com histórico, pagamento, recebimento, autorização, movimento de estoque ou retorno vinculado. Porém, uma OS antiga ou incompleta sem nenhuma dessas relações pode não ter uma FK que impeça a exclusão. O histórico de status informa que eventos anteriores à ativação não são reconstruídos.

**Risco:** perda definitiva da OS e dos dados operacionais que existirem apenas na própria linha, caso um admin exclua uma OS sem relações protegidas.

**Recomendação:** decidir se a oficina deve proibir DELETE físico de todas as OS, inclusive legadas, e manter cancelamento como única forma de encerramento administrativo. Se confirmado, implementar por mudança gerenciada de schema/policy, preservando o fluxo de cancelamento e sem apagar dados antigos.

### 2. Alterações administrativas sem versionamento completo
A edição de campos da OS não registra genericamente valor anterior/novo. A trilha atual cobre status e eventos operacionais específicos, mas não demonstra histórico para reclamação, diagnóstico, valores, datas, quilometragem, observações e demais campos editáveis.

**Risco:** uma alteração administrativa acidental ou indevida pode sobrescrever o conteúdo anterior sem possibilidade de reconstrução pela linha do tempo existente.

**Recomendação:** auditoria de UPDATE da OS no banco, com usuário autenticado, timestamp, campos alterados e snapshots mínimos anterior/novo. Evitar incluir dados pessoais desnecessários e restringir leitura da trilha a admin.

### 3. Exclusão de agendamento pode desvincular a OS
A definição inicial de `service_orders.appointment_id` usa `ON DELETE SET NULL`. Portanto, excluir um agendamento relacionado pode remover o vínculo da OS com a agenda sem excluir a OS. Não foi comprovada trilha específica dessa desvinculação. Isso não apaga a OS nem os registros financeiros, mas pode dificultar a rastreabilidade da origem do atendimento.

**Recomendação:** avaliar se agendamentos devem ser cancelados/inativados em vez de excluídos e se a OS deve preservar um snapshot ou evento da referência original.

## Testes necessários antes de declarar proteção completa

1. Admin tenta excluir OS sem relações dependentes; secretaria tenta o mesmo.
2. Admin tenta excluir OS com histórico, pagamento, recebimento, autorização, movimento de estoque e garantia/retorno.
3. Testar OS legada sem evento inicial e sem relações dependentes.
4. Tentar UPDATE/DELETE direto em pagamentos, despesas, movimentos, recebimentos, autorizações e eventos usando API autenticada.
5. Alterar campos operacionais da OS e verificar se a auditoria de versões registra antes/depois após eventual implementação.
6. Excluir/cancelar agendamento vinculado e verificar preservação do vínculo histórico com a OS.
7. Confirmar que cancelamento preserva todos os registros e não executa estornos ou baixas de estoque implícitos.

## Limites e decisões pendentes

- Não houve alteração de código ou migration.
- Nenhum banco Supabase foi acessado; nenhuma migration foi executada.
- Nenhum teste real de RLS/API ou concorrência foi realizado.
- As conclusões de permissões são leitura estática das migrations versionadas.
- O repositório proíbe edição manual de `supabase/migrations/` e `drizzle/`; não foi contornado esse limite.
- O fluxo de cancelamento seguro continua especificado, mas não foi implementado nesta etapa.
- Nenhum deploy foi realizado.

## 4. Auditoria complementar — exclusão de cadastros e registros operacionais (2026-11-12)

### Clientes e veículos
- `drizzle/migrations/0006_customers_vehicles_and_warranty_module.sql` concede `SELECT, INSERT, UPDATE, DELETE` a `authenticated` nas tabelas `customers` e `vehicles`, com RLS `FOR ALL` limitada a admin.
- A interface em `src/components/painel/registry-page.tsx` oferece exclusão de clientes e veículos ao administrador e executa `.delete()` diretamente.
- A FK `vehicles.customer_id` não declara `ON DELETE CASCADE`; portanto, cliente com veículo vinculado não deve ser apagado. A FK `service_orders.customer_id` e `service_orders.vehicle_id` também não especifica cascata; registros referenciados devem impedir exclusão pela integridade referencial.
- **Risco residual:** cliente ou veículo sem vínculo atual pode ser excluído fisicamente, sem trilha de auditoria própria. O histórico de OS guarda snapshots de dados, mas isso não equivale a preservar o cadastro mestre ou registrar a exclusão.
- Recomendação: preferir inativação/arquivamento com trilha de quem e quando, mantendo os IDs e referências. Não criar soft delete sem definir o comportamento de busca, cadastro duplicado e reativação.

### Agendamentos
- A migration inicial concede `DELETE` a `authenticated` e policy `Admins delete appointments` permite exclusão a admin.
- `service_orders.appointment_id` foi definido com `ON DELETE SET NULL`. Excluir agendamento que originou uma OS remove o vínculo de origem, sem apagar a OS.
- A tela atual de agendamentos revisada não apresentou chamada `.delete()` nem botão de exclusão nos trechos encontrados; a permissão de API, porém, permanece no schema versionado.
- Recomendação: revogar exclusão direta e usar status `cancelado` para agendamentos não convertidos. Para agendamento já convertido em OS, preservar vínculo histórico e registrar cancelamento/alteração sem apagar o registro.

### Estoque e fornecedores
- `suppliers` e `inventory_items` têm grants autenticados de SELECT/INSERT/UPDATE, sem DELETE. Embora as policies sejam `FOR ALL`, o privilégio SQL de DELETE não foi concedido a `authenticated`; a policy isolada não concede privilégio.
- A interface deve preferir o campo `active` para inativar fornecedor/item, em vez de exclusão física.
- `inventory_movements` concede apenas SELECT/INSERT; não há UPDATE/DELETE para authenticated. FKs usam `ON DELETE RESTRICT` para item, fornecedor e OS, preservando o livro de movimentos.
- Resultado estático: o desenho do estoque é mais protetivo que clientes/veículos e agendamentos.

### Financeiro, recebimento, autorizações e garantias
- Pagamentos e despesas: grants apenas SELECT/INSERT para authenticated; sem UPDATE/DELETE direto.
- Recebimentos: SELECT/INSERT; sem UPDATE/DELETE direto.
- Autorizações: SELECT; gravação por RPC; sem DELETE direto.
- Garantias: a migration final revoga todos os privilégios e concede apenas SELECT/INSERT/UPDATE a authenticated; sem DELETE direto. Triggers de auditoria registram alterações e bloqueiam exclusão da garantia.
- Retornos e eventos de garantia: SELECT para authenticated e gravação por RPC/trigger; sem DELETE direto concedido.
- As FKs `ON DELETE RESTRICT` em pagamentos, recebimentos, autorizações, estoque e garantias também protegem OS e registros vinculados.

### Prioridade recomendada
1. Revogar DELETE de `appointments` e remover a policy `Admins delete appointments`; preservar cancelamento por status e manter vínculo de origem com OS.
2. Para clientes e veículos, substituir exclusão física na interface por inativação/arquivamento auditável, após definir o contrato funcional e o suporte de schema.
3. Manter imutabilidade de movimentos de estoque, pagamentos, despesas, recebimentos, autorizações e eventos de garantia.
4. Manter a proteção da OS já especificada: revogar DELETE direto e disponibilizar cancelamento somente por RPC transacional auditável.

### Limites
- Auditoria estática das migrations e telas versionadas; não houve chamada real à API nem teste de RLS.
- Nenhuma migration foi criada, alterada ou executada; nenhuma mudança de produção foi feita.
- A branch/PR continua sendo proposta não mesclada. A proteção efetiva depende da execução das mudanças de schema pelo fluxo gerenciado autorizado.

## 5. Proteção de agendamentos — especificação para o schema gerenciado (2026-11-12)

### Comportamento atual confirmado na aplicação
- `src/routes/_authenticated/painel.agendamentos.tsx` não apresenta ação de exclusão física.
- A ação disponível para atendimentos ativos chama UPDATE de `status` para `cancelado`; portanto, a interface já utiliza cancelamento lógico.
- `src/routes/_authenticated/painel.ordens.nova.tsx` cria a OS com `appointment_id` apontando para o agendamento de origem e, após a criação, atualiza o agendamento para `concluido`.
- A OS e o agendamento permanecem vinculados após a conversão; não há exclusão de agendamento nesse fluxo.
- O status `concluido` não exibe o botão de cancelamento na linha da agenda. O status `compareceu` ainda permite cancelar antes da conversão em OS.

### Risco no banco
A migration inicial `drizzle/migrations/0000_oficina_schema.sql` concede `SELECT, INSERT, UPDATE, DELETE` em `public.appointments` para `authenticated` e cria a policy `Admins delete appointments`. A migration de acesso da secretaria adiciona leitura/atualização, sem remover a policy de DELETE. Logo, um administrador ainda pode excluir diretamente pela API, mesmo sem botão na tela.

A FK `service_orders.appointment_id` usa `ON DELETE SET NULL`: a exclusão do agendamento não apaga a OS, mas elimina a referência histórica entre os registros.

### Mudança solicitada ao fluxo de schema gerenciado
1. Revogar o privilégio `DELETE` de `authenticated` em `public.appointments`.
2. Remover a policy `Admins delete appointments`.
3. Não conceder DELETE a secretaria nem a usuário comum.
4. Manter INSERT público limitado ao status inicial pendente; manter SELECT/UPDATE conforme os papéis operacionais existentes.
5. Preservar o cancelamento como UPDATE de status para `cancelado`, com registro de quem/quando em trilha de eventos se o schema gerenciado suportar essa auditoria.
6. Alterar a FK `service_orders.appointment_id` de `ON DELETE SET NULL` para `ON DELETE RESTRICT` como segunda barreira, após confirmar o estado real do schema e a compatibilidade com dados existentes. A restrição não substitui revogar DELETE, pois agendamentos ainda sem OS poderiam ser apagados.
7. Não criar exclusão em cascata, não apagar agendamento ao cancelar OS e não permitir que cancelar um agendamento reverta ou altere a OS já aberta.

### Critérios de aceite antes de ativar a proteção
- Admin: DELETE direto na API deve ser negado.
- Secretaria: DELETE direto na API deve ser negado.
- Usuário comum: DELETE direto na API deve ser negado.
- Admin e secretaria mantêm as atualizações de status permitidas pelas políticas operacionais.
- Cancelar um agendamento mantém o registro e o horário deixa de ocupar a agenda conforme o índice parcial atual.
- Converter agendamento em OS mantém o vínculo e muda o agendamento para concluído.
- Agendamento vinculado a OS não pode ser apagado nem desvinculado por exclusão.
- Nenhuma OS, pagamento, recebimento ou movimento de estoque é alterado por cancelamento de agendamento.

### Limite de execução
O arquivo `AGENTS.md` determina que migrations `supabase/` e `drizzle/` são gerenciadas pelo fluxo do projeto e não devem ser editadas manualmente. Por isso, esta etapa registra a especificação e os critérios de aceite; não modifica migrations, não acessa Supabase e não executa alterações de banco. A proteção de API só poderá ser declarada depois que a mudança de schema for aplicada pelo fluxo gerenciado e testada.

## 6. Clientes e veículos — proteção de exclusão e plano de inativação (2026-11-12)

### Situação encontrada
- O schema inicial cria `customers` e `vehicles` sem coluna de situação ativa/inativa.
- Os grants concedem DELETE a `authenticated`, enquanto RLS limita as operações a admin.
- A interface anterior apresentava exclusão física para admin em ambos os cadastros.
- FKs sem cascata protegem registros que já possuem dependências, mas não impedem apagar cadastros sem vínculos.
- OS mantém snapshots próprios de nome, telefone, placa e veículo; esses snapshots não substituem o cadastro mestre nem uma trilha de arquivamento.

### Proteção aplicada na interface
- Removida a função que executava DELETE em `customers` e `vehicles`.
- Removidos os botões de exclusão física dos dois cadastros.
- Incluído aviso explicando que a exclusão foi desativada e que a inativação depende de atualização gerenciada do banco.
- Edição, criação, histórico e abertura de OS foram preservados.
- Arquivo: `src/components/painel/registry-page.tsx`.
- Esta alteração evita exclusão acidental pela interface, mas não revoga a permissão DELETE existente na API para admin.

### Especificação necessária para inativação real
A mudança de schema deve ser incremental e preservar IDs e relações:
1. Adicionar estado ativo/inativo a clientes e veículos, com padrão ativo para registros existentes.
2. Registrar autoria e data/hora da inativação e reativação; preferir trilha de eventos imutável para não perder mudanças anteriores.
3. Impedir seleção de cadastros inativos em novos vínculos e novos cadastros de veículo, sem removê-los de históricos e OS existentes.
4. Permitir consulta histórica de clientes/veículos inativos e oferecer filtro explícito entre ativos e inativos.
5. Definir fluxo administrativo de reativação, com auditoria.
6. Revogar DELETE de `authenticated` nas duas tabelas e remover/ajustar policies que permitam exclusão; manter privilégios de leitura, criação e edição conforme a regra admin-only.
7. Preservar snapshots existentes das OS e validar que a inativação não altera OS, garantias, pagamentos, recebimentos, estoque ou portal do cliente.

### Critérios de aceite
- Admin não consegue excluir cliente ou veículo via API direta.
- Cadastro ativo pode ser inativado sem apagar linha, ID ou relações.
- Cadastro inativo não aparece como opção para novo vínculo; permanece pesquisável no histórico.
- OS antiga continua exibindo os snapshots originais mesmo após edição, inativação ou reativação do cadastro mestre.
- Veículo vinculado a cliente inativo continua acessível no histórico; não pode ser usado para novo vínculo enquanto inativo.
- Reativação exige permissão admin e deixa evento de auditoria.
- Busca pública por placa não deve revelar dados adicionais de cadastros inativos; o contrato da RPC deve ser revisado junto com a regra de inativação.
- Testes devem cobrir duplicidade de CPF/CNPJ e placa quando um registro está inativo, definindo antes se reativação deve ocorrer ou se é permitido novo cadastro. Não criar duplicatas automaticamente.

### Limites
- Nenhuma migration foi criada ou executada, conforme a regra de `AGENTS.md`.
- Nenhum teste de banco/API foi executado.
- A UI não oferece mais exclusão física, mas a API ainda pode permitir DELETE a admin até a mudança gerenciada do schema.
- Inativação real, filtros, reativação e auditoria permanecem pendentes.

## 7. Vínculo de clientes e veículos na abertura de OS (2026-11-12)

### Achado e correção na interface
- A seleção de um cliente diferente na abertura da OS limpava `vehicle_id`, mas mantinha placa, modelo, ano e quilometragem do veículo anteriormente selecionado.
- Como o vínculo de veículo era removido, a validação do banco `validate_order_registry()` não verificava esses campos manuais; a OS poderia ser salva com cliente novo e dados visuais do veículo anterior, sem vínculo formal com esse veículo.
- Corrigido em `src/components/painel/order-form.tsx`: ao trocar o cliente, limpa o vínculo e os campos do veículo anterior. Se o cliente não mudar, preserva os dados.
- Adicionada validação antes do envio: quando há `vehicle_id`, o veículo precisa existir na lista carregada e seu `customer_id` deve corresponder ao cliente selecionado. Se não corresponder, a OS não é enviada e a tela informa o conflito.

### Controles mantidos
- Seleção manual continua permitida, inclusive OS sem vínculo com cadastro, conforme o fluxo atual.
- A seleção de veículo cadastrado continua preenchendo cliente, telefone, placa, modelo, ano e quilometragem.
- O trigger de banco `validate_order_registry()` continua sendo a barreira para veículos vinculados: exige veículo, cliente e placa compatíveis.
- A OS mantém snapshots próprios dos dados de cliente/veículo; a correção não reescreve OS antigas.

### Limitações e próximos requisitos
- Como o schema ainda não possui `is_active`/estado de arquivamento, a interface não consegue filtrar clientes e veículos inativos. A inativação real exige alteração de schema pelo fluxo gerenciado.
- A validação de propriedade no frontend melhora a mensagem e evita envio inconsistente na operação normal, mas não substitui a validação do banco para chamadas diretas à API.
- O trigger atual valida relação e placa apenas quando `vehicle_id` não é nulo; OS com dados manuais sem vínculo permanecem permitidas intencionalmente.
- Testes pendentes: trocar cliente após selecionar veículo; selecionar veículo de outro cliente; digitar placa manual após selecionar veículo; abrir OS sem vínculo; editar OS antiga; verificar snapshots históricos; API direta com cliente/veículo incompatíveis.
- Nenhum banco ou API live foi acessado; nenhuma migration foi alterada ou executada.

## 8. Edição de OS — coerência entre cadastro e snapshots (2026-11-12)

### Controles revisados
- A tela de edição carrega a OS pelo ID e inicializa o formulário com os vínculos customer_id e vehicle_id, além dos snapshots customer_name, phone, plate, vehicle e vehicle_year armazenados na própria OS.
- A troca de cliente no formulário limpa o vínculo do veículo e os campos de veículo anteriores; a escolha de um veículo cadastrado atualiza cliente, telefone e dados do veículo.
- Antes de salvar, o formulário verifica se o veículo vinculado ainda existe na lista carregada e se pertence ao customer_id selecionado.
- O salvamento da edição atualiza os campos operacionais da OS, removendo status do payload. As mudanças de status continuam reservadas aos fluxos autorizados.
- O trigger validate_order_registry() no schema revisado rejeita veículo vinculado que não pertença ao cliente indicado ou cuja placa normalizada não corresponda à placa da OS. A proteção ocorre no banco para INSERT/UPDATE dos campos de vínculo e placa.

### Decisão de integridade dos snapshots
- Nome, telefone, placa e descrição do veículo na OS são snapshots operacionais próprios. Não devem ser sincronizados automaticamente com alterações posteriores do cadastro mestre, pois isso poderia reescrever documentos e registros históricos.
- O formulário permite edição desses snapshots sem necessariamente alterar o cadastro mestre. Isso é compatível com o modelo de snapshots independentes, mas a tela deve deixar claro que está alterando os dados registrados naquela OS, não o cadastro do cliente/veículo.
- O schema revisado não demonstra uma trilha genérica de versões para todas as alterações da OS. A linha do tempo atual registra status e eventos específicos, mas não recupera automaticamente versões anteriores de nome, telefone, placa, veículo, reclamação, diagnóstico, valores, datas ou observações.

### Riscos e requisitos pendentes
1. A validação do banco é forte para veículo cadastrado vinculado, mas não exige vínculo de cadastro: OS com vehicle_id nulo e dados manuais continua sendo permitida intencionalmente.
2. O banco não valida que customer_name e phone sejam iguais aos dados atuais do cadastro. Não se deve adicionar essa igualdade sem decisão de negócio, pois os snapshots podem precisar preservar o que foi informado/confirmado no atendimento.
3. Como clientes e veículos ainda não têm estado ativo/inativo no schema revisado, não há como impedir por banco a utilização de cadastros futuramente inativados. A regra de inativação deverá bloquear novos vínculos, sem invalidar OS existentes.
4. A ausência de versionamento genérico significa que uma edição pode substituir snapshots anteriores sem recuperabilidade. Recomenda-se trilha administrativa de UPDATE com ator, horário e campos/snapshots anterior e novo, com acesso restrito.

### Testes de aceitação pendentes
- Editar OS com veículo vinculado e manter cliente/veículo/placa compatíveis.
- Tentar trocar somente cliente, somente veículo e somente placa, confirmando que combinações incompatíveis são rejeitadas.
- Editar OS sem vínculo cadastral e confirmar que os dados manuais continuam permitidos.
- Alterar o cadastro mestre e confirmar que snapshots de OS anteriores não mudam.
- Alterar snapshots na OS e confirmar que o cadastro mestre não é alterado.
- Quando a inativação for implementada pelo schema gerenciado, confirmar que cadastros inativos não podem ser usados em novos vínculos, mas continuam legíveis no histórico.
- Confirmar trilha de antes/depois das edições após implementação de auditoria genérica.

### Limites
- Revisão estática dos arquivos da branch; não houve teste real de formulário, banco ou API.
- Nenhum código adicional foi alterado nesta etapa porque os controles atuais de vínculo já existem e uma mudança de sincronização dos snapshots poderia corromper o histórico.
- Nenhuma migration foi criada, editada ou executada; nenhuma alteração de banco ou deploy foi realizada.

