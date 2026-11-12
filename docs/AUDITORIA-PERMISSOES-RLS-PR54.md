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
