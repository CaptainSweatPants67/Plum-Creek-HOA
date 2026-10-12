-- Explicit member answers remain separate from authoritative HOA rental flags.
alter table private.property_access_requests add column occupancy_choice text
  check(occupancy_choice in ('rental','owner_occupied'));
-- An existing explicit rental declaration is known; never guess that someone lives in an unmarked home.
update private.property_access_requests set occupancy_choice='rental' where declared_rental;
alter table public.portal_account_details add column notification_email text not null default ''
  check(notification_email='' or (length(notification_email)<=254 and notification_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

create function private.set_property_occupancy_choice(p_request uuid,p_choice text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  if p_choice is null or p_choice not in ('rental','owner_occupied') then raise exception 'Select whether you rent out or lease your home, or currently live in it'; end if;
  perform 1 from private.property_access_requests where id=p_request and user_id=auth.uid() and status in ('pending','approved') for update;
  if not found then raise exception 'Choose your own active property request' using errcode='42501'; end if;
  if p_choice='rental' then
    -- Retain the existing rule that a verified owner's rental declaration updates HOA occupancy history.
    perform private.set_property_rental(p_request,true);
  else
    -- This describes the member's answer; it cannot clear a leadership rental flag or history.
    update private.property_access_requests set declared_rental=false where id=p_request;
  end if;
  update private.property_access_requests set occupancy_choice=p_choice where id=p_request;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'home_occupancy_choice_saved',jsonb_build_object('request_id',p_request,'choice',p_choice));
end $$;
create function private.request_property_with_occupancy(p_property uuid,p_relationship text,p_note text,p_choice text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_request uuid;
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  if p_choice is null or p_choice not in ('rental','owner_occupied') then raise exception 'Select whether you rent out or lease your home, or currently live in it'; end if;
  v_request:=private.request_property_verification(p_property,p_relationship,p_note,p_choice='rental');
  update private.property_access_requests set occupancy_choice=p_choice where id=v_request;
  return v_request;
end $$;
revoke all on function private.set_property_occupancy_choice(uuid,text),private.request_property_with_occupancy(uuid,text,text,text) from public,anon;
grant execute on function private.set_property_occupancy_choice(uuid,text),private.request_property_with_occupancy(uuid,text,text,text) to authenticated;
create function public.set_property_occupancy_choice(p_request_id uuid,p_occupancy_choice text) returns void
language sql security invoker set search_path='' as $$select private.set_property_occupancy_choice(p_request_id,p_occupancy_choice);$$;
create function public.request_property_verification_with_occupancy(p_property_id uuid,p_relationship text,p_note text,p_occupancy_choice text) returns uuid
language sql security invoker set search_path='' as $$select private.request_property_with_occupancy(p_property_id,p_relationship,p_note,p_occupancy_choice);$$;
revoke all on function public.set_property_occupancy_choice(uuid,text),public.request_property_verification_with_occupancy(uuid,text,text,text) from public,anon;
grant execute on function public.set_property_occupancy_choice(uuid,text),public.request_property_verification_with_occupancy(uuid,text,text,text) to authenticated;

create or replace function private.save_member_profile(p_details jsonb,p_consent boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_first text:=trim(coalesce(p_details->>'first_name','')); v_last text:=trim(coalesce(p_details->>'last_name',''));
  v_email text; v_notification text; v_old_email text; v_old boolean; v_changed boolean; v_consent boolean:=coalesce(p_consent,false);
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  if length(v_first) not between 1 and 80 or length(v_last) not between 1 and 80 or length(v_first||' '||v_last)>160 then raise exception 'Enter your first and last names (up to 80 characters each)'; end if;
  -- Serialize preference changes without accepting client-supplied timestamps.
  perform 1 from auth.users where id=auth.uid() for update;
  select email into v_email from auth.users where id=auth.uid();
  v_notification:=trim(coalesce(p_details->>'notification_email',(select nullif(notification_email,'') from public.portal_account_details where user_id=auth.uid()),v_email));
  if length(v_notification)>254 or v_notification !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email for HOA notifications'; end if;
  select consented,email_at_consent into v_old,v_old_email from private.email_notice_preferences where user_id=auth.uid();
  v_changed:=v_old is distinct from v_consent or (v_consent and v_old_email is distinct from v_notification);
  insert into public.portal_account_details(user_id,display_name,first_name,last_name,notification_email,phone,mailing_street,mailing_unit,mailing_city,mailing_state,mailing_postal_code,mailing_country,mailing_address)
    values(auth.uid(),v_first||' '||v_last,v_first,v_last,v_notification,trim(coalesce(p_details->>'phone','')),
      trim(coalesce(p_details->>'mailing_street','')),trim(coalesce(p_details->>'mailing_unit','')),trim(coalesce(p_details->>'mailing_city','')),
      trim(coalesce(p_details->>'mailing_state','')),trim(coalesce(p_details->>'mailing_postal_code','')),trim(coalesce(p_details->>'mailing_country','US')),
      left(concat_ws(', ',nullif(trim(p_details->>'mailing_street'),''),nullif(trim(p_details->>'mailing_unit'),''),
        nullif(trim(p_details->>'mailing_city'),''),nullif(trim(p_details->>'mailing_state'),''),nullif(trim(p_details->>'mailing_postal_code'),''),nullif(trim(p_details->>'mailing_country'),'')),500))
    on conflict(user_id) do update set display_name=excluded.display_name,first_name=excluded.first_name,last_name=excluded.last_name,notification_email=excluded.notification_email,phone=excluded.phone,
      mailing_street=excluded.mailing_street,mailing_unit=excluded.mailing_unit,mailing_city=excluded.mailing_city,mailing_state=excluded.mailing_state,
      mailing_postal_code=excluded.mailing_postal_code,mailing_country=excluded.mailing_country,mailing_address=excluded.mailing_address;
  if v_changed then
    insert into private.email_notice_preferences(user_id,consented,consented_at,email_at_consent)
      values(auth.uid(),v_consent,case when v_consent then now() end,case when v_consent then v_notification end)
      on conflict(user_id) do update set consented=excluded.consented,consented_at=excluded.consented_at,email_at_consent=excluded.email_at_consent,updated_at=now();
    insert into private.email_notice_history(user_id,consented,email,statement)
      select auth.uid(),v_consent,v_notification,statement from private.email_notice_preferences where user_id=auth.uid();
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
  return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'display_name',d.display_name,'email',a.email,'notification_email',coalesce(nullif(d.notification_email,''),a.email),'occupancy_choice',r.occupancy_choice,'phone',d.phone,'mailing_address',d.mailing_address,'email_notice_consent',coalesce(n.consented,false),'email_notice_consented_at',n.consented_at,'lot_number',p.lot_number,'street_address',p.street_address,'status',r.status,'relationship',r.requested_relationship,'request_note',r.request_note,'review_note',r.review_note,'submitted_at',r.submitted_at) order by r.submitted_at desc)
    from private.property_access_requests r join public.properties p on p.id=r.property_id join auth.users a on a.id=r.user_id left join public.portal_account_details d on d.user_id=r.user_id left join private.email_notice_preferences n on n.user_id=r.user_id),'[]'::jsonb),
    'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'occupancy_status',p.occupancy_status,
      'verified_contacts',coalesce((select jsonb_agg(jsonb_build_object('display_name',c.display_name,'relationship',pc.relationship)) from public.property_contacts pc join public.contacts c on c.id=pc.contact_id where pc.property_id=p.id and pc.ownership_verified_at is not null and pc.started_on<=current_date and (pc.ended_on is null or pc.ended_on>current_date)),'[]'::jsonb),
      'historical_contacts',coalesce((select jsonb_agg(jsonb_build_object('display_name',c.display_name,'verification','Historical / unverified')) from public.legacy_contact_links_staging s join public.contacts c on c.id=s.contact_id where s.lot_number=p.lot_number),'[]'::jsonb)) order by p.lot_number) from public.properties p),'[]'::jsonb));
end $$;

create or replace function private.rental_workspace(p_staff boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() or (p_staff and not private.staff_authorized()) then raise exception 'Authorized account required' using errcode='42501'; end if;
  return jsonb_build_object('properties',coalesce((select jsonb_agg(jsonb_build_object(
    'request_id',r.id,'property_id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'request_status',r.status,'occupancy_choice',r.occupancy_choice,
    'display_name',case when p_staff then profile.display_name else null end,'is_rental',private.rental_required(r.id),
    'admin_marked_rental',p.occupancy_status='rental','rental_complete',private.rental_complete(r.id),
    'files',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'agreement_id',a.id,'bucket_id',d.storage_bucket,'storage_path',d.storage_path,
      'original_filename',d.original_filename,'ready',d.ready,'reserved_bytes',d.reserved_bytes,'lease_start',a.lease_start,'lease_end',a.lease_end,
      'agreement_status',a.agreement_status,'review_note',a.notes,'can_remove',private.rental_file_permission(d.id,true)) order by a.lease_start desc,a.id)
      from public.rental_agreements a join public.property_documents d on d.id=a.document_id where a.property_id=r.property_id
        and a.portal_request_id is not null and private.rental_file_permission(d.id,false)),'[]'::jsonb)) order by p.lot_number,r.id)
    from private.property_access_requests r join public.properties p on p.id=r.property_id
    left join public.portal_account_details profile on profile.user_id=r.user_id
    where (p_staff and (r.status in ('pending','approved') or exists(select 1 from public.rental_agreements old where old.portal_request_id=r.id)))
      or (not p_staff and r.user_id=auth.uid() and r.status in ('pending','approved'))),'[]'::jsonb));
end $$;

notify pgrst,'reload schema';
