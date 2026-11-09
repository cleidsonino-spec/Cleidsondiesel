# Plano de autenticação independente — Cleidson Diesel

## Objetivo

Substituir futuramente a dependência de autenticação do Supabase/Lovable por autenticação executada pelo próprio aplicativo no Cloudflare Workers, persistindo usuários e sessões no Neon PostgreSQL.

Este documento é um plano técnico. **Não altera o login atual e não deve ser tratado como autorização para publicar ou migrar usuários.**

## Comportamentos atuais que precisam ser preservados

A inspeção da branch `feat/cloudflare-neon-runtime` encontrou:

- Login por e-mail e senha em `src/routes/auth.tsx`.
- Cadastro por e-mail e senha.
- Login Google via integração Lovable em `src/routes/auth.tsx`.
- A primeira conta criada recebe papel de administradora; contas seguintes recebem papel comum, conforme a migration histórica.
- Rotas privadas verificam sessão antes de abrir `/painel`.
- O painel verifica papel de administrador antes de liberar operações.
- O aplicativo Android usa o mesmo site e precisa continuar aceitando o fluxo de retorno OAuth.

## Proposta técnica para avaliação

Usar Better Auth com adaptador Drizzle e Neon PostgreSQL, no runtime Cloudflare Workers, desde que um protótipo confirme:
1. criação e renovação de sessão no Worker;
2. login Google com callback HTTPS e retorno correto ao site e ao APK;
3. login e cadastro por e-mail/senha;
4. encerramento de sessão;
5. proteção server-side de rotas e funções;
6. autorização administrativa validada no servidor, nunca apenas no navegador.

O Better Auth é uma camada de autenticação do aplicativo; não substitui o Neon. O Neon continua sendo o banco PostgreSQL.

## Regras de segurança obrigatórias

- Não conceder papel de administrador automaticamente a qualquer visitante que se cadastre depois da primeira conta.
- Definir explicitamente como identificar a conta proprietária/admin antes de habilitar cadastros no novo sistema.
- Não confiar em papel, e-mail ou ID enviado pelo navegador sem validação server-side.
- Não expor segredo OAuth, segredo de sessão ou `DATABASE_URL` no código cliente, commits, logs ou respostas HTTP.
- Usar cookies de sessão seguros, com proteção CSRF/origin conforme a biblioteca e o ambiente.
- Não apagar nem alterar usuários no Supabase durante o protótipo.
- Não desativar o login atual até concluir testes de equivalência e plano de retorno.

## Migração de contas

Não copiar hashes de senha ou sessões do Supabase por suposição. Antes da migração, inventariar os usuários e decidir um fluxo seguro:
- usuários Google: entrar novamente com a mesma conta Google e vincular identidade somente após verificação;
- usuários de e-mail/senha: planejar redefinição de senha ou outro fluxo oficial de revalidação;
- conta administradora: identificar e validar explicitamente antes de conceder o papel admin no novo sistema.

Nenhum dado de usuário foi migrado.

## Etapas de implementação propostas

1. Criar um protótipo isolado de autenticação na branch de testes, sem substituir as rotas atuais.
2. Criar tabelas de usuário, conta OAuth, sessão e verificação conforme o schema oficial do Better Auth/Drizzle.
3. Configurar Google OAuth com URLs de callback próprias do ambiente de teste.
4. Testar login/logout no navegador e no APK de teste.
5. Implementar autorização administrativa no servidor e testar acesso negado por padrão.
6. Só depois planejar migração de usuários e integração gradual das rotas do painel.

## Estado atual

- O app continua usando Supabase/Lovable para autenticação e operações.
- Neon contém as cinco tabelas operacionais simplificadas e ainda não contém as tabelas de autenticação independente.
- Nenhum usuário foi migrado.
- Nenhum segredo OAuth novo foi solicitado ou armazenado.
- Não executar migrations novas no Neon e não publicar/mesclar PRs nesta etapa.
