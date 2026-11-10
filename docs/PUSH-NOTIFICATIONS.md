# Notificações push — Cleidson Diesel (Android)

A implementação usa Capacitor Push Notifications + Firebase Cloud Messaging (FCM) no APK Android e Supabase Edge Functions no servidor. O token do aparelho é guardado em `app_metadata` do usuário autenticado; a função só permite registro para quem tem a role `admin`. O envio consulta `public.user_roles` e entrega somente aos usuários administradores. A secretária/role `user` não recebe tokens nem notificações.

## Secrets necessários

### Supabase → Edge Functions → Secrets

- `FIREBASE_SERVICE_ACCOUNT_JSON`: conteúdo integral da chave JSON de uma conta de serviço do Firebase Admin SDK. Nunca colocar no GitHub, no APK ou em mensagens.
- `PUSH_WEBHOOK_SECRET`: valor aleatório forte compartilhado somente com os Database Webhooks que chamam `notify-admin`.

O projeto já fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente das Edge Functions. Não cadastrar nem expor esses valores manualmente no código.

### GitHub → Settings → Secrets and variables → Actions

- `GOOGLE_SERVICES_JSON`: conteúdo integral do arquivo `google-services.json` baixado para o app Android `br.com.cleidsondiesel.painel`. Esse arquivo contém identificadores de configuração do app, não a chave privada da conta de serviço.
- `SUPABASE_ACCESS_TOKEN`: token pessoal de acesso do Supabase, usado somente pelo workflow manual de deploy.
- `SUPABASE_PROJECT_ID`: referência do projeto Supabase oficial (`vmmfifpikycnmvzibrfn`).

Não envie os valores desses secrets pelo chat nem os grave em arquivos versionados.

## Publicar as Edge Functions sem usar créditos da Lovable

1. Cadastre os secrets do Supabase e do GitHub listados acima.
2. No GitHub, abra **Actions → Deploy Cleidson Diesel push functions → Run workflow**. Selecione a branch de integração `feat/notificacoes-push-admin`.
3. Confira a execução: as três funções `register-device`, `unregister-device` e `notify-admin` devem ser implantadas no projeto indicado por `SUPABASE_PROJECT_ID`.
4. `notify-admin` precisa permanecer com verificação JWT desativada porque recebe chamadas de Database Webhooks autenticadas pelo cabeçalho secreto. As funções de registro e remoção mantêm a verificação JWT ativada e ainda verificam a role `admin`.

## Database Webhooks no Supabase

Em **Database → Webhooks**, crie webhooks POST para:

| Tabela | Eventos |
| --- | --- |
| `appointments` | INSERT |
| `service_orders` | INSERT e UPDATE |
| `warranties` | INSERT |

URL de destino:

`https://vmmfifpikycnmvzibrfn.supabase.co/functions/v1/notify-admin`

Cabeçalhos:

- `Content-Type: application/json`
- `x-webhook-secret: <mesmo valor de PUSH_WEBHOOK_SECRET>`

Use o payload padrão do Database Webhook do Supabase (`type`, `table`, `record`, `old_record`). A função filtra os eventos relevantes e ignora os demais. Para UPDATE de `service_orders`, ela só avisa quando o status muda para `pronto`.

## Gerar o APK oficial com FCM

1. Cadastre `GOOGLE_SERVICES_JSON` nos secrets do GitHub Actions.
2. Execute **Actions → Build Cleidson Diesel official Android release → Run workflow**.
3. O workflow valida que o JSON contém o pacote `br.com.cleidsondiesel.painel`, instala o plugin Capacitor Push Notifications, sincroniza o projeto Android e gera os artefatos assinados.

A geração de release também exige os secrets de assinatura Android descritos em [ANDROID-RELEASE.md](./ANDROID-RELEASE.md).

## Teste de ponta a ponta

1. Instale o APK oficial recém-gerado no Android e entre com a conta administradora.
2. Autorize notificações quando o Android solicitar. Ao registrar, o token será salvo no `app_metadata` da conta administradora.
3. Crie um agendamento de teste e uma OS de teste; confirme as notificações no aparelho.
4. Altere uma OS de teste para `pronto` e confirme o alerta de serviço pronto.
5. Emita uma garantia de teste e confirme o alerta.
6. Confirme que uma conta com role `user` não recebe notificações.

A integração não deve ser considerada concluída até que os webhooks estejam criados, as funções implantadas e os testes feitos em aparelho Android real.
