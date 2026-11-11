-- lovable-cron-fallback-reviewed: 1h appointment reminder must fire on time server-side; per-minute SQL-only check, idempotent by event key
create extension if not exists pg_cron;

create table if not exists push.notification_events (
  event_key text primary key,
  title text not null,
  body text not null,
  route text not null,
  created_at timestamptz not null default now()
);
revoke all on push.notification_events from public, anon, authenticated;

-- Reuses the existing worker sender: payload {table:'notification_events', type:'INSERT', record:{event_key,title,body,route}}
drop trigger if exists push_notify_events on push.notification_events;
create trigger push_notify_events after insert on push.notification_events
for each row execute function push.notify_worker_on_change();

create or replace function push.dispatch_event(_key text, _title text, _body text, _route text)
returns void language sql security definer set search_path = pg_catalog, push as $$
  insert into push.notification_events(event_key,title,body,route) values(_key,_title,_body,_route) on conflict do nothing;
$$;
revoke all on function push.dispatch_event(text,text,text,text) from public, anon, authenticated;

alter table public.quote_approvals drop constraint if exists quote_approvals_state_check;
alter table public.quote_approvals add constraint quote_approvals_state_check check (state = any (array['pending','approved','rejected','revoked']));
alter table public.quote_approvals add column if not exists rejected_at timestamptz, add column if not exists rejected_by text;

create or replace function public.reject_quote_identified(_token text, _name text, _cpf text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
DECLARE q public.quote_approvals; o public.service_orders; oid uuid; n text;
BEGIN
 n:=regexp_replace(trim(_name),'\s+',' ','g');
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' OR n IS NULL OR length(n)>120 OR n !~ '^[[:alpha:]][[:alpha:]''-]+([ ][[:alpha:]][[:alpha:]''-]+)+$' OR NOT public.valid_cpf(_cpf) THEN RAISE EXCEPTION 'Invalid name or CPF'; END IF;
 SELECT order_id INTO oid FROM public.quote_approvals WHERE token=_token;
 IF oid IS NULL THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=oid FOR UPDATE;
 SELECT * INTO q FROM public.quote_approvals WHERE token=_token FOR UPDATE;
 IF q.state NOT IN ('pending','rejected') OR q.expires_at<=now() OR o.status IN ('cancelado','entregue','pronto') OR q.snapshot IS DISTINCT FROM public.quote_snapshot(o) THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF q.state='pending' THEN
  UPDATE public.quote_approvals SET state='rejected',rejected_at=now(),rejected_by=n WHERE id=q.id RETURNING * INTO q;
 END IF;
 RETURN jsonb_build_object('rejected_at',q.rejected_at,'rejected_by',q.rejected_by);
END $$;
grant execute on function public.reject_quote_identified(text,text,text) to anon, authenticated;

create or replace function public.get_quote_approval(_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
DECLARE q public.quote_approvals;
BEGIN
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO q FROM public.quote_approvals WHERE token=_token AND state<>'revoked' AND expires_at>now();
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('quote',q.snapshot,'state',q.state,'expires_at',q.expires_at,'approved_at',q.approved_at,'approved_by',q.approved_by,'rejected_at',q.rejected_at);
END $$;

create or replace function push.on_quote_state()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, push as $$
declare s jsonb := NEW.snapshot; info text;
begin
  if NEW.state is not distinct from OLD.state or NEW.state not in ('approved','rejected') then return null; end if;
  info := 'OS #' || coalesce(s->>'number','') || ' · ' || coalesce(s->>'vehicle','Veículo') || ' ' || coalesce(s->>'plate','') || ' · ' || coalesce(s->>'customer_name','Cliente');
  perform push.dispatch_event('quote:' || NEW.id || ':' || NEW.state,
    case when NEW.state='approved' then 'Orçamento aprovado' else 'Orçamento recusado' end,
    info, '/painel/ordens/' || NEW.order_id);
  return null;
end $$;
drop trigger if exists push_quote_state on public.quote_approvals;
create trigger push_quote_state after update of state on public.quote_approvals
for each row execute function push.on_quote_state();

create or replace function push.on_order_in_service()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, push as $$
begin
  if NEW.status = 'em_servico' and OLD.status is distinct from 'em_servico' then
    perform push.dispatch_event('order:' || NEW.id || ':em_servico:' || extract(epoch from NEW.updated_at)::bigint,
      'Veículo em serviço',
      'OS #' || NEW.number || ' · ' || NEW.vehicle || ' ' || NEW.plate || ' · ' || NEW.customer_name,
      '/painel/ordens/' || NEW.id);
  end if;
  return null;
end $$;
drop trigger if exists push_order_in_service on public.service_orders;
create trigger push_order_in_service after update of status on public.service_orders
for each row execute function push.on_order_in_service();

create or replace function push.send_appointment_reminders()
returns void language plpgsql security definer set search_path = pg_catalog, public, push as $$
declare a record; remind_at timestamptz;
begin
  for a in select * from public.appointments
    where status in ('pendente','confirmado')
      and scheduled_date between (now() at time zone 'America/Bahia')::date - 1 and (now() at time zone 'America/Bahia')::date + 1
  loop
    remind_at := ((a.scheduled_date + a.scheduled_time) at time zone 'America/Bahia') - interval '1 hour';
    if remind_at <= now() and remind_at > now() - interval '2 minutes' and a.created_at <= remind_at then
      perform push.dispatch_event('appointment:' || a.id || ':reminder:' || a.scheduled_date || 'T' || a.scheduled_time,
        'Atendimento em 1 hora',
        to_char(a.scheduled_time,'HH24:MI') || ' · ' || a.customer_name || ' · ' || a.vehicle || ' ' || a.plate,
        '/painel/agendamentos');
    end if;
  end loop;
end $$;
revoke all on function push.send_appointment_reminders() from public, anon, authenticated;

select cron.schedule('push-appointment-reminders','* * * * *','select push.send_appointment_reminders()');