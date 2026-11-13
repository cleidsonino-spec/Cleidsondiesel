-- Notify administrator devices when a mechanic submits an inspection report for review.
-- The report has its own lifecycle and does not change service_orders.status.

create or replace function push.notify_admin_on_inspection_report()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, push, vault, net
as $$
declare
  webhook_secret text;
  report_record jsonb;
  order_data jsonb;
begin
  if NEW.status is distinct from 'pending_review' then
    return null;
  end if;

  if TG_OP = 'UPDATE' and OLD.status is not distinct from 'pending_review' then
    return null;
  end if;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  limit 1;

  if webhook_secret is null or webhook_secret = '' then
    raise warning 'Push webhook secret is not configured';
    return null;
  end if;

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

  report_record := to_jsonb(NEW) ||
    jsonb_build_object('service_order', coalesce(order_data, '{}'::jsonb));

  perform net.http_post(
    url := 'https://cleidson-diesel-push.cleidsonino.workers.dev/notify',
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'type', TG_OP,
      'record', report_record,
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end
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

drop trigger if exists push_notify_inspection_report_review on public.service_order_inspection_reports;
create trigger push_notify_inspection_report_review
after insert or update of status on public.service_order_inspection_reports
for each row execute function push.notify_admin_on_inspection_report();
