-- Registro estruturado de recebimento do veículo na abertura da OS.
alter table public.service_orders
  add column if not exists vehicle_receipt jsonb not null default '{}'::jsonb;

alter table public.service_orders
  drop constraint if exists service_orders_vehicle_receipt_object;

alter table public.service_orders
  add constraint service_orders_vehicle_receipt_object
  check (jsonb_typeof(vehicle_receipt) = 'object');

comment on column public.service_orders.vehicle_receipt is
  'Dados do recebimento do veículo: received_at, received_by, odometer, fuel_level, damages e observations. Fotografias são opcionais e não fazem parte deste registro inicial.';
