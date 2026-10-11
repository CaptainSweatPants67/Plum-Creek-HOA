-- Additive migration for the installed HOA schema. No historic contacts are linked.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, supabase_auth_admin;

create table public.leadership_people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  source_key text unique,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.officer_positions (
  code text primary key check (code ~ '^[a-z_]+$'),
  title text not null,
  sort_order integer not null
);
insert into public.officer_positions values
  ('president','President',1), ('vice_president','Vice President',2),
  ('secretary','Secretary',3), ('treasurer','Treasurer',4);

create table public.board_member_years (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.leadership_people(id) on delete restrict,
  service_year integer not null check (service_year between 2000 and 2200),
  seat_label text not null default 'Director',
  recorded_position text not null default 'Director',
  record_kind text not null default 'director' check (record_kind in ('director','historical','vacant')),
  starts_on date,
  ends_on date,
  published boolean not null default false,
  privileges_enabled boolean not null default false,
  source text not null default 'administrative_entry',
  source_key text unique,
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (not privileges_enabled or (person_id is not null and record_kind = 'director' and starts_on is not null and ends_on is not null)),
  check (not privileges_enabled or (starts_on >= make_date(service_year,1,1) and ends_on <= make_date(service_year,12,31))),
  check ((record_kind = 'vacant') = (person_id is null))
);
create index board_member_years_person_idx on public.board_member_years(person_id);
create index board_member_years_year_idx on public.board_member_years(service_year);

create table public.officer_member_years (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.leadership_people(id) on delete restrict,
  position_code text not null references public.officer_positions(code) on delete restrict,
  service_year integer not null check (service_year between 2000 and 2200),
  starts_on date,
  ends_on date,
  published boolean not null default false,
  privileges_enabled boolean not null default false,
  source text not null default 'administrative_entry',
  source_key text unique,
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (not privileges_enabled or (person_id is not null and starts_on is not null and ends_on is not null))
  ,check (not privileges_enabled or (starts_on >= make_date(service_year,1,1) and ends_on <= make_date(service_year,12,31)))
);
create index officer_member_years_person_idx on public.officer_member_years(person_id);
create index officer_member_years_position_idx on public.officer_member_years(position_code);
create index officer_member_years_year_idx on public.officer_member_years(service_year);

create table private.leadership_account_links (
  person_id uuid primary key references public.leadership_people(id) on delete restrict,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table private.portal_bootstrap_admin (
  singleton boolean primary key default true check (singleton),
  email text not null,
  person_id uuid not null references public.leadership_people(id) on delete restrict,
  activated_user_id uuid references auth.users(id) on delete restrict,
  activated_at timestamptz
);
create index portal_bootstrap_person_idx on private.portal_bootstrap_admin(person_id);
create index portal_bootstrap_user_idx on private.portal_bootstrap_admin(activated_user_id);
create table private.signup_passcode (
  singleton boolean primary key default true check (singleton),
  passcode text not null,
  version uuid not null default gen_random_uuid(),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into private.signup_passcode (passcode)
values (upper(substr(replace(gen_random_uuid()::text,'-',''),1,24)));
create table private.signup_tickets (
  ticket_hash text primary key,
  email_hash text not null,
  passcode_version uuid not null,
  expires_at timestamptz not null,
  approved_user_id uuid,
  approved_at timestamptz
);
create index signup_tickets_expiry_idx on private.signup_tickets(expires_at);
create table private.signup_attempts (
  email_hash text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
create table private.leadership_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  recorded_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index leadership_audit_actor_idx on private.leadership_audit(actor_user_id);

alter table public.leadership_people enable row level security;
alter table public.officer_positions enable row level security;
alter table public.board_member_years enable row level security;
alter table public.officer_member_years enable row level security;
alter table private.leadership_account_links enable row level security;
alter table private.portal_bootstrap_admin enable row level security;
alter table private.signup_passcode enable row level security;
alter table private.signup_tickets enable row level security;
alter table private.signup_attempts enable row level security;
alter table private.leadership_audit enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on public.leadership_people, public.officer_positions, public.board_member_years, public.officer_member_years from public, anon, authenticated;
grant select on public.leadership_people, public.officer_positions, public.board_member_years, public.officer_member_years to anon, authenticated;

-- Remove unneeded whole-table privileges: RLS cannot protect TRUNCATE/REFERENCES.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

create function private.portal_flags() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_person uuid; v_admin boolean := false; v_director boolean := false; v_officer boolean := false; v_mfa boolean;
begin
  if v_uid is null or not exists (select 1 from auth.users where id=v_uid and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
    return jsonb_build_object('is_admin',false,'is_director',false,'is_officer',false,'has_mfa',false,'can_view_signup_code',false,'can_manage_leadership',false);
  end if;
  select exists(select 1 from public.user_roles where user_id=v_uid and role='admin') into v_admin;
  select person_id into v_person from private.leadership_account_links where user_id=v_uid and revoked_at is null;
  select exists(select 1 from public.board_member_years where person_id=v_person and privileges_enabled and record_kind='director' and current_date between starts_on and ends_on) into v_director;
  select exists(select 1 from public.officer_member_years where person_id=v_person and privileges_enabled and current_date between starts_on and ends_on) into v_officer;
  v_mfa := coalesce(auth.jwt()->>'aal','') = 'aal2';
  return jsonb_build_object('is_admin',v_admin,'is_director',v_director,'is_officer',v_officer,'has_mfa',v_mfa,
    'can_view_signup_code',v_mfa and (v_admin or v_director or v_officer), 'can_manage_leadership',v_mfa and v_admin);
end $$;
revoke all on function private.portal_flags() from public, anon;
grant execute on function private.portal_flags() to authenticated;

create function public.get_portal_flags() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.portal_flags(); $$;
revoke all on function public.get_portal_flags() from public, anon;
grant execute on function public.get_portal_flags() to authenticated;

create policy leadership_people_public on public.leadership_people for select to anon, authenticated using (is_public);
create policy officer_positions_public on public.officer_positions for select to anon, authenticated using (true);
create policy board_years_public on public.board_member_years for select to anon, authenticated using (published);
create policy officer_years_public on public.officer_member_years for select to anon, authenticated using (published);
create policy leadership_people_admin on public.leadership_people for all to authenticated using ((select private.portal_flags()->>'can_manage_leadership')::boolean) with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy board_years_admin on public.board_member_years for all to authenticated using ((select private.portal_flags()->>'can_manage_leadership')::boolean) with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy officer_years_admin on public.officer_member_years for all to authenticated using ((select private.portal_flags()->>'can_manage_leadership')::boolean) with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
grant insert, update on public.leadership_people, public.board_member_years, public.officer_member_years to authenticated;

create function public.get_public_leadership_roster() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'board', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'person_id',b.person_id,'name',coalesce(p.display_name,'Vacant'),
      'year',b.service_year,'term',b.seat_label,'position',b.recorded_position,'kind',b.record_kind) order by b.service_year desc,b.created_sort)
      from (select *,row_number() over (order by service_year desc,seat_label,id) as created_sort from public.board_member_years where published) b
      left join public.leadership_people p on p.id=b.person_id where b.person_id is null or p.is_public),'[]'::jsonb),
    'officers', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'person_id',o.person_id,'name',coalesce(p.display_name,'Vacant'),
      'year',o.service_year,'position',t.title,'position_code',t.code) order by o.service_year desc,t.sort_order,o.id)
      from public.officer_member_years o join public.officer_positions t on t.code=o.position_code
      left join public.leadership_people p on p.id=o.person_id where o.published and (o.person_id is null or p.is_public)),'[]'::jsonb));
$$;
revoke all on function public.get_public_leadership_roster() from public;
grant execute on function public.get_public_leadership_roster() to anon, authenticated;

-- Secret is retrievable for serving Directors/Officers after MFA; never public.
create function private.read_signup_passcode() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_code private.signup_passcode;
begin
  if auth.uid() is null or not (private.portal_flags()->>'can_view_signup_code')::boolean then raise exception 'Director or Officer login with MFA required' using errcode='42501'; end if;
  select * into v_code from private.signup_passcode where singleton;
  insert into private.leadership_audit(actor_user_id,action) values(auth.uid(),'signup_code_viewed');
  return jsonb_build_object('passcode',v_code.passcode,'enabled',v_code.enabled,'updated_at',v_code.updated_at);
end $$;
revoke all on function private.read_signup_passcode() from public, anon;
grant execute on function private.read_signup_passcode() to authenticated;
create function public.get_homeowner_signup_passcode() returns jsonb
language sql security invoker set search_path = '' as $$ select private.read_signup_passcode(); $$;
revoke all on function public.get_homeowner_signup_passcode() from public, anon;
grant execute on function public.get_homeowner_signup_passcode() to authenticated;

create function private.rotate_signup_passcode() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (private.portal_flags()->>'can_manage_leadership')::boolean then raise exception 'Administrator login with MFA required' using errcode='42501'; end if;
  update private.signup_passcode set passcode=upper(substr(replace(gen_random_uuid()::text,'-',''),1,24)),version=gen_random_uuid(),updated_at=now() where singleton;
  delete from private.signup_tickets;
  insert into private.leadership_audit(actor_user_id,action) values(auth.uid(),'signup_code_rotated');
end $$;
revoke all on function private.rotate_signup_passcode() from public, anon;
grant execute on function private.rotate_signup_passcode() to authenticated;
create function public.rotate_homeowner_signup_passcode() returns void
language sql security invoker set search_path = '' as $$ select private.rotate_signup_passcode(); $$;
revoke all on function public.rotate_homeowner_signup_passcode() from public, anon;
grant execute on function public.rotate_homeowner_signup_passcode() to authenticated;

-- Intentional unauthenticated entry point: knowledge of a high-entropy passcode
-- authorizes only a 10-minute, single-use signup ticket, never an HOA role.
create function private.issue_signup_ticket(p_email text,p_passcode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text:=lower(trim(p_email)); v_hash text; v_ticket text; v_code private.signup_passcode; v_attempts integer;
begin
  if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(p_passcode,''))>128 then
    return jsonb_build_object('error','Email and a valid homeowner signup passcode are required.');
  end if;
  v_hash:=encode(sha256(convert_to(v_email,'UTF8')),'hex');
  insert into private.signup_attempts(email_hash,window_start,attempts) values(v_hash,now(),1)
    on conflict(email_hash) do update set
      attempts=case when private.signup_attempts.window_start<now()-interval '15 minutes' then 1 else private.signup_attempts.attempts+1 end,
      window_start=case when private.signup_attempts.window_start<now()-interval '15 minutes' then now() else private.signup_attempts.window_start end
    returning attempts into v_attempts;
  if v_attempts>10 then return jsonb_build_object('error','Too many attempts. Please wait 15 minutes.'); end if;
  select * into v_code from private.signup_passcode where singleton and enabled;
  if v_code.passcode is null or upper(trim(coalesce(p_passcode,'')))<>v_code.passcode then return jsonb_build_object('error','Email and a valid homeowner signup passcode are required.'); end if;
  delete from private.signup_tickets where expires_at<now();
  delete from private.signup_attempts where window_start<now()-interval '1 day';
  v_ticket:=gen_random_uuid()::text;
  insert into private.signup_tickets(ticket_hash,email_hash,passcode_version,expires_at)
    values(encode(sha256(convert_to(v_ticket,'UTF8')),'hex'),v_hash,v_code.version,now()+interval '10 minutes');
  return jsonb_build_object('ticket',v_ticket,'expires_at',now()+interval '10 minutes');
end $$;
revoke all on function private.issue_signup_ticket(text,text) from public;
grant usage on schema private to anon;
grant execute on function private.issue_signup_ticket(text,text) to anon,authenticated;
create function public.request_homeowner_signup_ticket(p_email text,p_passcode text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.issue_signup_ticket(p_email,p_passcode); $$;
revoke all on function public.request_homeowner_signup_ticket(text,text) from public;
grant execute on function public.request_homeowner_signup_ticket(text,text) to anon,authenticated;

create function private.authorize_new_account(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text:=lower(trim(event->'user'->>'email')); v_user uuid; v_ticket text; v_hash text; v_matched boolean:=false;
begin
  if coalesce(event->'user'->'app_metadata'->>'provider','')<>'email' or coalesce((event->'user'->>'is_anonymous')::boolean,false) then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use email registration with the homeowner signup passcode.'));
  end if;
  if v_email is null or coalesce(event->'user'->>'id','') !~ '^[a-fA-F0-9-]{36}$' then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Invalid signup request.'));
  end if;
  v_user:=(event->'user'->>'id')::uuid;
  -- One explicitly configured bootstrap identity; activation waits for confirmation.
  if exists(select 1 from private.portal_bootstrap_admin where lower(email)=v_email and activated_at is null) then return '{}'::jsonb; end if;
  v_ticket:=event->'user'->'user_metadata'->>'signup_ticket';
  if v_ticket is not null and length(v_ticket)<=128 then
    v_hash:=encode(sha256(convert_to(v_ticket,'UTF8')),'hex');
    update private.signup_tickets t set approved_user_id=v_user,approved_at=coalesce(t.approved_at,now())
      from private.signup_passcode c where t.ticket_hash=v_hash and t.email_hash=encode(sha256(convert_to(v_email,'UTF8')),'hex')
      and t.expires_at>now() and c.singleton and c.enabled and c.version=t.passcode_version
      and (t.approved_user_id is null or t.approved_user_id=v_user) returning true into v_matched;
  end if;
  if coalesce(v_matched,false) then return '{}'::jsonb; end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','A valid homeowner signup passcode is required.'));
end $$;
revoke all on function private.authorize_new_account(jsonb) from public,anon,authenticated;
grant execute on function private.authorize_new_account(jsonb) to supabase_auth_admin;
create function public.hoa_before_user_created(event jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.authorize_new_account(event); $$;
revoke all on function public.hoa_before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.hoa_before_user_created(jsonb) to supabase_auth_admin;

-- Fail closed even before the optional Auth Hook is configured. Keeps direct
-- Auth API calls from bypassing the form, and removes the spent ticket metadata.
create function private.enforce_signup_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  v_result:=private.authorize_new_account(jsonb_build_object('user',jsonb_build_object('id',new.id,'email',new.email,
    'app_metadata',new.raw_app_meta_data,'user_metadata',new.raw_user_meta_data,'is_anonymous',new.is_anonymous)));
  if v_result ? 'error' then raise exception 'A valid homeowner signup passcode is required.'; end if;
  new.raw_user_meta_data:=coalesce(new.raw_user_meta_data,'{}'::jsonb)-'signup_ticket';
  return new;
end $$;
revoke all on function private.enforce_signup_gate() from public,anon,authenticated;
create trigger hoa_enforce_signup_gate before insert on auth.users for each row execute function private.enforce_signup_gate();

create function private.initialize_portal_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_bootstrap private.portal_bootstrap_admin;
begin
  insert into public.user_profiles(user_id) values(new.id) on conflict(user_id) do nothing;
  delete from private.signup_tickets where approved_user_id=new.id;
  if new.email_confirmed_at is not null and coalesce(new.raw_app_meta_data->>'provider','')='email' then
    select * into v_bootstrap from private.portal_bootstrap_admin where singleton for update;
    if v_bootstrap.activated_at is null and lower(new.email)=lower(v_bootstrap.email) then
      insert into public.user_roles(user_id,role) values(new.id,'admin') on conflict do nothing;
      insert into private.leadership_account_links(person_id,user_id) values(v_bootstrap.person_id,new.id);
      update public.board_member_years set privileges_enabled=true,starts_on=current_date,ends_on=make_date(service_year,12,31)
        where person_id=v_bootstrap.person_id and service_year=extract(year from current_date)::integer and record_kind='director';
      update public.officer_member_years set privileges_enabled=true,starts_on=current_date,ends_on=make_date(service_year,12,31)
        where person_id=v_bootstrap.person_id and service_year=extract(year from current_date)::integer;
      update private.portal_bootstrap_admin set activated_user_id=new.id,activated_at=now() where singleton;
      insert into private.leadership_audit(actor_user_id,action) values(new.id,'bootstrap_admin_confirmed');
    end if;
  end if;
  return new;
end $$;
revoke all on function private.initialize_portal_identity() from public,anon,authenticated;
create trigger hoa_initialize_portal_identity after insert or update of email_confirmed_at on auth.users for each row execute function private.initialize_portal_identity();

create function private.link_leadership_account(p_person_id uuid,p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if auth.uid() is null or not (private.portal_flags()->>'can_manage_leadership')::boolean then raise exception 'Administrator login with MFA required' using errcode='42501'; end if;
  select id into v_user from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if v_user is null then raise exception 'This person must register and confirm their current email first.'; end if;
  insert into private.leadership_account_links(person_id,user_id) values(p_person_id,v_user)
    on conflict(person_id) do update set user_id=excluded.user_id,verified_at=now(),revoked_at=null;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'leadership_account_linked',jsonb_build_object('person_id',p_person_id,'user_id',v_user));
end $$;
revoke all on function private.link_leadership_account(uuid,text) from public,anon;
grant execute on function private.link_leadership_account(uuid,text) to authenticated;
create function public.link_leadership_account(p_person_id uuid,p_email text) returns void
language sql security invoker set search_path = '' as $$ select private.link_leadership_account(p_person_id,p_email); $$;
revoke all on function public.link_leadership_account(uuid,text) from public,anon;
grant execute on function public.link_leadership_account(uuid,text) to authenticated;

create function private.audit_leadership_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.leadership_audit(actor_user_id,action,details)
    values(auth.uid(),'leadership_'||lower(tg_op),jsonb_build_object('table',tg_table_name,'record_id',new.id));
  return new;
end $$;
revoke all on function private.audit_leadership_change() from public,anon,authenticated;
create trigger audit_board_year after insert or update on public.board_member_years for each row execute function private.audit_leadership_change();
create trigger audit_officer_year after insert or update on public.officer_member_years for each row execute function private.audit_leadership_change();

create function private.prevent_overlapping_leadership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.privileges_enabled then return new; end if;
  if tg_table_name='officer_member_years' then
    perform pg_advisory_xact_lock(hashtext('officer:'||new.position_code));
    if exists(select 1 from public.officer_member_years where id<>new.id and position_code=new.position_code and privileges_enabled
      and daterange(starts_on,ends_on,'[]') && daterange(new.starts_on,new.ends_on,'[]')) then raise exception 'This Officer position already has an approved appointment for those dates.'; end if;
  else
    perform pg_advisory_xact_lock(hashtext('director:'||new.person_id::text));
    if exists(select 1 from public.board_member_years where id<>new.id and person_id=new.person_id and privileges_enabled
      and daterange(starts_on,ends_on,'[]') && daterange(new.starts_on,new.ends_on,'[]')) then raise exception 'This Director already has an approved appointment for those dates.'; end if;
  end if;
  return new;
end $$;
revoke all on function private.prevent_overlapping_leadership() from public,anon,authenticated;
create trigger validate_board_year before insert or update on public.board_member_years for each row execute function private.prevent_overlapping_leadership();
create trigger validate_officer_year before insert or update on public.officer_member_years for each row execute function private.prevent_overlapping_leadership();
create trigger audit_leadership_person after insert or update on public.leadership_people for each row execute function private.audit_leadership_change();

-- Allow API clients to discover the new RPCs after deployment.
notify pgrst, 'reload schema';
