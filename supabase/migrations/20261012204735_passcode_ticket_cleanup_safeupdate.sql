-- PostgREST sessions load safeupdate, which rejects DELETE without a WHERE.
-- Keep that safeguard enabled and remove only tickets for obsolete versions.
create or replace function private.replace_signup_passcode(p_passcode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_value text := upper(btrim(p_passcode));
  v_code private.signup_passcode;
begin
  if auth.uid() is null or not coalesce((private.portal_flags()->>'can_manage_leadership')::boolean,false) then
    raise exception 'Administrator login with MFA required. Verify your authenticator before replacing the code.' using errcode='42501';
  end if;
  if v_value is null or v_value !~ '^[A-Z0-9-]{8,64}$' then
    raise exception 'Use 8–64 letters, numbers or hyphens, without spaces.' using errcode='22023';
  end if;
  select * into v_code from private.signup_passcode where singleton for update;
  if not found then raise exception 'Signup passcode is unavailable. Contact the administrator.'; end if;
  if v_code.passcode=v_value then
    raise exception 'Choose a different passcode. This code is already in use.' using errcode='22023';
  end if;
  update private.signup_passcode set passcode=v_value,version=gen_random_uuid(),updated_at=now()
    where singleton returning * into v_code;
  delete from private.signup_tickets where passcode_version <> v_code.version;
  insert into private.leadership_audit(actor_user_id,action) values(auth.uid(),'signup_code_rotated');
  return jsonb_build_object('passcode',v_code.passcode,'enabled',v_code.enabled,'updated_at',v_code.updated_at);
end $$;
