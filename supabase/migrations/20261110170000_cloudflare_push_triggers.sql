-- Cloudflare FCM push notifications.
-- Requires pg_net in schema net and Vault secret "push_webhook_secret".
create schema if not exists push;

create or replace function push.notify_worker_on_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, push, vault, net
as $$
declare
  webhook_secret text;
  new_record jsonb;
  old_record jsonb;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  limit 1;

  if webhook_secret is null or webhook_secret = '' then
    raise warning 'Push webhook secret is not configured';
    return null;
  end if;

  if TG_OP = 'INSERT' then
    new_record := to_jsonb(NEW);
    old_record := '{}'::jsonb;
  else
    new_record := to_jsonb(NEW);
    old_record := to_jsonb(OLD);
  end if;

  perform net.http_post(
    url := 'https://cleidson-diesel-push.cleidsonino.workers.dev/notify',
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'type', TG_OP,
      'record', new_record,
      'old_record', old_record
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return null;
end;
$$;

drop trigger if exists push_notify_appointments on public.appointments;
create trigger push_notify_appointments
after insert on public.appointments
for each row execute function push.notify_worker_on_change();

drop trigger if exists push_notify_service_orders on public.service_orders;
create trigger push_notify_service_orders
after insert or update of status on public.service_orders
for each row execute function push.notify_worker_on_change();

drop trigger if exists push_notify_warranties on public.warranties;
create trigger push_notify_warranties
after insert on public.warranties
for each row execute function push.notify_worker_on_change();
