create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  role public.app_role not null check (role in ('mecanico', 'secretaria')),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists staff_invitations_status_idx
  on public.staff_invitations (created_at desc);

alter table public.staff_invitations enable row level security;
revoke all on public.staff_invitations from anon, authenticated;
grant all on public.staff_invitations to service_role;
