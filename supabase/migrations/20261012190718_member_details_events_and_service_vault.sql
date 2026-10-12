-- Structured member details preserve the original name/address fields for
-- compatibility. Existing names are never guessed or split automatically.
alter table public.portal_account_details
  add column first_name text not null default '' check(length(first_name)<=80),
  add column last_name text not null default '' check(length(last_name)<=80),
  add column mailing_street text not null default '' check(length(mailing_street)<=180),
  add column mailing_unit text not null default '' check(length(mailing_unit)<=60),
  add column mailing_city text not null default '' check(length(mailing_city)<=100),
  add column mailing_state text not null default '' check(length(mailing_state)<=80),
  add column mailing_postal_code text not null default '' check(length(mailing_postal_code)<=20),
  add column mailing_country text not null default 'US' check(length(mailing_country)<=80);

create table private.email_notice_preferences(
  user_id uuid primary key references auth.users(id) on delete cascade,
  consented boolean not null default false, consented_at timestamptz, updated_at timestamptz not null default now(),
  email_at_consent text, statement_version text not null default '2026-10-12',
  statement text not null default 'I consent to emailed notices in lieu of mailed notices to my property. I agree to keep my email address up to date.'
);
create table private.email_notice_history(
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
  consented boolean not null, email text not null, statement text not null, recorded_at timestamptz not null default now()
);
create index email_notice_history_user_idx on private.email_notice_history(user_id,recorded_at);
alter table private.email_notice_preferences enable row level security;
alter table private.email_notice_history enable row level security;
revoke all on private.email_notice_preferences,private.email_notice_history from public,anon,authenticated;

create function private.member_profile() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  select jsonb_build_object('details',(select to_jsonb(d) from public.portal_account_details d where user_id=auth.uid()),
    'notice_consent',coalesce((select consented from private.email_notice_preferences where user_id=auth.uid()),false),
    'consented_at',(select consented_at from private.email_notice_preferences where user_id=auth.uid()),
    'email',(select email from auth.users where id=auth.uid()),'pending_email',(select nullif(email_change,'') from auth.users where id=auth.uid())) into v_result;
  return v_result;
end $$;
create function private.save_member_profile(p_details jsonb,p_consent boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_first text:=trim(coalesce(p_details->>'first_name','')); v_last text:=trim(coalesce(p_details->>'last_name',''));
  v_email text; v_old boolean; v_changed boolean; v_consent boolean:=coalesce(p_consent,false);
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  if length(v_first) not between 1 and 80 or length(v_last) not between 1 and 80 or length(v_first||' '||v_last)>160 then raise exception 'Enter your first and last names (up to 80 characters each)'; end if;
  -- Serialize preference changes without accepting client-supplied timestamps.
  perform 1 from auth.users where id=auth.uid() for update;
  select email into v_email from auth.users where id=auth.uid();
  select consented into v_old from private.email_notice_preferences where user_id=auth.uid();
  v_changed:=v_old is distinct from v_consent;
  insert into public.portal_account_details(user_id,display_name,first_name,last_name,phone,mailing_street,mailing_unit,mailing_city,mailing_state,mailing_postal_code,mailing_country,mailing_address)
    values(auth.uid(),v_first||' '||v_last,v_first,v_last,trim(coalesce(p_details->>'phone','')),
      trim(coalesce(p_details->>'mailing_street','')),trim(coalesce(p_details->>'mailing_unit','')),trim(coalesce(p_details->>'mailing_city','')),
      trim(coalesce(p_details->>'mailing_state','')),trim(coalesce(p_details->>'mailing_postal_code','')),trim(coalesce(p_details->>'mailing_country','US')),
      left(concat_ws(', ',nullif(trim(p_details->>'mailing_street'),''),nullif(trim(p_details->>'mailing_unit'),''),
        nullif(trim(p_details->>'mailing_city'),''),nullif(trim(p_details->>'mailing_state'),''),nullif(trim(p_details->>'mailing_postal_code'),''),nullif(trim(p_details->>'mailing_country'),'')),500))
    on conflict(user_id) do update set display_name=excluded.display_name,first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone,
      mailing_street=excluded.mailing_street,mailing_unit=excluded.mailing_unit,mailing_city=excluded.mailing_city,mailing_state=excluded.mailing_state,
      mailing_postal_code=excluded.mailing_postal_code,mailing_country=excluded.mailing_country,mailing_address=excluded.mailing_address;
  if v_changed then
    insert into private.email_notice_preferences(user_id,consented,consented_at,email_at_consent)
      values(auth.uid(),v_consent,case when v_consent then now() end,case when v_consent then v_email end)
      on conflict(user_id) do update set consented=excluded.consented,consented_at=excluded.consented_at,email_at_consent=excluded.email_at_consent,updated_at=now();
    insert into private.email_notice_history(user_id,consented,email,statement)
      select auth.uid(),v_consent,v_email,statement from private.email_notice_preferences where user_id=auth.uid();
  end if;
  -- Only contacts explicitly linked by portal approval are updated; no legacy matching.
  update public.contacts c set display_name=v_first||' '||v_last,phone=trim(coalesce(p_details->>'phone',''))
    from public.user_profiles u where u.user_id=auth.uid() and u.contact_id=c.id
      and exists(select 1 from private.property_access_requests r where r.user_id=u.user_id and r.status='approved');
end $$;

create or replace function private.staff_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'Serving Director or Officer with MFA required' using errcode='42501'; end if;
  return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'display_name',d.display_name,'email',a.email,'phone',d.phone,'mailing_address',d.mailing_address,'email_notice_consent',coalesce(n.consented,false),'email_notice_consented_at',n.consented_at,'lot_number',p.lot_number,'street_address',p.street_address,'status',r.status,'relationship',r.requested_relationship,'request_note',r.request_note,'review_note',r.review_note,'submitted_at',r.submitted_at) order by r.submitted_at desc)
    from private.property_access_requests r join public.properties p on p.id=r.property_id join auth.users a on a.id=r.user_id left join public.portal_account_details d on d.user_id=r.user_id left join private.email_notice_preferences n on n.user_id=r.user_id),'[]'::jsonb),
    'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'occupancy_status',p.occupancy_status,
      'verified_contacts',coalesce((select jsonb_agg(jsonb_build_object('display_name',c.display_name,'relationship',pc.relationship)) from public.property_contacts pc join public.contacts c on c.id=pc.contact_id where pc.property_id=p.id and pc.ownership_verified_at is not null and pc.started_on<=current_date and (pc.ended_on is null or pc.ended_on>current_date)),'[]'::jsonb),
      'historical_contacts',coalesce((select jsonb_agg(jsonb_build_object('display_name',c.display_name,'verification','Historical / unverified')) from public.legacy_contact_links_staging s join public.contacts c on c.id=s.contact_id where s.lot_number=p.lot_number),'[]'::jsonb)) order by p.lot_number) from public.properties p),'[]'::jsonb));
end $$;

create table private.property_households(
  request_id uuid primary key references private.property_access_requests(id) on delete cascade,
  additional_members jsonb not null default '[]' check(jsonb_typeof(additional_members)='array' and jsonb_array_length(additional_members)<=10),
  is_trust boolean not null default false,trust_name text not null default '' check(length(trust_name)<=200),
  decision_first_name text not null default '' check(length(decision_first_name)<=80), decision_last_name text not null default '' check(length(decision_last_name)<=80),
  decision_email text not null default '' check(length(decision_email)<=254), decision_phone text not null default '' check(length(decision_phone)<=50),
  updated_at timestamptz not null default now(),
  check(not is_trust or (length(trim(trust_name))>0 and length(trim(decision_first_name))>0 and length(trim(decision_last_name))>0))
);
alter table private.property_households enable row level security;
revoke all on private.property_households from public,anon,authenticated;
create function private.households(p_staff boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() or (p_staff and not private.staff_authorized()) then raise exception 'Authorized account required' using errcode='42501'; end if;
  return jsonb_build_object('properties',coalesce((select jsonb_agg(jsonb_build_object('request_id',r.id,'lot_number',p.lot_number,'street_address',p.street_address,
    'status',r.status,'display_name',case when p_staff then d.display_name else null end,'household',coalesce(to_jsonb(h)-'request_id','{}'::jsonb)) order by p.lot_number,r.id)
    from private.property_access_requests r join public.properties p on p.id=r.property_id
    left join private.property_households h on h.request_id=r.id left join public.portal_account_details d on d.user_id=r.user_id
    where (p_staff or r.user_id=auth.uid()) and r.status in ('pending','approved')),'[]'::jsonb));
end $$;
create function private.save_property_household(p_request uuid,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_members jsonb:=coalesce(p_details->'additional_members','[]'::jsonb); v_member jsonb; v_trust boolean:=coalesce((p_details->>'is_trust')::boolean,false);
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  perform 1 from private.property_access_requests where id=p_request and user_id=auth.uid() and status in ('pending','approved') for update;
  if not found then raise exception 'Choose your own active property request' using errcode='42501'; end if;
  if jsonb_typeof(v_members)<>'array' or jsonb_array_length(v_members)>10 then raise exception 'Add at most ten other household members'; end if;
  for v_member in select value from jsonb_array_elements(v_members) loop
    if jsonb_typeof(v_member)<>'object' or length(trim(coalesce(v_member->>'first_name',''))) not between 1 and 80
      or length(trim(coalesce(v_member->>'last_name',''))) not between 1 and 80
      or coalesce(v_member->>'relationship','') not in ('spouse','co_owner','other')
      or length(coalesce(v_member->>'email',''))>254 or length(coalesce(v_member->>'phone',''))>50
      or (v_member - array['first_name','last_name','relationship','email','phone'])<>'{}'::jsonb then raise exception 'Enter a first name, last name and relationship for each additional member'; end if;
  end loop;
  if v_trust and (length(trim(coalesce(p_details->>'trust_name','')))=0 or length(trim(coalesce(p_details->>'decision_first_name','')))=0 or length(trim(coalesce(p_details->>'decision_last_name','')))=0) then raise exception 'Enter the trust name and the decision maker first and last names'; end if;
  insert into private.property_households(request_id,additional_members,is_trust,trust_name,decision_first_name,decision_last_name,decision_email,decision_phone)
    values(p_request,v_members,v_trust,case when v_trust then trim(coalesce(p_details->>'trust_name','')) else '' end,
      case when v_trust then trim(coalesce(p_details->>'decision_first_name','')) else '' end,case when v_trust then trim(coalesce(p_details->>'decision_last_name','')) else '' end,
      case when v_trust then trim(coalesce(p_details->>'decision_email','')) else '' end,case when v_trust then trim(coalesce(p_details->>'decision_phone','')) else '' end)
    on conflict(request_id) do update set additional_members=excluded.additional_members,is_trust=excluded.is_trust,trust_name=excluded.trust_name,
      decision_first_name=excluded.decision_first_name,decision_last_name=excluded.decision_last_name,decision_email=excluded.decision_email,decision_phone=excluded.decision_phone,updated_at=now();
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_household_updated',jsonb_build_object('request_id',p_request,'is_trust',v_trust));
end $$;

create table public.hoa_events(
  id uuid primary key default gen_random_uuid(),kind text not null default 'event' check(kind in ('meeting','event')),
  title text not null check(length(trim(title)) between 1 and 180),event_date date not null check(isfinite(event_date)),
  start_time time,end_time time,location text not null default '' check(length(location)<=160),address text not null default '' check(length(address)<=500),
  details text not null default '' check(length(details)<=5000),visibility text not null default 'public' check(visibility in ('public','members')),
  published boolean not null default false,cancelled boolean not null default false,source_key text unique,
  created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(end_time is null or (start_time is not null and end_time>=start_time))
);
create index hoa_events_date_idx on public.hoa_events(event_date,id);
create index hoa_events_creator_idx on public.hoa_events(created_by);
alter table public.hoa_events enable row level security;
revoke all on public.hoa_events from public,anon,authenticated;
grant select on public.hoa_events to anon,authenticated;
grant insert,update on public.hoa_events to authenticated;
create policy hoa_events_public_read on public.hoa_events for select to anon using(published and visibility='public');
create policy hoa_events_authenticated_read on public.hoa_events for select to authenticated
  using((published and (visibility='public' or (select private.can_read_member_information()))) or (select private.staff_authorized()));
create policy hoa_events_staff_insert on public.hoa_events for insert to authenticated with check((select private.staff_authorized()));
create policy hoa_events_staff_update on public.hoa_events for update to authenticated using((select private.staff_authorized())) with check((select private.staff_authorized()));
create function private.stamp_hoa_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    if not private.staff_authorized() then raise exception 'Leadership with MFA required' using errcode='42501'; end if;
    if tg_op='INSERT' then new.created_by:=auth.uid();new.created_at:=now();else new.created_by:=old.created_by;new.created_at:=old.created_at;new.source_key:=old.source_key;end if;
    insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'calendar_event_saved',jsonb_build_object('event_id',new.id,'visibility',new.visibility,'published',new.published));
  end if;
  new.updated_at:=now();return new;
end $$;
revoke all on function private.stamp_hoa_event() from public,anon,authenticated;
create trigger stamp_hoa_event before insert or update on public.hoa_events for each row execute function private.stamp_hoa_event();
-- Preserve the existing reviewed Events.txt record; future edits use the portal.
insert into public.hoa_events(kind,title,event_date,start_time,location,address,visibility,published,source_key)
values('meeting','Annual Meeting','2026-10-09','18:30','Gardner Senior Center','128 E Park St, Gardner, KS 66030','public',true,'events-txt:2026-10-09:Annual Meeting');
create function private.calendar_events(p_member boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if p_member and not private.can_read_member_information() then raise exception 'Member access and current rental paperwork required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'event_date',event_date,'start_time',start_time,'end_time',end_time,
    'location',location,'address',address,'details',details,'visibility',visibility,'cancelled',cancelled) order by event_date,start_time nulls last,id)
    from public.hoa_events where published and event_date>=private.hoa_today() and (visibility='public' or p_member)),'[]'::jsonb);
end $$;

-- Encrypted service secrets are never in ordinary contact rows or public tables.
create extension if not exists supabase_vault with schema vault;
create table private.service_credentials(
  id uuid primary key default gen_random_uuid(),contact_id uuid not null references public.hoa_service_contacts(id) on delete restrict,
  secret_id uuid not null unique references vault.secrets(id) on delete restrict,
  title text not null check(length(trim(title)) between 1 and 160),
  created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index service_credentials_contact_idx on private.service_credentials(contact_id);
create index service_credentials_creator_idx on private.service_credentials(created_by);
create table private.service_vault_unlocks(
  session_id uuid primary key references auth.sessions(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
  unlocked_until timestamptz not null
);
create index service_vault_unlocks_user_idx on private.service_vault_unlocks(user_id);
alter table private.service_credentials enable row level security;
alter table private.service_vault_unlocks enable row level security;
revoke all on private.service_credentials,private.service_vault_unlocks from public,anon,authenticated;

create function private.service_vault_eligible() returns boolean language sql stable security definer set search_path='' as $$
  select private.confirmed_account() and coalesce((private.portal_flags()->>'can_manage_leadership')::boolean,false)
    and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and s.aal::text='aal2'
      and (s.not_after is null or s.not_after>now()));
$$;
create function private.service_vault_status() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('eligible',private.service_vault_eligible(),'unlocked',private.service_vault_eligible() and exists(
    select 1 from private.service_vault_unlocks u where u.user_id=auth.uid() and u.session_id::text=auth.jwt()->>'session_id' and u.unlocked_until>now()),
    'unlocked_until',(select unlocked_until from private.service_vault_unlocks where user_id=auth.uid() and session_id::text=auth.jwt()->>'session_id'));
$$;
create function private.unlock_service_vault() returns void language plpgsql security definer set search_path='' as $$
declare v_session uuid;v_mfa numeric;
begin
  if not private.service_vault_eligible() then raise exception 'Administrator with MFA and an active session required' using errcode='42501'; end if;
  select max((entry->>'timestamp')::numeric) into v_mfa from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) entry
    where entry->>'method' in ('mfa/totp','totp');
  if v_mfa is null or v_mfa<extract(epoch from now())-60 or v_mfa>extract(epoch from now())+30 then raise exception 'Verify a fresh authenticator code to unlock the safe' using errcode='42501'; end if;
  v_session:=(auth.jwt()->>'session_id')::uuid;
  insert into private.service_vault_unlocks(session_id,user_id,unlocked_until) values(v_session,auth.uid(),now()+interval '5 minutes')
    on conflict(session_id) do update set user_id=excluded.user_id,unlocked_until=excluded.unlocked_until;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'service_vault_unlocked','{}');
end $$;
create function private.require_service_vault() returns void language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((private.service_vault_status()->>'unlocked')::boolean,false) then raise exception 'Unlock the password safe with administrator MFA first' using errcode='42501'; end if;
end $$;
create function private.list_service_credentials(p_contact uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_service_vault();
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'updated_at',updated_at) order by title,id) from private.service_credentials where contact_id=p_contact),'[]'::jsonb);
end $$;
create function private.save_service_credential(p_id uuid,p_contact uuid,p_title text,p_values jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());v_secret uuid;v_values jsonb;
begin
  perform private.require_service_vault();
  if not exists(select 1 from public.hoa_service_contacts where id=p_contact and not archived) then raise exception 'Choose an active service contact'; end if;
  if length(trim(coalesce(p_title,''))) not between 1 and 160 or jsonb_typeof(p_values) is distinct from 'object' or octet_length(p_values::text)>16000
    or (p_values-array['login_url','username','password','account_number','routing_number','notes'])<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_values) e where jsonb_typeof(e.value)<>'string') then raise exception 'Enter valid service login or account details'; end if;
  v_values:=p_values;
  if p_id is not null then
    select secret_id into v_secret from private.service_credentials where id=p_id and contact_id=p_contact for update;
    if not found then raise exception 'Credential not found'; end if;
    perform vault.update_secret(v_secret,v_values::text);
    update private.service_credentials set title=trim(p_title),updated_at=now() where id=p_id;
  else
    v_secret:=vault.create_secret(v_values::text,'hoa-service-'||v_id::text,'HOA service credential');
    insert into private.service_credentials(id,contact_id,secret_id,title,created_by) values(v_id,p_contact,v_secret,trim(p_title),auth.uid());
  end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'service_credential_saved',jsonb_build_object('credential_id',v_id,'contact_id',p_contact));
  return v_id;
end $$;
create function private.reveal_service_credential(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_values jsonb;
begin
  perform private.require_service_vault();
  select v.decrypted_secret::jsonb into v_values from private.service_credentials c join vault.decrypted_secrets v on v.id=c.secret_id where c.id=p_id;
  if not found then raise exception 'Credential not found'; end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'service_credential_revealed',jsonb_build_object('credential_id',p_id));
  return v_values;
end $$;
create function private.remove_service_credential(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_secret uuid;
begin
  perform private.require_service_vault();
  select secret_id into v_secret from private.service_credentials where id=p_id for update;
  if not found then raise exception 'Credential not found'; end if;
  delete from private.service_credentials where id=p_id;
  delete from vault.secrets where id=v_secret;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'service_credential_removed',jsonb_build_object('credential_id',p_id));
end $$;
create function private.lock_service_vault() returns void language plpgsql security definer set search_path='' as $$
begin delete from private.service_vault_unlocks where user_id=auth.uid() and session_id::text=auth.jwt()->>'session_id';end $$;

revoke all on function private.service_vault_eligible(),private.require_service_vault() from public,anon,authenticated;
revoke all on function private.member_profile(),private.save_member_profile(jsonb,boolean),private.households(boolean),private.save_property_household(uuid,jsonb),
  private.service_vault_status(),private.unlock_service_vault(),private.lock_service_vault(),private.list_service_credentials(uuid),
  private.save_service_credential(uuid,uuid,text,jsonb),private.reveal_service_credential(uuid),private.remove_service_credential(uuid) from public,anon;
grant execute on function private.member_profile(),private.save_member_profile(jsonb,boolean),private.households(boolean),private.save_property_household(uuid,jsonb),
  private.service_vault_status(),private.unlock_service_vault(),private.lock_service_vault(),private.list_service_credentials(uuid),
  private.save_service_credential(uuid,uuid,text,jsonb),private.reveal_service_credential(uuid),private.remove_service_credential(uuid) to authenticated;
revoke all on function private.calendar_events(boolean) from public;
grant execute on function private.calendar_events(boolean) to anon,authenticated;

create function public.get_member_profile() returns jsonb language sql stable security invoker set search_path='' as $$select private.member_profile();$$;
create function public.save_member_profile(p_details jsonb,p_notice_consent boolean) returns void language sql security invoker set search_path='' as $$select private.save_member_profile(p_details,p_notice_consent);$$;
create function public.get_property_households() returns jsonb language sql stable security invoker set search_path='' as $$select private.households(false);$$;
create function public.get_staff_property_households() returns jsonb language sql stable security invoker set search_path='' as $$select private.households(true);$$;
create function public.save_property_household(p_request_id uuid,p_details jsonb) returns void language sql security invoker set search_path='' as $$select private.save_property_household(p_request_id,p_details);$$;
create function public.get_public_events() returns jsonb language sql stable security invoker set search_path='' as $$select private.calendar_events(false);$$;
create function public.get_member_events() returns jsonb language sql stable security invoker set search_path='' as $$select private.calendar_events(true);$$;
create function public.get_service_vault_status() returns jsonb language sql stable security invoker set search_path='' as $$select private.service_vault_status();$$;
create function public.unlock_service_vault() returns void language sql security invoker set search_path='' as $$select private.unlock_service_vault();$$;
create function public.lock_service_vault() returns void language sql security invoker set search_path='' as $$select private.lock_service_vault();$$;
create function public.list_service_credentials(p_contact_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_service_credentials(p_contact_id);$$;
create function public.save_service_credential(p_id uuid,p_contact_id uuid,p_title text,p_values jsonb) returns uuid language sql security invoker set search_path='' as $$select private.save_service_credential(p_id,p_contact_id,p_title,p_values);$$;
create function public.reveal_service_credential(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.reveal_service_credential(p_id);$$;
create function public.remove_service_credential(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.remove_service_credential(p_id);$$;
revoke all on function public.get_member_profile(),public.save_member_profile(jsonb,boolean),public.get_property_households(),public.get_staff_property_households(),
  public.save_property_household(uuid,jsonb),public.get_member_events(),public.get_service_vault_status(),public.unlock_service_vault(),public.lock_service_vault(),
  public.list_service_credentials(uuid),public.save_service_credential(uuid,uuid,text,jsonb),public.reveal_service_credential(uuid),public.remove_service_credential(uuid) from public,anon;
grant execute on function public.get_member_profile(),public.save_member_profile(jsonb,boolean),public.get_property_households(),public.get_staff_property_households(),
  public.save_property_household(uuid,jsonb),public.get_member_events(),public.get_service_vault_status(),public.unlock_service_vault(),public.lock_service_vault(),
  public.list_service_credentials(uuid),public.save_service_credential(uuid,uuid,text,jsonb),public.reveal_service_credential(uuid),public.remove_service_credential(uuid) to authenticated;
revoke all on function public.get_public_events() from public;
grant execute on function public.get_public_events() to anon,authenticated;
notify pgrst,'reload schema';
