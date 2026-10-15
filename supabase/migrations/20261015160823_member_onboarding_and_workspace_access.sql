-- Workspace access is distinct from public appointments and property ownership.
-- Explicit false overrides an appointment's default access; administrators retain access.
create table private.portal_workspace_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  administration boolean not null,
  leadership_tools boolean not null,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
create index portal_workspace_access_updater_idx on private.portal_workspace_access(updated_by);
alter table private.portal_workspace_access enable row level security;
revoke all on private.portal_workspace_access from public,anon,authenticated;

create or replace function private.portal_flags() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_person uuid; v_admin boolean:=false; v_director boolean:=false; v_officer boolean:=false;
  v_mfa boolean:=false; v_management boolean:=false; v_tools boolean:=false; v_access private.portal_workspace_access;
begin
  if private.confirmed_account() then
    select exists(select 1 from public.user_roles where user_id=v_uid and role='admin') into v_admin;
    select person_id into v_person from private.leadership_account_links where user_id=v_uid and revoked_at is null;
    select exists(select 1 from public.board_member_years where person_id=v_person and privileges_enabled and record_kind='director' and current_date between starts_on and ends_on) into v_director;
    select exists(select 1 from public.officer_member_years where person_id=v_person and privileges_enabled and current_date between starts_on and ends_on) into v_officer;
    select * into v_access from private.portal_workspace_access where user_id=v_uid;
    v_management:=v_admin or coalesce(v_access.administration,v_director or v_officer);
    v_tools:=v_admin or coalesce(v_access.leadership_tools,v_director or v_officer);
    v_mfa:=coalesce(auth.jwt()->>'aal','')='aal2';
  end if;
  return jsonb_build_object('is_admin',v_admin,'is_director',v_director,'is_officer',v_officer,'has_mfa',v_mfa,
    'can_access_admin',v_management,'can_access_tools',v_tools,'can_review_members',v_mfa and v_management,
    'can_view_signup_code',v_mfa and v_management,'can_manage_leadership',v_mfa and v_admin);
end $$;
create or replace function private.staff_authorized() returns boolean
language sql stable security invoker set search_path='' as $$select coalesce((private.portal_flags()->>'can_review_members')::boolean,false);$$;
create or replace function private.hoa_records_staff() returns boolean
language sql stable security invoker set search_path='' as $$
  select coalesce((private.portal_flags()->>'has_mfa')::boolean,false) and coalesce((private.portal_flags()->>'can_access_tools')::boolean,false);
$$;

create function private.account_access_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce((private.portal_flags()->>'can_manage_leadership')::boolean,false) then raise exception 'System administrator with MFA required' using errcode='42501'; end if;
  return jsonb_build_object('accounts',coalesce((select jsonb_agg(jsonb_build_object(
    'user_id',a.id,'email',a.email,'display_name',coalesce(nullif(d.display_name,''),a.email),
    'is_admin',exists(select 1 from public.user_roles ur where ur.user_id=a.id and ur.role='admin'),
    'administration',exists(select 1 from public.user_roles ur where ur.user_id=a.id and ur.role='admin') or coalesce(w.administration,roles.appointed),
    'leadership_tools',exists(select 1 from public.user_roles ur where ur.user_id=a.id and ur.role='admin') or coalesce(w.leadership_tools,roles.appointed),
    'application_status',case when exists(select 1 from private.property_access_requests r where r.user_id=a.id and private.verified_property_request(r.id)) then 'approved'
      when exists(select 1 from private.property_access_requests r where r.user_id=a.id and r.status='pending') then 'pending'
      when exists(select 1 from private.property_access_requests r where r.user_id=a.id) then 'needs_changes' else 'not_submitted' end)
    order by a.email) from auth.users a left join public.portal_account_details d on d.user_id=a.id
    left join private.portal_workspace_access w on w.user_id=a.id
    cross join lateral (select exists(select 1 from private.leadership_account_links l where l.user_id=a.id and l.revoked_at is null and (
      exists(select 1 from public.board_member_years b where b.person_id=l.person_id and b.privileges_enabled and b.record_kind='director' and current_date between b.starts_on and b.ends_on)
      or exists(select 1 from public.officer_member_years o where o.person_id=l.person_id and o.privileges_enabled and current_date between o.starts_on and o.ends_on))) as appointed) roles
    where a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)),'[]'::jsonb));
end $$;
create function private.set_account_workspace_access(p_user uuid,p_administration boolean,p_tools boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce((private.portal_flags()->>'can_manage_leadership')::boolean,false) then raise exception 'System administrator with MFA required' using errcode='42501'; end if;
  if p_administration is null or p_tools is null then raise exception 'Choose both workspace access settings'; end if;
  perform 1 from auth.users where id=p_user and email_confirmed_at is not null and not coalesce(is_anonymous,false) for update;
  if not found then raise exception 'Choose a confirmed registered account'; end if;
  if exists(select 1 from public.user_roles where user_id=p_user and role='admin') then raise exception 'System administrators retain both workspaces; these controls manage member workspace access.'; end if;
  insert into private.portal_workspace_access(user_id,administration,leadership_tools,updated_by)
    values(p_user,p_administration,p_tools,auth.uid()) on conflict(user_id) do update
    set administration=excluded.administration,leadership_tools=excluded.leadership_tools,updated_by=excluded.updated_by,updated_at=now();
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'workspace_access_changed',jsonb_build_object('user_id',p_user,'administration',p_administration,'leadership_tools',p_tools));
end $$;

create function private.member_application_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_phase text; v_workspace jsonb;
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'property_id',r.property_id,'lot_number',p.lot_number,'street_address',p.street_address,
    'status',r.status,'relationship',r.requested_relationship,'occupancy_choice',r.occupancy_choice,'request_note',r.request_note,'review_note',r.review_note,'submitted_at',r.submitted_at) order by r.submitted_at desc),'[]'::jsonb)
    into v_workspace from private.property_access_requests r join public.properties p on p.id=r.property_id where r.user_id=auth.uid();
  if exists(select 1 from private.property_access_requests r where r.user_id=auth.uid() and private.verified_property_request(r.id)) then v_phase:='approved';
  elsif exists(select 1 from private.property_access_requests r where r.user_id=auth.uid() and r.status='pending') then
    if exists(select 1 from private.property_access_requests r where r.user_id=auth.uid() and r.status='pending' and not private.rental_complete(r.id)) then v_phase:='setup'; else v_phase:='pending'; end if;
  elsif exists(select 1 from private.property_access_requests r where r.user_id=auth.uid()) then v_phase:='needs_changes';
  else v_phase:='setup'; end if;
  return jsonb_build_object('phase',v_phase,'requests',v_workspace);
end $$;

-- Member information requires approved ownership, or authorized staff with MFA.
-- Pending applicants retain only their own application/profile/upload endpoints.
create or replace function private.can_read_member_information() returns boolean
language sql stable security definer set search_path='' as $$
  select private.confirmed_account() and (
    private.staff_authorized() or private.hoa_records_staff() or exists(select 1 from private.property_access_requests r where r.user_id=auth.uid() and private.verified_property_request(r.id)))
    and not exists(select 1 from private.property_access_requests r where r.user_id=auth.uid() and r.status in ('pending','approved') and not private.rental_complete(r.id));
$$;
create or replace function private.member_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  return jsonb_build_object('allowed',private.can_read_member_information(),'application_phase',private.member_application_status()->>'phase','rental_requirements',coalesce((
    select jsonb_agg(jsonb_build_object('request_id',r.id,'lot_number',p.lot_number,'street_address',p.street_address))
    from private.property_access_requests r join public.properties p on p.id=r.property_id
    where r.user_id=auth.uid() and r.status in ('pending','approved') and not private.rental_complete(r.id)),'[]'::jsonb));
end $$;

create function private.submit_member_application(p_details jsonb,p_property uuid,p_relationship text,p_note text,p_choice text,p_consent boolean,p_household jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_request uuid;
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  -- Serialize repeat clicks and retries for this account without duplicating requests.
  perform 1 from auth.users where id=auth.uid() for update;
  if private.member_application_status()->>'phase'='pending' then raise exception 'Your application is already pending review. You do not need to submit again.'; end if;
  if exists(select 1 from private.property_access_requests r where r.user_id=auth.uid() and r.status='approved') then raise exception 'Your account is already approved. Use the member update forms.'; end if;
  if length(trim(coalesce(p_details->>'mailing_street','')))=0 or length(trim(coalesce(p_details->>'mailing_city','')))=0
    or length(trim(coalesce(p_details->>'mailing_state','')))=0 or length(trim(coalesce(p_details->>'mailing_postal_code','')))=0 then raise exception 'Enter your mailing street, city, state and ZIP code'; end if;
  perform private.save_member_profile(p_details,p_consent);
  select id into v_request from private.property_access_requests where user_id=auth.uid() and status='pending' order by submitted_at desc limit 1 for update;
  if v_request is not null then
    if not exists(select 1 from private.property_access_requests where id=v_request and property_id=p_property) then raise exception 'Finish or correct your existing property application before selecting another home'; end if;
    update private.property_access_requests set requested_relationship=p_relationship,request_note=trim(coalesce(p_note,'')) where id=v_request;
    perform private.set_property_occupancy_choice(v_request,p_choice);
  else v_request:=private.request_property_with_occupancy(p_property,p_relationship,p_note,p_choice); end if;
  perform private.save_property_household(v_request,coalesce(p_household,'{}'::jsonb));
  return v_request;
end $$;

revoke all on function private.account_access_workspace(),private.set_account_workspace_access(uuid,boolean,boolean),private.member_application_status(),private.submit_member_application(jsonb,uuid,text,text,text,boolean,jsonb) from public,anon;
grant execute on function private.account_access_workspace(),private.set_account_workspace_access(uuid,boolean,boolean),private.member_application_status(),private.submit_member_application(jsonb,uuid,text,text,text,boolean,jsonb) to authenticated;
create function public.get_account_access_workspace() returns jsonb language sql stable security invoker set search_path='' as $$select private.account_access_workspace();$$;
create function public.set_account_workspace_access(p_user_id uuid,p_administration boolean,p_leadership_tools boolean) returns void language sql security invoker set search_path='' as $$select private.set_account_workspace_access(p_user_id,p_administration,p_leadership_tools);$$;
create function public.get_member_application_status() returns jsonb language sql stable security invoker set search_path='' as $$select private.member_application_status();$$;
create function public.submit_member_application(p_details jsonb,p_property_id uuid,p_relationship text,p_note text,p_occupancy_choice text,p_notice_consent boolean,p_household jsonb) returns uuid
language sql security invoker set search_path='' as $$select private.submit_member_application(p_details,p_property_id,p_relationship,p_note,p_occupancy_choice,p_notice_consent,p_household);$$;
revoke all on function public.get_account_access_workspace(),public.set_account_workspace_access(uuid,boolean,boolean),public.get_member_application_status(),public.submit_member_application(jsonb,uuid,text,text,text,boolean,jsonb) from public,anon;
grant execute on function public.get_account_access_workspace(),public.set_account_workspace_access(uuid,boolean,boolean),public.get_member_application_status(),public.submit_member_application(jsonb,uuid,text,text,text,boolean,jsonb) to authenticated;

-- Administrator self-review remains explicit, MFA-protected and audited.
create or replace function private.review_property_request(p_request_id uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare v_request private.property_access_requests; v_contact uuid; v_email text; v_details public.portal_account_details; v_link uuid;
begin
  if not private.staff_authorized() then raise exception 'Serving Director or Officer with MFA required' using errcode='42501'; end if;
  select * into v_request from private.property_access_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.user_id=auth.uid() and not (private.portal_flags()->>'is_admin')::boolean then raise exception 'Only a system administrator may review their own ownership request.' using errcode='42501'; end if;
  if length(trim(coalesce(p_note,''))) not between 1 and 1000 then raise exception 'Record how ownership was checked, or the reason for rejection or revocation.'; end if;
  if not ((v_request.status='pending' and p_decision in ('approved','rejected')) or (v_request.status='approved' and p_decision='revoked')) then raise exception 'This request has already changed. Refresh before reviewing.'; end if;
  if p_decision='approved' then
    perform 1 from public.properties where id=v_request.property_id for update;
    if not private.rental_complete(p_request_id) then raise exception 'A current rental agreement PDF and both lease dates are required before approving this rental property.'; end if;
    if v_request.declared_rental then
      perform private.update_property_occupancy(v_request.property_id,'rental','Verified applicant reported rental occupancy.');
    end if;
    -- Serialize concurrent approvals across multiple properties for one account.
    insert into public.user_profiles(user_id) values(v_request.user_id) on conflict(user_id) do nothing;
    select contact_id into v_contact from public.user_profiles where user_id=v_request.user_id for update;
    select email into v_email from auth.users where id=v_request.user_id and email_confirmed_at is not null and not coalesce(is_anonymous,false);
    select * into v_details from public.portal_account_details where user_id=v_request.user_id;
    if v_email is null or v_details.user_id is null then raise exception 'Applicant needs a confirmed account and current contact information.'; end if;
    if v_contact is null then
      insert into public.contacts(display_name,email,phone,contact_verified_at,contact_notes)
        values(v_details.display_name,v_email,v_details.phone,now(),'Current account verified through explicit property review; not a historical import.') returning id into v_contact;
      update public.user_profiles set contact_id=v_contact where user_id=v_request.user_id;
    end if;
    insert into public.property_contacts(property_id,contact_id,relationship,started_on,ownership_verified_at,notes)
      values(v_request.property_id,v_contact,v_request.requested_relationship,current_date,now(),'Explicit portal property approval.') returning id into v_link;
  elsif p_decision='revoked' then
    update public.property_contacts set ended_on=current_date where id=v_request.property_contact_id;
  end if;
  update private.property_access_requests set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(p_note),property_contact_id=coalesce(v_link,property_contact_id) where id=p_request_id;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_request_'||p_decision,jsonb_build_object('request_id',p_request_id,'property_id',v_request.property_id,'administrator_self_review',v_request.user_id=auth.uid()));
end $$;
-- Calendar editing is available from either authorized workspace.
create function private.calendar_authorized() returns boolean language sql stable security invoker set search_path='' as $$
  select private.staff_authorized() or private.hoa_records_staff();
$$;
revoke all on function private.calendar_authorized() from public,anon;
grant execute on function private.calendar_authorized() to authenticated;
alter policy hoa_events_authenticated_read on public.hoa_events
  using((published and (visibility='public' or (select private.can_read_member_information()))) or (select private.calendar_authorized()));
alter policy hoa_events_staff_insert on public.hoa_events with check((select private.calendar_authorized()));
alter policy hoa_events_staff_update on public.hoa_events using((select private.calendar_authorized())) with check((select private.calendar_authorized()));
create or replace function private.stamp_hoa_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    if not private.calendar_authorized() then raise exception 'Leadership with MFA required' using errcode='42501'; end if;
    if tg_op='INSERT' then new.created_by:=auth.uid();new.created_at:=now();else new.created_by:=old.created_by;new.created_at:=old.created_at;new.source_key:=old.source_key;end if;
    insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'calendar_event_saved',jsonb_build_object('event_id',new.id,'visibility',new.visibility,'published',new.published));
  end if;
  new.updated_at:=now();return new;
end $$;
notify pgrst,'reload schema';
