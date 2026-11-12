# Notificações push — Cleidson Diesel (Android)

## Arquitetura ativa

O APK Android usa Capacitor Push Notifications + Firebase Cloud Messaging (FCM). O registro do aparelho e o envio passam pelo Cloudflare Worker `cleidson-diesel-push`:

**Aplicativo → Worker `/register` e `/unregister` → KV `PUSH_TOKENS`**

**Triggers PostgreSQL → Worker `/notify` → FCM → aparelhos da equipe**

O Worker implantado valida a sessão e a role `admin` ou `secretaria` no registro do aparelho. O envio é feito aos aparelhos que esses perfis registraram. A role `user` não pode registrar aparelhos.

O código do Worker implantado é administrado no Cloudflare e não está versionado neste repositório. A versão atualmente consultada já possui rotas `/register`, `/unregister` e `/notify`, além de suporte a `notification_events`.

## Configuração necessária

### Cloudflare Worker

O Worker precisa ter:
- Secret `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço Firebase, armazenado somente como secret do Worker.
- Secret `PUSH_WEBHOOK_SECRET`: segredo forte compartilhado com o Vault do Supabase.
- Binding KV `PUSH_TOKENS`.
- Variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para validar a sessão e as roles.

Nunca coloque a chave privada Firebase, tokens FCM ou o segredo do webhook no GitHub, APK ou mensagens.

### Supabase

- Salvar o mesmo segredo do Worker no Vault com o nome `push_webhook_secret`.
- A função `push.notify_worker_on_change()` precisa de `pg_net`, Vault e acesso ao endpoint do Worker.
- Aplicar as migrations de push na ordem prevista somente após revisão e autorização.

### GitHub Actions / Android

- `GOOGLE_SERVICES_JSON`: arquivo de configuração Firebase do pacote Android `br.com.cleidsondiesel.painel`.
- Os secrets de assinatura Android também são necessários para gerar uma release oficial; consulte `ANDROID-RELEASE.md`.

O aplicativo chama diretamente o Cloudflare Worker para registrar/remover aparelhos. O workflow `Deploy Cleidson Diesel push functions` e as Edge Functions `register-device`, `unregister-device` e `notify-admin` são um caminho legado separado; não são necessários para o fluxo ativo do APK.

## Eventos enviados à equipe

A migration `20261110170000_cloudflare_push_triggers.sql` configura:
- Novo agendamento (`appointments` INSERT).
- Nova OS (`service_orders` INSERT).
- Mudanças relevantes de status da OS, incluindo diagnóstico concluído e veículo pronto.
- Garantia emitida (`warranties` INSERT).

A migration `20261112110000_guard_push_trigger_old_status.sql` restringe o acesso a `OLD.status` ao ramo de atualização de `service_orders`, evitando falhas em tabelas sem essa coluna.

Eventos adicionais usam `push.notification_events`:
- Lembrete de agendamento uma hora antes, pelo `pg_cron` no fuso `America/Bahia`.
- Orçamento aprovado ou recusado.
- OS encaminhada para `em_servico`.

A tabela usa `event_key` como chave primária e `push.dispatch_event()` usa `ON CONFLICT DO NOTHING`. Isso impede a criação repetida do mesmo evento lógico. Reagendar cria uma chave de lembrete diferente para a nova data/hora.

O Worker limita título e corpo e aceita somente destinos internos que começam com `/painel`. As notificações push são internas à equipe; não são mensagens enviadas ao cliente.

## Evitar duplicidade

**Não configure Database Webhooks para encaminhar os mesmos eventos à Edge Function `notify-admin`.** Esse caminho legado é separado do Worker e pode duplicar avisos se for ativado junto. A configuração de Database Webhooks do Supabase não está versionada no Git; antes do teste, confirme no painel que não existe webhook antigo apontando para `notify-admin`.

Não confundir:
- Central de notificações do painel: alertas calculados a partir das OS, garantias e agendamentos atuais; não são push e não têm marcação de leitura.
- Push: aviso operacional enviado aos aparelhos registrados da equipe.
- WhatsApp: mensagens ao cliente preparadas para envio manual; não há disparo automático de mensagens ao cliente.

Para acompanhamento online, a oficina gera um link individual de 30 dias na tela da OS e compartilha manualmente. A consulta pública não usa placa como credencial.

## Teste de ponta a ponta

1. Gerar/instalar o APK Android oficial com o arquivo Firebase e secrets de assinatura configurados.
2. Entrar com uma conta admin ou secretaria e permitir notificações no Android.
3. Confirmar que o aparelho foi registrado pelo Worker.
4. Criar um agendamento e uma OS de teste; conferir os avisos internos.
5. Concluir um diagnóstico, mudar uma OS de teste para `pronto` e emitir uma garantia de teste.
6. Testar lembrete, aprovação/recusa de orçamento e transição para `em_servico`.
7. Confirmar que o mesmo evento lógico não gera push repetido e que uma conta com role `user` não registra aparelho.
8. Confirmar que nenhum aviso interno contém diagnóstico detalhado, CPF ou dados financeiros do cliente.

A integração só deve ser considerada concluída depois do teste real em Android e da conferência das configurações do Worker, Vault, triggers e ausência de webhooks legados duplicados.
