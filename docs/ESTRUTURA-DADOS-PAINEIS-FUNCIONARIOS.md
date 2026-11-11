# Estrutura de dados — painéis de funcionários

> Documento de implementação/revisão. Este arquivo NÃO é uma migration e não foi executado no Supabase. O projeto determina que alterações de schema sejam aplicadas pelo fluxo Lovable. Não executar este SQL diretamente nem em produção sem revisão.

## Estado verificado em 10/11/2026
- Projeto Supabase ativo.
- `public.app_role` contém apenas `admin` e `user`.
- Existem `public.user_roles`, `public.service_orders` e `public.appointments`.
- Não foi encontrada estrutura de atribuição de OS a mecânicos nem histórico de procedimentos por funcionário.

## Modelo proposto

### Papéis
Adicionar papéis explícitos `secretary` e `mechanic` ao modelo de autorização existente. Contas com papel `user` continuam sem acesso ao painel; não converter usuários existentes automaticamente.

### Identidade do funcionário
Manter Supabase Auth como provedor de identidade. Adicionar um identificador de usuário de login único, normalizado e não sensível, ligado ao UUID de Auth. O fluxo de login por username deve resolver a identidade exclusivamente no servidor e então usar o fluxo seguro de Auth; nunca armazenar senha em tabela própria, nunca expor Service Role no cliente e nunca revelar se um username existe.

### Atribuição de OS
Criar relação de atribuições entre `service_orders.id` e o usuário com papel `mechanic`. Atribuições precisam registrar quem atribuiu e quando. Uma OS pode ter mais de um mecânico se essa regra for confirmada; até lá, tratar uma atribuição ativa por OS como padrão.

### Histórico técnico
Criar tabela de registros com:
- UUID do registro;
- UUID da OS;
- UUID do funcionário autenticado;
- tipo de procedimento;
- descrição;
- resultado;
- observações;
- data/hora do servidor.

Os registros são evidência técnica e não alteram automaticamente serviços, preços, orçamento, status comercial ou itens da OS. Secretária/Admin decide o que será incorporado oficialmente à OS.

## Matriz de autorização

| Ação | Admin | Secretária | Mecânico |
|---|---:|---:|---:|
| Gerenciar usuários e papéis | Sim | Não | Não |
| Ver todas as OS | Sim | Sim | Não |
| Ver OS atribuída | Sim | Sim | Sim |
| Atribuir mecânico | Sim | Sim | Não |
| Criar/editar OS e serviços comerciais | Sim | Sim | Não |
| Ver agendamentos | Sim | Sim | Sim (consulta) |
| Criar/confirmar/alterar agendamento | Sim | Sim | Não |
| Registrar procedimento técnico | Sim | Sim | Sim, somente em OS atribuída |
| Alterar preço/orçamento | Sim | Sim, conforme regras atuais | Não |
| Configurações administrativas | Sim | Não | Não |

## Regras RLS/servidor obrigatórias
1. Mecânico lê somente OS com atribuição ativa ao próprio `auth.uid()`.
2. Mecânico insere histórico somente para OS atribuída a ele; o autor deve ser preenchido pelo servidor/banco, nunca aceito do cliente.
3. Mecânico não recebe UPDATE/DELETE em campos de OS, serviços, valores, agendamentos ou orçamentos.
4. Secretária recebe apenas as permissões operacionais explicitamente listadas; sem gerenciamento de papéis ou configurações.
5. Admin mantém acesso atual.
6. Não confiar em filtros React, rotas ocultas ou IDs enviados pelo cliente como autorização.
7. Testar acesso cruzado entre dois mecânicos e tentativas de mutação proibidas.

## Integração Cloudflare
- Cloudflare Worker pode ser a camada HTTP para operações de funcionário e validação adicional de sessão.
- Worker deve validar JWT Supabase e papel/atribuição por RPCs seguras; não confiar em username, role ou user_id enviados pelo navegador.
- Segredos ficam exclusivamente em bindings/secrets do Worker.
- Não duplicar credenciais de Auth em D1/KV.
- Não ativar rotas até as funções e políticas do Supabase estarem prontas.
- Worker de push existente deve ser adaptado separadamente, preservando os bindings atuais; nenhum token de push deve dar acesso a dados.

## Critérios de teste
- Secretária não consegue adicionar/remover papéis nem abrir configurações administrativas.
- Mecânico A não consegue ler OS atribuída apenas ao Mecânico B.
- Mecânico não consegue criar OS, alterar agenda, inserir serviço comercial, mudar valor ou aprovar orçamento.
- Mecânico consegue registrar procedimento em OS atribuída e não consegue forjar o autor.
- Admin continua com acesso completo.
- Contas comuns existentes continuam sem acesso aos painéis de funcionários.
