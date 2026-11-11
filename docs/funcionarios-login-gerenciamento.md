# Login e gerenciamento seguro de funcionários

## Escopo

O acesso de secretária e mecânico usa um identificador de usuário e senha. O cliente converte o usuário em um endereço interno <usuario>@staff.cleidsondiesel.invalid e o Supabase Auth valida a senha. Esse endereço não é usado para receber e-mails.

O administrador continua entrando com o e-mail cadastrado e seus métodos de autenticação existentes.

## Gerenciamento

A página administrativa /painel/equipe permite:

- Criar contas para os perfis secretaria e mecanico.
- Bloquear temporariamente uma conta para férias ou afastamento.
- Reativar uma conta bloqueada.
- Remover um funcionário da equipe.

As operações passam pela Edge Function manage-staff. A função exige JWT válido e verifica no banco que o solicitante possui a role admin. A chave SUPABASE_SERVICE_ROLE_KEY é usada exclusivamente no ambiente da função, nunca no navegador.

## Bloqueio

O bloqueio remove a role do funcionário em public.user_roles e aplica banimento no Supabase Auth. Remover a role também corta as permissões RLS de sessões que ainda tenham um JWT válido. A reativação remove o banimento e restaura a role original.

## Remoção e preservação de histórico

A ação Excluir é uma remoção lógica segura, não uma exclusão física de auth.users. Ela bloqueia a conta, remove a role, troca o e-mail interno e libera o nome de usuário. Isso é necessário porque ordens atribuídas e registros técnicos possuem chaves estrangeiras restritivas para o usuário mecânico. A identidade técnica histórica permanece íntegra, mas a conta não consegue mais autenticar nem acessar o painel.

## Implantação

A função ainda precisa ser implantada no projeto Supabase antes de o gerenciamento ficar disponível:

```bash
supabase login
supabase functions deploy manage-staff --project-ref vmmfifpikycnmvzibrfn
```

O deploy requer um Supabase Access Token no ambiente local/CI. A função usa as variáveis padrão de Edge Functions SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

## Testes manuais após implantação

1. Entrar como administrador e abrir /painel/equipe.
2. Criar um mecânico e uma secretária com senhas fortes (mínimo 12 caracteres).
3. Entrar em uma sessão separada usando nome de usuário e senha.
4. Bloquear uma conta e verificar que o novo login falha e que a sessão anterior perde as permissões RLS.
5. Reativar a conta e verificar que o login volta a funcionar.
6. Remover uma conta e confirmar que o usuário anterior não autentica, o nome fica disponível para novo cadastro e os registros técnicos antigos continuam presentes.

Nenhuma conta de funcionário é criada automaticamente. Não publicar o app nem executar o deploy sem autorização.