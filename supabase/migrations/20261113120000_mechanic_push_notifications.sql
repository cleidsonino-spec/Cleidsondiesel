-- Targeted Android push notifications for mechanics.
-- This migration is proposed only; it must be applied separately to production.

create or replace function push.notify_worker_on_change()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, push, vault, net
as $$
declare
  webhook_secret text;
  new_record jsonb;
  old_record jsonb;
  order_data jsonb;
  mechanic_user_ids jsonb;
begin
  -- Only notify when an assignment becomes active or is reassigned.
  if TG_TABLE_NAME = 'service_order_assignments' then
    if NEW.active is distinct from true then
      return null;
    end if;
    if TG_OP = 'UPDATE'
      and OLD.active is true
      and OLD.mechanic_user_id = NEW.mechanic_user_id then
      return null;
    end if;
  end if;

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

  if TG_TABLE_NAME = 'service_order_assignments' then
    select jsonb_build_object(
      'id', so.id,
      'number', so.number,
      'customer_name', so.customer_name,
      'vehicle', so.vehicle,
      'plate', so.plate
    )
    into order_data
    from public.service_orders so
    where so.id = NEW.service_order_id;

    new_record := new_record || jsonb_build_object('service_order', coalesce(order_data, '{}'::jsonb));
  elsif TG_TABLE_NAME = 'service_orders'
    and TG_OP = 'UPDATE'
    and OLD.status is distinct from NEW.status
    and NEW.status = 'em_servico' then
    select coalesce(jsonb_agg(soa.mechanic_user_id), '[]'::jsonb)
    into mechanic_user_ids
    from public.service_order_assignments soa
    where soa.service_order_id = NEW.id
      and soa.active is true;

    new_record := new_record || jsonb_build_object('mechanic_user_ids', mechanic_user_ids);
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

drop trigger if exists push_notify_service_order_assignments on public.service_order_assignments;
create trigger push_notify_service_order_assignments
after insert or update of mechanic_user_id, active on public.service_order_assignments
for each row execute function push.notify_worker_on_change();
