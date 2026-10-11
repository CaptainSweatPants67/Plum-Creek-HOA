-- Member-entered current details and explicit property approval. No legacy promotion.
create table public.portal_account_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(trim(display_name)) between 1 and 160),
  phone text not null default '' check(length(phone)<=50),
  mailing_address text not null default '' check(length(mailing_address)<=500),
  updated_at timestamptz not null default now()
);
create table private.property_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','approved','rejected','revoked')),
  requested_relationship text not null check(requested_relationship in ('owner','co_owner')),
  request_note text not null default '' check(length(request_note)<=1000),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text not null default '' check(length(review_note)<=1000),
  property_contact_id uuid references public.property_contacts(id) on delete restrict
);
create unique index property_request_active_idx on private.property_access_requests(user_id,property_id) where status in ('pending','approved');
create index property_request_property_idx on private.property_access_requests(property_id);
create index property_request_reviewer_idx on private.property_access_requests(reviewed_by);
create index property_request_contact_idx on private.property_access_requests(property_contact_id);
create index property_request_status_idx on private.property_access_requests(status,submitted_at);
alter table public.portal_account_details enable row level security;
alter table private.property_access_requests enable row level security;
revoke all on public.portal_account_details from public,anon,authenticated;
revoke all on private.property_access_requests from public,anon,authenticated;
grant select,insert,update on public.portal_account_details to authenticated;

create function private.confirmed_account() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false));
$$;
revoke all on function private.confirmed_account() from public,anon;
grant execute on function private.confirmed_account() to authenticated;
create policy account_details_own_read on public.portal_account_details for select to authenticated
using(user_id=(select auth.uid()) and (select private.confirmed_account()));
create policy account_details_own_insert on public.portal_account_details for insert to authenticated
with check(user_id=(select auth.uid()) and (select private.confirmed_account()));
create policy account_details_own_update on public.portal_account_details for update to authenticated
using(user_id=(select auth.uid()) and (select private.confirmed_account()))
with check(user_id=(select auth.uid()) and (select private.confirmed_account()));
create function private.stamp_account_details() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end $$;
revoke all on function private.stamp_account_details() from public,anon,authenticated;
create trigger stamp_account_details before insert or update on public.portal_account_details for each row execute function private.stamp_account_details();

create function private.staff_authorized() returns boolean
language sql stable security invoker set search_path='' as $$
  select (private.portal_flags()->>'has_mfa')::boolean and (
    (private.portal_flags()->>'is_admin')::boolean or (private.portal_flags()->>'is_director')::boolean or (private.portal_flags()->>'is_officer')::boolean);
$$;
revoke all on function private.staff_authorized() from public,anon;
grant execute on function private.staff_authorized() to authenticated;

create function private.member_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  return jsonb_build_object(
    'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'occupancy_status',p.occupancy_status,'relationship',pc.relationship) order by p.lot_number)
      from private.property_access_requests r join public.properties p on p.id=r.property_id
      join public.property_contacts pc on pc.id=r.property_contact_id
      join public.user_profiles u on u.user_id=r.user_id and u.contact_id=pc.contact_id
      where r.user_id=auth.uid() and r.status='approved' and pc.ownership_verified_at is not null
      and pc.relationship in ('owner','co_owner') and pc.started_on<=current_date and (pc.ended_on is null or pc.ended_on>current_date)),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'lot_number',p.lot_number,'street_address',p.street_address,'status',r.status,'relationship',r.requested_relationship,'submitted_at',r.submitted_at,'review_note',r.review_note) order by r.submitted_at desc)
      from private.property_access_requests r join public.properties p on p.id=r.property_id where r.user_id=auth.uid()),'[]'::jsonb));
end $$;
revoke all on function private.member_workspace() from public,anon;
grant execute on function private.member_workspace() to authenticated;
create function public.get_member_workspace() returns jsonb language sql stable security invoker set search_path='' as $$select private.member_workspace();$$;
revoke all on function public.get_member_workspace() from public,anon;
grant execute on function public.get_member_workspace() to authenticated;

create function private.property_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'lot_number',lot_number,'street_address',street_address) order by lot_number) from public.properties),'[]'::jsonb);
end $$;
revoke all on function private.property_choices() from public,anon;
grant execute on function private.property_choices() to authenticated;
create function public.get_property_choices() returns jsonb language sql stable security invoker set search_path='' as $$select private.property_choices();$$;
revoke all on function public.get_property_choices() from public,anon;
grant execute on function public.get_property_choices() to authenticated;

create function private.submit_property_request(p_property_id uuid,p_relationship text,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  if not exists(select 1 from public.portal_account_details where user_id=auth.uid()) then raise exception 'Save your current contact information first.'; end if;
  insert into private.property_access_requests(user_id,property_id,requested_relationship,request_note)
    values(auth.uid(),p_property_id,p_relationship,trim(coalesce(p_note,''))) returning id into v_id;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_verification_requested',jsonb_build_object('request_id',v_id));
  return v_id;
end $$;
revoke all on function private.submit_property_request(uuid,text,text) from public,anon;
grant execute on function private.submit_property_request(uuid,text,text) to authenticated;
create function public.submit_property_access_request(p_property_id uuid,p_relationship text,p_note text) returns uuid language sql security invoker set search_path='' as $$select private.submit_property_request(p_property_id,p_relationship,p_note);$$;
revoke all on function public.submit_property_access_request(uuid,text,text) from public,anon;
grant execute on function public.submit_property_access_request(uuid,text,text) to authenticated;

create function private.review_property_request(p_request_id uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare v_request private.property_access_requests; v_contact uuid; v_email text; v_details public.portal_account_details; v_link uuid;
begin
  if not private.staff_authorized() then raise exception 'Serving Director or Officer with MFA required' using errcode='42501'; end if;
  select * into v_request from private.property_access_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.user_id=auth.uid() then raise exception 'You cannot review your own ownership request.' using errcode='42501'; end if;
  if length(trim(coalesce(p_note,''))) not between 1 and 1000 then raise exception 'Record how ownership was checked, or the reason for rejection or revocation.'; end if;
  if not ((v_request.status='pending' and p_decision in ('approved','rejected')) or (v_request.status='approved' and p_decision='revoked')) then raise exception 'This request has already changed. Refresh before reviewing.'; end if;
  if p_decision='approved' then
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
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_request_'||p_decision,jsonb_build_object('request_id',p_request_id,'property_id',v_request.property_id));
end $$;
revoke all on function private.review_property_request(uuid,text,text) from public,anon;
grant execute on function private.review_property_request(uuid,text,text) to authenticated;
create function public.review_property_access_request(p_request_id uuid,p_decision text,p_note text) returns void language sql security invoker set search_path='' as $$select private.review_property_request(p_request_id,p_decision,p_note);$$;
revoke all on function public.review_property_access_request(uuid,text,text) from public,anon;
grant execute on function public.review_property_access_request(uuid,text,text) to authenticated;

create function private.staff_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'Serving Director or Officer with MFA required' using errcode='42501'; end if;
  return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'display_name',d.display_name,'email',a.email,'phone',d.phone,'mailing_address',d.mailing_address,'lot_number',p.lot_number,'street_address',p.street_address,'status',r.status,'relationship',r.requested_relationship,'request_note',r.request_note,'review_note',r.review_note,'submitted_at',r.submitted_at) order by r.submitted_at desc)
    from private.property_access_requests r join public.properties p on p.id=r.property_id join auth.users a on a.id=r.user_id left join public.portal_account_details d on d.user_id=r.user_id),'[]'::jsonb),
    'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'occupancy_status',p.occupancy_status,
      'verified_contacts',coalesce((select jsonb_agg(jsonb_build_object('display_name',c.display_name,'relationship',pc.relationship)) from public.property_contacts pc join public.contacts c on c.id=pc.contact_id where pc.property_id=p.id and pc.ownership_verified_at is not null and pc.started_on<=current_date and (pc.ended_on is null or pc.ended_on>current_date)),'[]'::jsonb),
      'historical_contacts',coalesce((select jsonb_agg(jsonb_build_object('display_name',c.display_name,'verification','Historical / unverified')) from public.legacy_contact_links_staging s join public.contacts c on c.id=s.contact_id where s.lot_number=p.lot_number),'[]'::jsonb)) order by p.lot_number) from public.properties p),'[]'::jsonb));
end $$;
revoke all on function private.staff_workspace() from public,anon;
grant execute on function private.staff_workspace() to authenticated;
create function public.get_staff_workspace() returns jsonb language sql stable security invoker set search_path='' as $$select private.staff_workspace();$$;
revoke all on function public.get_staff_workspace() from public,anon;
grant execute on function public.get_staff_workspace() to authenticated;

create function private.update_property_occupancy(p_property_id uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare v_previous text;
begin
  if not private.staff_authorized() then raise exception 'Serving Director or Officer with MFA required' using errcode='42501'; end if;
  if p_status not in ('unknown','owner_occupied','rental','vacant') or p_status is null then raise exception 'Invalid occupancy status'; end if;
  if length(coalesce(p_note,''))>1000 then raise exception 'Occupancy note too long'; end if;
  select occupancy_status into v_previous from public.properties where id=p_property_id for update;
  if not found then raise exception 'Property not found'; end if;
  if v_previous=p_status then return; end if;
  update public.properties set occupancy_status=p_status,occupancy_updated_at=now() where id=p_property_id;
  update public.property_occupancy_history set effective_to=current_date where property_id=p_property_id and effective_to is null;
  insert into public.property_occupancy_history(property_id,occupancy_status,effective_from,changed_by,notes) values(p_property_id,p_status,current_date,auth.uid(),p_note);
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_occupancy_updated',jsonb_build_object('property_id',p_property_id,'from',v_previous,'to',p_status));
end $$;
revoke all on function private.update_property_occupancy(uuid,text,text) from public,anon;
grant execute on function private.update_property_occupancy(uuid,text,text) to authenticated;
create function public.update_property_occupancy(p_property_id uuid,p_status text,p_note text) returns void language sql security invoker set search_path='' as $$select private.update_property_occupancy(p_property_id,p_status,p_note);$$;
revoke all on function public.update_property_occupancy(uuid,text,text) from public,anon;
grant execute on function public.update_property_occupancy(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
