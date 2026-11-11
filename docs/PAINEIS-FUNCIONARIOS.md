# Painéis de funcionários — plano de implementação

## Objetivo
Adicionar painéis de Secretária e Mecânico ao aplicativo Cleidson Diesel, mantendo o painel atual do Administrador e sem publicar alterações até revisão.

## Regras funcionais aprovadas

### Secretária
- Entrar com nome de usuário e senha, sem exigir e-mail ou Google.
- Consultar e administrar agendamentos, clientes, orçamentos, ordens de serviço e acompanhamento dos serviços.
- Emitir ordens de serviço, confirmar agendamentos e acrescentar serviços às ordens.
- Direcionar uma ordem de serviço a um mecânico.
- Não acessar configurações administrativas nem gerenciamento de usuários.

### Mecânico
- Entrar com nome de usuário e senha.
- Visualizar somente as ordens de serviço atribuídas a ele.
- Consultar agendamentos, sem confirmar, criar ou alterar agendamentos.
- Registrar os procedimentos executados e seus resultados na ordem atribuída.
- Não emitir ordens, não acrescentar serviços à ordem, não alterar valores/orçamentos e não confirmar agendamentos.
- **IA e diagnóstico por inteligência artificial ficam fora desta etapa.** Poderão ser avaliados em uma fase futura, mediante autorização.

### Registro de execução do mecânico
Cada registro deve guardar, no mínimo: ordem de serviço, funcionário, data/hora, tipo de procedimento, descrição, resultado e observações. Exemplos:
- remoção da bomba injetora;
- remoção dos bicos injetores;
- teste de bomba;
- teste de bicos;
- passagem de scanner;
- diagnóstico eletrônico;
- reparo;
- montagem/instalação;
- teste final.

Os registros são histórico técnico. Somente Secretária e Administrador podem decidir se um serviço será acrescentado oficialmente à ordem de serviço.

### Administrador
- Mantém acesso completo.
- Gerencia os cadastros de funcionários e atribuições.
- Pode emitir/editar ordens e acrescentar serviços.

## Segurança obrigatória
- Autorização aplicada no banco/RLS ou em funções de servidor verificadas; esconder botões/rotas no frontend não é controle de acesso suficiente.
- Não conceder permissões a todo usuário comum existente. Cada funcionário precisa de papel explícito (secretária ou mecânico).
- Mecânico só pode ler ordens atribuídas ao próprio usuário e inserir registros de execução vinculados a essas ordens.
- Mecânico não pode atualizar os campos comerciais/administrativos da ordem.
- Secretária não pode administrar papéis, usuários ou configurações.
- Senhas nunca podem ser armazenadas em texto puro nem expostas ao frontend.
- Login por nome e senha deve usar autenticação segura no servidor, com proteção contra enumeração de usuários e tentativas repetidas. A identidade autenticada deve ser vinculada a um usuário Supabase e a um papel explícito.
- Criar funcionário e redefinir senha somente por ação autorizada do Administrador.
- Não enviar notificações reais de teste nem alertas a clientes durante desenvolvimento.

## Dependências de banco antes das telas operacionais
1. Papéis explícitos para admin, secretary e mechanic, sem promover usuários existentes automaticamente.
2. Identificador de login (nome de usuário único e normalizado) vinculado ao usuário autenticado; credenciais geridas por serviço seguro, nunca em tabela legível pelo cliente.
3. Atribuição de ordens a mecânicos.
4. Tabela de registros técnicos imutáveis ou com trilha de auditoria, com RLS por papel e atribuição.
5. Funções/policies para que secretária e administrador gerenciem agendamentos e ordens; mecânico apenas consulte as ordens atribuídas e registre execução.
6. Ajustar notificações push e central de notificações para os novos papéis sem ampliar acesso a dados.

## Situação do código existente
- A aplicação usa Supabase Auth com e-mail/senha e OAuth no fluxo atual.
- O guard de painel atualmente reconhece apenas o papel admin.
- As políticas existentes protegem ordens, agendamentos e cadastros como admin-only.
- Já existe checklist interno em service_orders, mas ele não substitui um histórico por funcionário e por etapa.
- A documentação AGENTS.md determina que mudanças de schema sejam feitas pelo fluxo Lovable, e não por edição manual das migrations do repositório.

## Critérios de aceite
- Usuários atuais e o administrador continuam entrando como antes.
- Secretária e mecânico entram com nome e senha, sem precisar de e-mail ou Google.
- Cada rota, consulta e mutação é autorizada no servidor/banco.
- Testes provam que mecânico não confirma agendamento, não cria OS e não acrescenta serviço.
- Testes provam que mecânico não enxerga ordens atribuídas a outro mecânico.
- Testes provam que secretária não administra usuários nem configurações.
- Testes provam que só secretária/admin acrescentam serviços oficialmente à OS.
- Build, lint e testes passam antes de abrir para publicação.
