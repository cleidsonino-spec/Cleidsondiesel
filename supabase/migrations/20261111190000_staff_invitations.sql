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
grant select, insert, update on public.staff_invitations to authenticated;
grant all on public.staff_invitations to service_role;

drop policy if exists "Admins manage staff invitations" on public.staff_invitations;
create policy "Admins manage staff invitations"
on public.staff_invitations
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.accept_staff_invitation_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_token text;
  v_invitation public.staff_invitations%rowtype;
begin
  v_token := coalesce(new.raw_user_meta_data ->> 'staff_invitation_token', '');
  if v_token = '' then
    return new;
  end if;

  select *
    into v_invitation
    from public.staff_invitations
   where token_hash = encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
     and lower(email) = lower(new.email)
     and used_at is null
     and revoked_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'STAFF_INVITATION_INVALID_OR_EXPIRED';
  end if;

  update public.staff_invitations
     set used_at = now()
   where id = v_invitation.id;

  insert into public.user_roles (user_id, role)
  values (new.id, v_invitation.role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke all on function public.accept_staff_invitation_on_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_staff_invitation on auth.users;
create trigger on_auth_user_created_staff_invitation
after insert on auth.users
for each row
execute function public.accept_staff_invitation_on_signup();
