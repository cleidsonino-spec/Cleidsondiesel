alter table push.notification_events add column if not exists icon text, add column if not exists color text;
create or replace function push.dispatch_event(_key text, _title text, _body text, _route text, _icon text, _color text)
returns void language sql security definer set search_path = pg_catalog, push as $$
  insert into push.notification_events(event_key,title,body,route,icon,color) values(_key,_title,_body,_route,_icon,_color) on conflict do nothing;
$$;
revoke all on function push.dispatch_event(text,text,text,text,text,text) from public, anon, authenticated;
create or replace function push.on_quote_state()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, push as $$
declare s jsonb := NEW.snapshot; info text;
begin
  if NEW.state is not distinct from OLD.state or NEW.state not in ('approved','rejected') then return null; end if;
  info := 'OS #' || coalesce(s->>'number','') || ' · ' || coalesce(s->>'vehicle','Veículo') || ' ' || coalesce(s->>'plate','') || ' · ' || coalesce(s->>'customer_name','Cliente');
  perform push.dispatch_event('quote:' || NEW.id || ':' || NEW.state,
    case when NEW.state='approved' then 'Orçamento aprovado pelo cliente' else 'Orçamento recusado pelo cliente' end,
    info, '/painel/ordens/' || NEW.order_id,
    case when NEW.state='approved' then 'ic_stat_quote_approved' else 'ic_stat_quote_rejected' end,
    case when NEW.state='approved' then '#16A34A' else '#DC2626' end);
  return null;
end $$;