-- Cadastro de clientes e garantia automática de 3 meses corridos,
-- com vencimento no último dia do mês de término.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_document_unique
  on public.customers (regexp_replace(document, '\\D', '', 'g'))
  where document is not null and regexp_replace(document, '\\D', '', 'g') <> '';

alter table public.customers enable row level security;

create policy "Admins manage customers"
  on public.customers for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

alter table public.service_orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists warranty_start_date date,
  add column if not exists warranty_end_date date;

create index if not exists service_orders_customer_id_idx
  on public.service_orders(customer_id);

create or replace function public.set_service_order_warranty()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  start_on date;
begin
  if new.status = 'entregue'
     and (tg_op = 'INSERT' or old.status is distinct from 'entregue') then
    start_on := current_date;
    new.warranty_start_date := start_on;
    new.warranty_end_date := (
      date_trunc('month', start_on + interval '3 months')
      + interval '1 month - 1 day'
    )::date;
  elsif new.status <> 'entregue' then
    new.warranty_start_date := null;
    new.warranty_end_date := null;
  end if;
  return new;
end;
$$;

drop trigger if exists service_order_warranty_trigger on public.service_orders;
create trigger service_order_warranty_trigger
before insert or update of status on public.service_orders
for each row execute function public.set_service_order_warranty();
