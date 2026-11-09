# Plano de autenticação independente — Cleidson Diesel

## Objetivo

Substituir futuramente a dependência de autenticação do Supabase/Lovable por autenticação executada pelo próprio aplicativo no Cloudflare Workers, persistindo usuários e sessões no Neon PostgreSQL.

Este documento é um plano técnico. **Não altera o login atual e não é autorização para publicar ou migrar usuários.**

## Contas e perfis que o sistema deverá oferecer

A conta Google que o proprietário já utiliza atualmente será reconhecida como a conta principal e deverá receber o perfil **Administrador** no novo sistema, após validação segura da identidade. Não será necessário criar outra conta Google.

O sistema deverá ter três perfis distintos:

- **Administrador (proprietário):** acesso completo, inclusive gerenciamento de usuários, permissões e configurações.
- **Funcionário:** acesso individual com usuário e senha próprios, limitado às funções operacionais que o administrador liberar.
- **Secretária:** acesso individual com usuário e senha próprios, voltado às rotinas de atendimento e administrativas. Poderá **visualizar valores das ordens de serviço e pagamentos**. Ações como registrar, editar, estornar ou excluir pagamentos continuarão sujeitas a permissões específicas definidas pelo administrador.

Os acessos de funcionários e secretária serão criados ou convidados pelo administrador. Não haverá cadastro público que permita a qualquer pessoa escolher o próprio perfil ou virar administrador.

A matriz detalhada de permissões (por exemplo, visualizar valores, registrar pagamentos, editar diagnóstico, concluir OS e cancelar agendamentos) deverá ser confirmada antes de implementar as telas e regras. O servidor sempre validará as permissões; esconder botões no navegador não será considerado proteção.

## Comportamentos atuais que precisam ser preservados

A inspeção da branch `feat/cloudflare-neon-runtime` encontrou:

- Login por e-mail e senha.
- Cadastro atual por e-mail e senha.
- Login Google via integração Lovable.
- Rotas privadas verificam sessão antes de abrir `/painel`.
- O painel atualmente diferencia administradora de usuários comuns.
- O aplicativo Android usa o mesmo site e precisa continuar aceitando o fluxo de retorno OAuth.

## Proposta técnica para avaliação

Usar Better Auth com adaptador Drizzle e Neon PostgreSQL, no runtime Cloudflare Workers, desde que um protótipo confirme:
1. criação e renovação de sessão no Worker;
2. login Google com callback HTTPS e retorno correto ao site e ao APK;
3. login por e-mail/senha;
4. criação e desativação de contas de funcionários e secretária pelo administrador;
5. encerramento de sessão;
6. proteção server-side de rotas e funções;
7. autorização por perfil validada no servidor em cada operação.

O Better Auth é uma camada de autenticação do aplicativo; não substitui o Neon. O Neon continua sendo o banco PostgreSQL.

## Regras de segurança obrigatórias

- A conta Google principal do proprietário será identificada e validada explicitamente antes de receber o papel administrador.
- Não conceder papel de administrador automaticamente a visitantes ou novos cadastros.
- Não permitir que funcionários ou secretária alterem o próprio perfil ou criem outras contas.
- Não confiar em papel, e-mail ou ID enviado pelo navegador sem validação server-side.
- Não expor segredo OAuth, segredo de sessão ou `DATABASE_URL` no código cliente, commits, logs ou respostas HTTP.
- Usar cookies de sessão seguros, com proteção CSRF/origin conforme a biblioteca e o ambiente.
- Permitir que o administrador desative o acesso de um funcionário/secretária e invalide suas sessões.
- Não apagar nem alterar usuários no Supabase durante o protótipo.
- Não desativar o login atual até concluir testes de equivalência e plano de retorno.

## Migração de contas

Não copiar hashes de senha ou sessões do Supabase por suposição. Antes da migração, inventariar os usuários e decidir um fluxo seguro:
- proprietário: entrar com a mesma conta Google já utilizada e validar a identidade antes de conceder o perfil administrador;
- usuários Google: entrar novamente com a mesma conta Google e vincular identidade somente após verificação;
- usuários de e-mail/senha: planejar redefinição de senha ou outro fluxo oficial de revalidação;
- funcionários e secretária: criar contas individuais e enviar convite seguro; nunca compartilhar a senha do proprietário.

Nenhum dado de usuário foi migrado.

## Etapas de implementação propostas

1. Criar um protótipo isolado de autenticação na branch de testes, sem substituir as rotas atuais.
2. Criar tabelas de usuário, conta OAuth, sessão e verificação conforme o schema oficial do Better Auth/Drizzle, incluindo papéis e estado ativo/inativo.
3. Configurar Google OAuth com URLs de callback próprias do ambiente de teste.
4. Testar login/logout no navegador e no APK de teste.
5. Implementar a conta principal do proprietário e a gestão de contas de funcionários/secretária.
6. Implementar autorização server-side por perfil e testar acesso negado por padrão.
7. Só depois planejar migração de usuários e integração gradual das rotas do painel.

## Estado atual

- O app continua usando Supabase/Lovable para autenticação e operações.
- Neon contém as cinco tabelas operacionais simplificadas e ainda não contém as tabelas de autenticação independente.
- Nenhum usuário foi migrado e nenhum perfil novo foi criado.
- Nenhum segredo OAuth novo foi solicitado ou armazenado.
- Não executar migrations novas no Neon e não publicar/mesclar PRs nesta etapa.
