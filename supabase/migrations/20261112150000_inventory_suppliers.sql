-- Estoque e fornecedores: registros operacionais auditáveis, sem baixa automática nas OS.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  phone text,
  email text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null check (char_length(trim(name)) between 2 and 180),
  brand text,
  category text,
  unit text not null default 'un',
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  stock_quantity numeric(12,3) not null default 0 check (stock_quantity >= 0),
  minimum_stock numeric(12,3) not null default 0 check (minimum_stock >= 0),
  location text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('entrada','saida')),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  service_order_id uuid references public.service_orders(id) on delete restrict,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_name_idx on public.inventory_items (name);
create index if not exists inventory_items_supplier_idx on public.inventory_items (supplier_id);
create index if not exists inventory_movements_item_date_idx on public.inventory_movements (item_id, created_at desc);
create index if not exists inventory_movements_order_idx on public.inventory_movements (service_order_id);

alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on public.suppliers from anon, authenticated;
revoke all on public.inventory_items from anon, authenticated;
revoke all on public.inventory_movements from anon, authenticated;

drop policy if exists "Admins manage suppliers" on public.suppliers;
create policy "Admins manage suppliers" on public.suppliers
  for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins manage inventory items" on public.inventory_items;
create policy "Admins manage inventory items" on public.inventory_items
  for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins read inventory movements" on public.inventory_movements;
create policy "Admins read inventory movements" on public.inventory_movements
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins create inventory movements" on public.inventory_movements;
create policy "Admins create inventory movements" on public.inventory_movements
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.guard_inventory_stock_quantity()
returns trigger
language plpgsql
set search_path = public
as $
begin
  if new.stock_quantity is distinct from old.stock_quantity
     and coalesce(current_setting('app.inventory_movement', true), 'off') <> 'on' then
    raise exception 'O saldo só pode ser alterado por uma movimentação registrada.';
  end if;
  return new;
end;
$;

drop trigger if exists inventory_stock_quantity_guard on public.inventory_items;
create trigger inventory_stock_quantity_guard
before update of stock_quantity on public.inventory_items
for each row execute function public.guard_inventory_stock_quantity();

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_quantity numeric(12,3);
begin
  select stock_quantity into current_quantity
  from public.inventory_items
  where id = new.item_id
  for update;

  if not found then
    raise exception 'Produto não encontrado no estoque.';
  end if;

  if new.movement_type = 'saida' and current_quantity < new.quantity then
    raise exception 'Estoque insuficiente. Disponível: %', current_quantity;
  end if;

  perform set_config('app.inventory_movement', 'on', true);

  update public.inventory_items
  set stock_quantity = case
      when new.movement_type = 'entrada' then stock_quantity + new.quantity
      else stock_quantity - new.quantity
    end,
    updated_at = now()
  where id = new.item_id;

  perform set_config('app.inventory_movement', 'off', true);
  return new;
end;
$$;

drop trigger if exists inventory_movement_apply on public.inventory_movements;
create trigger inventory_movement_apply
before insert on public.inventory_movements
for each row execute function public.apply_inventory_movement();

revoke all on function public.apply_inventory_movement() from public, anon, authenticated;
revoke all on function public.guard_inventory_stock_quantity() from public, anon, authenticated;
grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update on public.inventory_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;
