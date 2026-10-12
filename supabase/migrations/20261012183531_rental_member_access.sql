-- Rental proof is separate from ownership approval. Original reference tables
-- stay private; only narrowly authorized portal records gain access policies.
alter table private.property_access_requests add column declared_rental boolean not null default false;
alter table public.rental_agreements add column portal_request_id uuid references private.property_access_requests(id) on delete restrict;
create index rental_agreements_request_idx on public.rental_agreements(portal_request_id);
alter table public.property_documents add column expected_bytes bigint, add column reserved_bytes bigint not null default 0,
  add column ready boolean not null default false;
alter table public.property_documents add constraint portal_document_bytes_check check(
  reserved_bytes between 0 and 2000000 and (expected_bytes is null or expected_bytes between 1 and 2000000));
alter table public.property_documents drop constraint property_documents_storage_bucket_check;
alter table public.property_documents add constraint property_documents_storage_bucket_check
  check(storage_bucket in ('hoa-private-documents','hoa-rental-agreements'));
create index property_documents_uploader_idx on public.property_documents(uploaded_by);
revoke all on public.property_documents,public.rental_agreements from public,anon,authenticated;
grant select on public.property_documents,public.rental_agreements to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hoa-rental-agreements','hoa-rental-agreements',false,2000000,array['application/pdf']);

create function private.hoa_today() returns date language sql stable security invoker set search_path='' as $$
  select (now() at time zone 'America/Chicago')::date;
$$;
revoke all on function private.hoa_today() from public,anon,authenticated;

create function private.verified_property_request(p_request uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.property_access_requests r
    join public.property_contacts pc on pc.id=r.property_contact_id
    join public.user_profiles u on u.user_id=r.user_id and u.contact_id=pc.contact_id
    where r.id=p_request and r.status='approved' and pc.ownership_verified_at is not null
      and pc.relationship in ('owner','co_owner') and pc.started_on<=current_date and (pc.ended_on is null or pc.ended_on>current_date));
$$;
create function private.rental_required(p_request uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select r.declared_rental or p.occupancy_status='rental' from private.property_access_requests r
    join public.properties p on p.id=r.property_id where r.id=p_request),false);
$$;
create function private.rental_complete(p_request uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select not private.rental_required(p_request) or exists(
    select 1 from private.property_access_requests r join public.rental_agreements a on a.property_id=r.property_id
    join public.property_documents d on d.id=a.document_id
    where r.id=p_request and a.agreement_status='received' and d.ready and d.storage_bucket='hoa-rental-agreements'
      and private.hoa_today() between a.lease_start and a.lease_end
      and (a.portal_request_id=r.id or (private.verified_property_request(r.id) and private.verified_property_request(a.portal_request_id)))
      and exists(select 1 from storage.objects o where o.bucket_id=d.storage_bucket and o.name=d.storage_path
        and (o.metadata->>'size')::bigint=d.expected_bytes and o.metadata->>'mimetype'='application/pdf'));
$$;
revoke all on function private.verified_property_request(uuid),private.rental_required(uuid),private.rental_complete(uuid) from public,anon,authenticated;

create function private.can_read_member_information() returns boolean
language sql stable security definer set search_path='' as $$
  select private.confirmed_account() and not exists(select 1 from private.property_access_requests r
    where r.user_id=auth.uid() and r.status in ('pending','approved') and not private.rental_complete(r.id));
$$;
revoke all on function private.can_read_member_information() from public,anon;
grant execute on function private.can_read_member_information() to authenticated;
create function private.member_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  return jsonb_build_object('allowed',private.can_read_member_information(),'rental_requirements',coalesce((
    select jsonb_agg(jsonb_build_object('request_id',r.id,'lot_number',p.lot_number,'street_address',p.street_address))
    from private.property_access_requests r join public.properties p on p.id=r.property_id
    where r.user_id=auth.uid() and r.status in ('pending','approved') and not private.rental_complete(r.id)),'[]'::jsonb));
end $$;
revoke all on function private.member_access() from public,anon;
grant execute on function private.member_access() to authenticated;
create function public.get_member_access() returns jsonb language sql stable security invoker set search_path='' as $$ select private.member_access(); $$;
revoke all on function public.get_member_access() from public,anon;
grant execute on function public.get_member_access() to authenticated;

create function private.rental_file_permission(p_document uuid,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
  select private.confirmed_account() and exists(select 1 from public.property_documents d
    join public.rental_agreements a on a.document_id=d.id join private.property_access_requests r on r.id=a.portal_request_id
    where d.id=p_document and d.storage_bucket='hoa-rental-agreements' and d.category='lease' and (
      private.staff_authorized() or (r.user_id=auth.uid() and r.status in ('pending','approved') and (not p_write or d.uploaded_by=auth.uid()))
      or (not p_write and d.ready and private.verified_property_request(r.id) and exists(
        select 1 from private.property_access_requests own where own.user_id=auth.uid() and own.property_id=r.property_id and private.verified_property_request(own.id)))));
$$;
create function private.rental_storage_permission(p_path text,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.property_documents d where d.storage_bucket='hoa-rental-agreements' and d.storage_path=p_path
    and private.rental_file_permission(d.id,p_operation <> 'read')
    and (p_operation <> 'upload' or (not d.ready and d.uploaded_by=auth.uid())));
$$;
revoke all on function private.rental_file_permission(uuid,boolean),private.rental_storage_permission(text,text) from public,anon;
grant execute on function private.rental_file_permission(uuid,boolean),private.rental_storage_permission(text,text) to authenticated;
create policy portal_rental_documents_read on public.property_documents for select to authenticated using(private.rental_file_permission(id,false));
create policy portal_rental_agreements_read on public.rental_agreements for select to authenticated using(private.rental_file_permission(document_id,false));
create policy portal_rental_storage_read on storage.objects for select to authenticated
  using(bucket_id='hoa-rental-agreements' and private.rental_storage_permission(name,'read'));
create policy portal_rental_storage_insert on storage.objects for insert to authenticated
  with check(bucket_id='hoa-rental-agreements' and private.rental_storage_permission(name,'upload') and lower(name) like '%.pdf'
    and (metadata is null or (coalesce(metadata->>'mimetype','application/pdf')='application/pdf' and coalesce((metadata->>'size')::bigint,0)<=2000000)));
create policy portal_rental_storage_delete on storage.objects for delete to authenticated
  using(bucket_id='hoa-rental-agreements' and private.rental_storage_permission(name,'delete'));
-- No UPDATE/upsert: immutable PDFs need a new budgeted reservation.

create function private.pending_storage_bytes() returns bigint language sql stable security definer set search_path='' as $$
  select coalesce((select sum(greatest(f.reserved_bytes-coalesce((o.metadata->>'size')::bigint,0),0)) from public.hoa_library_files f
    left join storage.objects o on o.bucket_id=f.bucket_id and o.name=f.storage_path where not f.ready),0)
    + coalesce((select sum(greatest(d.reserved_bytes-coalesce((o.metadata->>'size')::bigint,0),0)) from public.property_documents d
      left join storage.objects o on o.bucket_id=d.storage_bucket and o.name=d.storage_path where d.storage_bucket='hoa-rental-agreements' and not d.ready),0);
$$;
revoke all on function private.pending_storage_bytes() from public,anon,authenticated;

create function private.request_property_verification(p_property uuid,p_relationship text,p_note text,p_rental boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  v_id:=private.submit_property_request(p_property,p_relationship,p_note);
  update private.property_access_requests set declared_rental=coalesce(p_rental,false) where id=v_id;
  return v_id;
end $$;
create function private.set_property_rental(p_request uuid,p_rental boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_request private.property_access_requests; v_previous text;
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  select * into v_request from private.property_access_requests where id=p_request and user_id=auth.uid() and status in ('pending','approved') for update;
  if not found then raise exception 'Choose your own active property request' using errcode='42501'; end if;
  select occupancy_status into v_previous from public.properties where id=v_request.property_id for update;
  if not coalesce(p_rental,false) and v_previous='rental' then raise exception 'The HOA has marked this home as a rental. Contact leadership to correct its occupancy status.'; end if;
  update private.property_access_requests set declared_rental=coalesce(p_rental,false) where id=p_request;
  if p_rental and private.verified_property_request(p_request) and v_previous<>'rental' then
    update public.properties set occupancy_status='rental',occupancy_updated_at=now() where id=v_request.property_id;
    update public.property_occupancy_history set effective_to=current_date where property_id=v_request.property_id and effective_to is null;
    insert into public.property_occupancy_history(property_id,occupancy_status,effective_from,changed_by,notes)
      values(v_request.property_id,'rental',current_date,auth.uid(),'Verified homeowner reported rental occupancy.');
  end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'rental_occupancy_reported',jsonb_build_object('request_id',p_request,'rental',p_rental));
end $$;

create function private.reserve_rental_agreement(p_request uuid,p_filename text,p_size bigint,p_start date,p_end date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_request private.property_access_requests; v_doc public.property_documents; v_lease uuid; v_budget bigint; v_project bigint;
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  select * into v_request from private.property_access_requests where id=p_request and user_id=auth.uid() and status in ('pending','approved') for update;
  if not found then raise exception 'Choose your own active property request' using errcode='42501'; end if;
  if not private.rental_required(p_request) then raise exception 'Mark this home as a rental first'; end if;
  if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start then raise exception 'Both lease dates are required; the end date must be on or after the start date'; end if;
  if p_size is null or p_size<1 or p_size>2000000 or lower(coalesce(p_filename,'')) not like '%.pdf' or length(p_filename)>255 then raise exception 'Choose a PDF no larger than 2 MB'; end if;
  if (select count(*) from public.rental_agreements where portal_request_id=p_request)>=3 then raise exception 'Keep at most three lease PDFs per property request. Remove an unneeded older PDF before uploading.'; end if;
  if exists(select 1 from public.rental_agreements a join public.property_documents d on d.id=a.document_id where a.portal_request_id=p_request and not d.ready) then raise exception 'Remove the incomplete lease upload before trying again.'; end if;
  perform pg_advisory_xact_lock(61011214844);
  select coalesce(sum(reserved_bytes),0) into v_budget from public.property_documents where storage_bucket='hoa-rental-agreements';
  if v_budget+2000000>250000000 then raise exception 'The 250 MB rental document budget is full. Contact HOA leadership.'; end if;
  select coalesce(sum((metadata->>'size')::bigint),0) into v_project from storage.objects;
  if v_project+private.pending_storage_bytes()+2000000>800000000 then raise exception 'Project storage is near its free allowance. Contact HOA leadership.'; end if;
  v_doc.id:=gen_random_uuid();
  insert into public.property_documents(id,property_id,category,document_title,storage_bucket,storage_path,original_filename,content_type,uploaded_by,expected_bytes,reserved_bytes)
    values(v_doc.id,v_request.property_id,'lease','Tenant rental agreement','hoa-rental-agreements',v_request.property_id::text||'/'||v_doc.id::text||'.pdf',p_filename,'application/pdf',auth.uid(),p_size,2000000) returning * into v_doc;
  insert into public.rental_agreements(property_id,document_id,portal_request_id,agreement_status,lease_start,lease_end)
    values(v_request.property_id,v_doc.id,p_request,'not_submitted',p_start,p_end) returning id into v_lease;
  return jsonb_build_object('id',v_doc.id,'agreement_id',v_lease,'bucket_id',v_doc.storage_bucket,'storage_path',v_doc.storage_path,'original_filename',v_doc.original_filename);
end $$;
create function private.finish_rental_agreement(p_document uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_doc public.property_documents; v_metadata jsonb;
begin
  if not private.rental_file_permission(p_document,true) then raise exception 'Rental upload access required' using errcode='42501'; end if;
  select * into v_doc from public.property_documents where id=p_document for update;
  if v_doc.uploaded_by<>auth.uid() then raise exception 'Only the uploader can complete this lease' using errcode='42501'; end if;
  if v_doc.ready then return; end if;
  select metadata into v_metadata from storage.objects where bucket_id=v_doc.storage_bucket and name=v_doc.storage_path;
  if (v_metadata->>'size')::bigint is distinct from v_doc.expected_bytes or v_metadata->>'mimetype' is distinct from 'application/pdf' then raise exception 'Lease PDF upload is incomplete or does not match the selected file'; end if;
  update public.property_documents set ready=true,reserved_bytes=(v_metadata->>'size')::bigint where id=p_document;
  update public.rental_agreements set agreement_status='received',updated_at=now() where document_id=p_document;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'rental_agreement_received',jsonb_build_object('document_id',p_document));
end $$;
create function private.remove_rental_agreement(p_document uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_doc public.property_documents;
begin
  if not private.rental_file_permission(p_document,true) then raise exception 'Rental document removal access required' using errcode='42501'; end if;
  select * into v_doc from public.property_documents where id=p_document for update;
  if exists(select 1 from storage.objects where bucket_id=v_doc.storage_bucket and name=v_doc.storage_path) then raise exception 'Remove the stored PDF through Storage first'; end if;
  delete from public.rental_agreements where document_id=p_document;
  delete from public.property_documents where id=p_document;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'rental_agreement_removed',jsonb_build_object('document_id',p_document));
end $$;
create function private.reject_rental_agreement(p_agreement uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'Leadership login with MFA required' using errcode='42501'; end if;
  if length(trim(coalesce(p_note,''))) not between 1 and 1000 then raise exception 'Provide the reason this agreement must be replaced'; end if;
  update public.rental_agreements set agreement_status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),notes=trim(p_note),updated_at=now()
    where id=p_agreement and portal_request_id is not null;
  if not found then raise exception 'Portal rental agreement not found'; end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'rental_agreement_rejected',jsonb_build_object('agreement_id',p_agreement));
end $$;

create function private.rental_workspace(p_staff boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() or (p_staff and not private.staff_authorized()) then raise exception 'Authorized account required' using errcode='42501'; end if;
  return jsonb_build_object('properties',coalesce((select jsonb_agg(jsonb_build_object(
    'request_id',r.id,'property_id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'request_status',r.status,
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

revoke all on function private.request_property_verification(uuid,text,text,boolean),private.set_property_rental(uuid,boolean),
  private.reserve_rental_agreement(uuid,text,bigint,date,date),private.finish_rental_agreement(uuid),private.remove_rental_agreement(uuid),
  private.reject_rental_agreement(uuid,text),private.rental_workspace(boolean) from public,anon;
grant execute on function private.request_property_verification(uuid,text,text,boolean),private.set_property_rental(uuid,boolean),
  private.reserve_rental_agreement(uuid,text,bigint,date,date),private.finish_rental_agreement(uuid),private.remove_rental_agreement(uuid),
  private.reject_rental_agreement(uuid,text),private.rental_workspace(boolean) to authenticated;
create function public.request_property_verification(p_property_id uuid,p_relationship text,p_note text,p_is_rental boolean default false) returns uuid
language sql security invoker set search_path='' as $$ select private.request_property_verification(p_property_id,p_relationship,p_note,p_is_rental); $$;
create function public.set_property_rental(p_request_id uuid,p_is_rental boolean) returns void
language sql security invoker set search_path='' as $$ select private.set_property_rental(p_request_id,p_is_rental); $$;
create function public.reserve_rental_agreement(p_request_id uuid,p_filename text,p_size bigint,p_lease_start date,p_lease_end date) returns jsonb
language sql security invoker set search_path='' as $$ select private.reserve_rental_agreement(p_request_id,p_filename,p_size,p_lease_start,p_lease_end); $$;
create function public.finish_rental_agreement(p_document_id uuid) returns void language sql security invoker set search_path='' as $$ select private.finish_rental_agreement(p_document_id); $$;
create function public.remove_rental_agreement(p_document_id uuid) returns void language sql security invoker set search_path='' as $$ select private.remove_rental_agreement(p_document_id); $$;
create function public.reject_rental_agreement(p_agreement_id uuid,p_note text) returns void language sql security invoker set search_path='' as $$ select private.reject_rental_agreement(p_agreement_id,p_note); $$;
create function public.get_rental_workspace() returns jsonb language sql stable security invoker set search_path='' as $$ select private.rental_workspace(false); $$;
create function public.get_staff_rental_workspace() returns jsonb language sql stable security invoker set search_path='' as $$ select private.rental_workspace(true); $$;
revoke all on function public.request_property_verification(uuid,text,text,boolean),public.set_property_rental(uuid,boolean),
  public.reserve_rental_agreement(uuid,text,bigint,date,date),public.finish_rental_agreement(uuid),public.remove_rental_agreement(uuid),
  public.reject_rental_agreement(uuid,text),public.get_rental_workspace(),public.get_staff_rental_workspace() from public,anon;
grant execute on function public.request_property_verification(uuid,text,text,boolean),public.set_property_rental(uuid,boolean),
  public.reserve_rental_agreement(uuid,text,bigint,date,date),public.finish_rental_agreement(uuid),public.remove_rental_agreement(uuid),
  public.reject_rental_agreement(uuid,text),public.get_rental_workspace(),public.get_staff_rental_workspace() to authenticated;

-- Rental compliance also guards direct reads and authenticated Storage downloads.
drop policy hoa_publications_read on public.hoa_publications;
create policy hoa_publications_read on public.hoa_publications for select to authenticated
  using((published and (select private.can_read_member_information())) or (select private.hoa_records_staff()));
drop policy hoa_governance_member_read on storage.objects;
create policy hoa_governance_member_read on storage.objects for select to authenticated
  using(bucket_id='hoa-member-governance' and name='plum-creek-bylaws.pdf' and (select private.can_read_member_information()));
drop policy leadership_people_authenticated_read on public.leadership_people;
drop policy board_years_authenticated_read on public.board_member_years;
drop policy officer_years_authenticated_read on public.officer_member_years;
create policy leadership_people_authenticated_read on public.leadership_people for select to authenticated
  using((is_public and (select private.can_read_member_information())) or (select (private.portal_flags()->>'can_manage_leadership')::boolean));
create policy board_years_authenticated_read on public.board_member_years for select to authenticated
  using((published and (select private.can_read_member_information())) or (select (private.portal_flags()->>'can_manage_leadership')::boolean));
create policy officer_years_authenticated_read on public.officer_member_years for select to authenticated
  using((published and (select private.can_read_member_information())) or (select (private.portal_flags()->>'can_manage_leadership')::boolean));

create or replace function private.member_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  return jsonb_build_object(
    'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'occupancy_status',p.occupancy_status,'relationship',pc.relationship) order by p.lot_number)
      from private.property_access_requests r join public.properties p on p.id=r.property_id
      join public.property_contacts pc on pc.id=r.property_contact_id
      join public.user_profiles u on u.user_id=r.user_id and u.contact_id=pc.contact_id
      where r.user_id=auth.uid() and r.status='approved' and pc.ownership_verified_at is not null
      and private.rental_complete(r.id) and pc.relationship in ('owner','co_owner') and pc.started_on<=current_date and (pc.ended_on is null or pc.ended_on>current_date)),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'lot_number',p.lot_number,'street_address',p.street_address,'status',r.status,'relationship',r.requested_relationship,'submitted_at',r.submitted_at,'review_note',r.review_note) order by r.submitted_at desc)
      from private.property_access_requests r join public.properties p on p.id=r.property_id where r.user_id=auth.uid()),'[]'::jsonb));
end $$;

create or replace function private.property_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'lot_number',lot_number,'street_address',street_address,'is_rental',occupancy_status='rental') order by lot_number) from public.properties),'[]'::jsonb);
end $$;

create or replace function private.review_property_request(p_request_id uuid,p_decision text,p_note text) returns void
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
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_request_'||p_decision,jsonb_build_object('request_id',p_request_id,'property_id',v_request.property_id));
end $$;

create or replace function private.reserve_hoa_file(p_contact_id uuid,p_publication_id uuid,p_title text,p_filename text,p_size bigint,p_starts_on date,p_ends_on date)
returns public.hoa_library_files language plpgsql security definer set search_path='' as $$
declare v_file public.hoa_library_files; v_limit bigint; v_budget bigint; v_project bigint; v_pending bigint;
begin
  if auth.uid() is null or not private.hoa_records_staff() then raise exception 'Current Director or Officer with MFA required' using errcode='42501'; end if;
  if (p_contact_id is null)=(p_publication_id is null) then raise exception 'Choose one contact or publication'; end if;
  if p_contact_id is not null and not exists(select 1 from public.hoa_service_contacts where id=p_contact_id and not archived) then raise exception 'Choose an active contact'; end if;
  if p_publication_id is not null and not exists(select 1 from public.hoa_publications where id=p_publication_id) then raise exception 'Publication not found'; end if;
  v_limit:=case when p_contact_id is not null then 2000000 else 1000000 end;
  if p_size is null or p_size<1 or p_size>v_limit then raise exception 'PDF exceeds the allowed upload size'; end if;
  if lower(p_filename) not like '%.pdf' then raise exception 'Only PDF files are allowed'; end if;
  -- Serialize reservations, charge the full bucket limit until Storage confirms
  -- actual bytes. Small declared sizes cannot bypass the total library budget.
  perform pg_advisory_xact_lock(61011214844);
  select coalesce(sum(reserved_bytes),0) into v_budget from public.hoa_library_files;
  if v_budget+v_limit>500000000 then raise exception 'The 500 MB library budget is full. Remove unneeded PDFs before uploading.'; end if;
  select coalesce(sum((metadata->>'size')::bigint),0) into v_project from storage.objects;
  v_pending:=private.pending_storage_bytes();
  if v_project+v_pending+v_limit>800000000 then raise exception 'Project storage is near its free allowance. Remove unneeded files first.'; end if;
  v_file.id:=gen_random_uuid();
  insert into public.hoa_library_files(id,contact_id,publication_id,bucket_id,storage_path,title,original_filename,expected_bytes,reserved_bytes,starts_on,ends_on,created_by)
  values(v_file.id,p_contact_id,p_publication_id,case when p_contact_id is not null then 'hoa-contracts' else 'hoa-member-publications' end,
    coalesce(p_contact_id,p_publication_id)::text||'/'||v_file.id::text||'.pdf',trim(p_title),p_filename,p_size,v_limit,p_starts_on,p_ends_on,auth.uid()) returning * into v_file;
  return v_file;
end $$;

create or replace function private.hoa_file_readable(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.hoa_library_files f
    where f.bucket_id=p_bucket and f.storage_path=p_path and (
      private.hoa_records_staff() or (f.ready and f.publication_id is not null and private.can_read_member_information()
        and exists(select 1 from public.hoa_publications p where p.id=f.publication_id and p.published))));
$$;

create or replace function private.member_leadership_history() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  if not private.can_read_member_information() then raise exception 'Confirmed member account and current rental paperwork required' using errcode='42501'; end if;
  return jsonb_build_object(
    'board',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'person_id',b.person_id,'name',coalesce(p.display_name,'Vacant'),
      'year',b.service_year,'term',b.seat_label,'position',b.recorded_position,'kind',b.record_kind) order by b.service_year desc,b.seat_label,b.id)
      from public.board_member_years b left join public.leadership_people p on p.id=b.person_id
      where b.published and b.service_year <= extract(year from now() at time zone 'America/Chicago')
        and (b.person_id is null or p.is_public)),'[]'::jsonb),
    'officers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'person_id',o.person_id,'name',coalesce(p.display_name,'Vacant'),
      'year',o.service_year,'position',t.title,'position_code',t.code) order by o.service_year desc,t.sort_order,o.id)
      from public.officer_member_years o join public.officer_positions t on t.code=o.position_code
      left join public.leadership_people p on p.id=o.person_id
      where o.published and o.service_year <= extract(year from now() at time zone 'America/Chicago')
        and (o.person_id is null or p.is_public)),'[]'::jsonb));
end;
$$;
notify pgrst,'reload schema';
