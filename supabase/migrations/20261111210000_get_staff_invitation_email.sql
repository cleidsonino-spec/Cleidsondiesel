create or replace function public.get_staff_invitation_email(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text;
begin
  select email into v_email
    from public.staff_invitations
   where token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
     and used_at is null and revoked_at is null and expires_at > now()
   limit 1;
  if v_email is null then
    raise exception 'STAFF_INVITATION_INVALID_OR_EXPIRED';
  end if;
  return lower(v_email);
end;
$$;
revoke all on function public.get_staff_invitation_email(text) from public;
grant execute on function public.get_staff_invitation_email(text) to anon, authenticated;
