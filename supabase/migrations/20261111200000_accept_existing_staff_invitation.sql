create or replace function public.accept_staff_invitation_for_existing_user(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.staff_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select *
    into v_invitation
    from public.staff_invitations
   where token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
     and lower(email) = lower(v_email)
     and used_at is null
     and revoked_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'STAFF_INVITATION_INVALID_OR_EXPIRED';
  end if;

  update public.staff_invitations
     set used_at = now(), accepted_user_id = v_user_id
   where id = v_invitation.id;

  insert into public.user_roles (user_id, role)
  values (v_user_id, v_invitation.role)
  on conflict (user_id, role) do nothing;
end;
$$;

revoke all on function public.accept_staff_invitation_for_existing_user(text) from public, anon;
grant execute on function public.accept_staff_invitation_for_existing_user(text) to authenticated;
