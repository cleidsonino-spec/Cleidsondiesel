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

## Caminho ativo de notificações

O fluxo principal é **trigger PostgreSQL → Cloudflare Worker `/notify` → Firebase Cloud Messaging → aparelhos Android da administração**.

A migration `20261110170000_cloudflare_push_triggers.sql` registra os eventos:
- `appointments`: novo agendamento;
- `service_orders`: nova OS e transições de status relevantes;
- `warranties`: garantia emitida;
- `push.notification_events`: eventos adicionais com chave idempotente.

A função `push.notify_worker_on_change()` envia o payload padrão ao Worker com o segredo do Vault. A proteção para `OLD.status` fica restrita a atualizações de `service_orders`, evitando falhas em tabelas sem essa coluna.

**Não crie Database Webhooks para encaminhar os mesmos eventos à função Supabase `notify-admin`.** Essa função é um caminho legado separado; mantê-la ativa junto do Worker pode gerar notificações duplicadas. Se algum webhook antigo para `notify-admin` já existir, confira e remova-o antes do teste integrado. A configuração de webhooks do projeto Supabase não é versionada neste repositório e precisa ser conferida no painel.

O Worker atualmente implantado já reconhece `notification_events`, limita título/corpo e restringe o destino a rotas internas `/painel`. A tabela `push.notification_events` usa `event_key` como chave primária; `push.dispatch_event()` usa `ON CONFLICT DO NOTHING` para impedir a repetição do mesmo evento lógico.

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

## Notificações adicionais (lembrete, orçamento, status)

Reutilizam o gatilho `push.notify_worker_on_change()` → Worker `/notify` (segredo Vault `push_webhook_secret`).

- `push.notification_events` (PK `event_key`): cada evento entra uma única vez (`on conflict do nothing`); o gatilho `push_notify_events` chama o Worker só em inserções novas.
- Payload: `{ "table": "notification_events", "type": "INSERT", "record": { "event_key", "title", "body", "route" } }`.

| Evento | Origem | Chave |
| --- | --- | --- |
| Lembrete 1h antes | pg_cron `push-appointment-reminders` (cada minuto) → `push.send_appointment_reminders()`, fuso `America/Bahia`, só `pendente`/`confirmado`; não envia se criado com menos de 1h | `appointment:<id>:reminder:<data>T<hora>` (remarcar gera nova chave; cancelado não dispara) |
| Orçamento aprovado/recusado | gatilho `push_quote_state` (`quote_approvals.state` → `approved`/`rejected`) | `quote:<id>:<estado>` |
| OS em serviço | gatilho `push_order_in_service`, só transição para `em_servico` | `order:<id>:em_servico:<updated_at>` |
| OS pronta | fluxo existente `push_notify_service_orders` (inalterado) | — |

Recusa: pelo mesmo link de aprovação (nome + CPF válido), RPC `reject_quote_identified`; estado `rejected`, OS não muda.

### Ação manual pendente (obrigatória)

O Worker implantado já contém o tratamento de `notification_events`; não é necessário acrescentar esse bloco novamente. Ainda é obrigatório testar o fluxo de ponta a ponta em aparelho Android real após confirmar que não há Database Webhooks legados duplicando os eventos.
