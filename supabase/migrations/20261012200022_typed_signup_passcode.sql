-- Only confirmed administrators with MFA may choose a replacement signup code.
-- The code is returned by the saving transaction; audit entries never contain it.
create function private.replace_signup_passcode(p_passcode text) returns jsonb
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
  delete from private.signup_tickets;
  insert into private.leadership_audit(actor_user_id,action) values(auth.uid(),'signup_code_rotated');
  return jsonb_build_object('passcode',v_code.passcode,'enabled',v_code.enabled,'updated_at',v_code.updated_at);
end $$;
revoke all on function private.replace_signup_passcode(text) from public,anon;
grant execute on function private.replace_signup_passcode(text) to authenticated;

create function public.replace_homeowner_signup_passcode(p_passcode text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.replace_signup_passcode(p_passcode); $$;
revoke all on function public.replace_homeowner_signup_passcode(text) from public,anon;
grant execute on function public.replace_homeowner_signup_passcode(text) to authenticated;

-- Retain the old random-rotation API for already-open browser sessions.
create or replace function private.rotate_signup_passcode() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.replace_signup_passcode(upper(substr(replace(gen_random_uuid()::text,'-',''),1,24)));
end $$;
