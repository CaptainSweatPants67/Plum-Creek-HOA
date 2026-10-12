-- Purpose-based HOA contacts stay separate from historical homeowner contacts.
create table public.hoa_service_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 160),
  purpose text not null check(length(trim(purpose)) between 1 and 100),
  contact_person text not null default '' check(length(contact_person)<=160),
  email text not null default '' check(length(email)<=254),
  phone text not null default '' check(length(phone)<=60),
  website text not null default '' check(length(website)<=500 and (website='' or website ~ '^https?://')),
  address text not null default '' check(length(address)<=500),
  notes text not null default '' check(length(notes)<=5000),
  archived boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index hoa_service_contacts_creator_idx on public.hoa_service_contacts(created_by);
create index hoa_service_contacts_purpose_idx on public.hoa_service_contacts(purpose);

create table public.hoa_publications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('minutes','announcement')),
  title text not null check(length(trim(title)) between 1 and 180),
  publication_date date not null default current_date,
  body text not null default '' check(length(body)<=20000),
  published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index hoa_publications_creator_idx on public.hoa_publications(created_by);
create index hoa_publications_date_idx on public.hoa_publications(publication_date desc);

create table public.hoa_library_files (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.hoa_service_contacts(id) on delete restrict,
  publication_id uuid references public.hoa_publications(id) on delete restrict,
  bucket_id text not null check(bucket_id in ('hoa-contracts','hoa-member-publications')),
  storage_path text not null,
  title text not null check(length(trim(title)) between 1 and 180),
  original_filename text not null check(length(original_filename) between 1 and 255),
  expected_bytes bigint not null check(expected_bytes>0),
  reserved_bytes bigint not null check(reserved_bytes>0),
  ready boolean not null default false,
  starts_on date, ends_on date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(bucket_id,storage_path),
  check((contact_id is not null and publication_id is null and bucket_id='hoa-contracts' and expected_bytes<=2000000 and reserved_bytes<=2000000)
     or (contact_id is null and publication_id is not null and bucket_id='hoa-member-publications' and expected_bytes<=1000000 and reserved_bytes<=1000000)),
  check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
create index hoa_library_files_contact_idx on public.hoa_library_files(contact_id);
create index hoa_library_files_publication_idx on public.hoa_library_files(publication_id);
create index hoa_library_files_creator_idx on public.hoa_library_files(created_by);
alter table public.hoa_service_contacts enable row level security;
alter table public.hoa_publications enable row level security;
alter table public.hoa_library_files enable row level security;
revoke all on public.hoa_service_contacts, public.hoa_publications, public.hoa_library_files from public,anon,authenticated;
grant select,insert,update on public.hoa_service_contacts,public.hoa_publications to authenticated;
grant select on public.hoa_library_files to authenticated;

-- Current Director/Officer appointment and MFA, never editable user metadata.
create function private.hoa_records_staff() returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((private.portal_flags()->>'has_mfa')::boolean,false) and
    (coalesce((private.portal_flags()->>'is_director')::boolean,false) or coalesce((private.portal_flags()->>'is_officer')::boolean,false));
$$;
revoke all on function private.hoa_records_staff() from public,anon;
grant execute on function private.hoa_records_staff() to authenticated;
create policy hoa_contacts_read on public.hoa_service_contacts for select to authenticated using((select private.hoa_records_staff()));
create policy hoa_contacts_insert on public.hoa_service_contacts for insert to authenticated with check((select private.hoa_records_staff()));
create policy hoa_contacts_update on public.hoa_service_contacts for update to authenticated using((select private.hoa_records_staff())) with check((select private.hoa_records_staff()));
create policy hoa_publications_read on public.hoa_publications for select to authenticated using((published and (select private.confirmed_account())) or (select private.hoa_records_staff()));
create policy hoa_publications_insert on public.hoa_publications for insert to authenticated with check((select private.hoa_records_staff()));
create policy hoa_publications_update on public.hoa_publications for update to authenticated using((select private.hoa_records_staff())) with check((select private.hoa_records_staff()));

create function private.stamp_hoa_record() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.created_by:=auth.uid(); new.created_at:=now();
  else new.id:=old.id; new.created_by:=old.created_by; new.created_at:=old.created_at; end if;
  new.updated_at:=now(); return new;
end $$;
revoke all on function private.stamp_hoa_record() from public,anon,authenticated;
create trigger stamp_hoa_contact before insert or update on public.hoa_service_contacts for each row execute function private.stamp_hoa_record();
create trigger stamp_hoa_publication before insert or update on public.hoa_publications for each row execute function private.stamp_hoa_record();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('hoa-contracts','hoa-contracts',false,2000000,array['application/pdf']),
  ('hoa-member-publications','hoa-member-publications',false,1000000,array['application/pdf']);

-- Security-definer lookups are private, authorized and pinned to an empty path.
create function private.hoa_file_readable(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.hoa_library_files f
    where f.bucket_id=p_bucket and f.storage_path=p_path and (
      private.hoa_records_staff() or (f.ready and f.publication_id is not null and private.confirmed_account()
        and exists(select 1 from public.hoa_publications p where p.id=f.publication_id and p.published))));
$$;
create function private.hoa_file_uploadable(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and private.hoa_records_staff() and exists(select 1 from public.hoa_library_files f
    where f.bucket_id=p_bucket and f.storage_path=p_path and not f.ready and f.created_by=auth.uid());
$$;
revoke all on function private.hoa_file_readable(text,text),private.hoa_file_uploadable(text,text) from public,anon;
grant execute on function private.hoa_file_readable(text,text),private.hoa_file_uploadable(text,text) to authenticated;
create policy hoa_files_read on public.hoa_library_files for select to authenticated using(private.hoa_file_readable(bucket_id,storage_path));
create policy hoa_library_storage_read on storage.objects for select to authenticated
using(bucket_id in ('hoa-contracts','hoa-member-publications') and private.hoa_file_readable(bucket_id,name));
create policy hoa_library_storage_insert on storage.objects for insert to authenticated
with check(bucket_id in ('hoa-contracts','hoa-member-publications') and private.hoa_file_uploadable(bucket_id,name)
  and lower(name) like '%.pdf' and (metadata is null or (
    coalesce(metadata->>'mimetype','application/pdf')='application/pdf' and
    coalesce((metadata->>'size')::bigint,0)<=case when bucket_id='hoa-contracts' then 2000000 else 1000000 end)));
create policy hoa_library_storage_delete on storage.objects for delete to authenticated
using(bucket_id in ('hoa-contracts','hoa-member-publications') and (select private.hoa_records_staff()));
-- No UPDATE policy: file replacement needs a new, budgeted upload.

create function private.reserve_hoa_file(p_contact_id uuid,p_publication_id uuid,p_title text,p_filename text,p_size bigint,p_starts_on date,p_ends_on date)
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
  select coalesce(sum(f.reserved_bytes),0) into v_pending from public.hoa_library_files f where not f.ready
    and not exists(select 1 from storage.objects o where o.bucket_id=f.bucket_id and o.name=f.storage_path);
  if v_project+v_pending+v_limit>800000000 then raise exception 'Project storage is near its free allowance. Remove unneeded files first.'; end if;
  v_file.id:=gen_random_uuid();
  insert into public.hoa_library_files(id,contact_id,publication_id,bucket_id,storage_path,title,original_filename,expected_bytes,reserved_bytes,starts_on,ends_on,created_by)
  values(v_file.id,p_contact_id,p_publication_id,case when p_contact_id is not null then 'hoa-contracts' else 'hoa-member-publications' end,
    coalesce(p_contact_id,p_publication_id)::text||'/'||v_file.id::text||'.pdf',trim(p_title),p_filename,p_size,v_limit,p_starts_on,p_ends_on,auth.uid()) returning * into v_file;
  return v_file;
end $$;
create function private.finish_hoa_file(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_file public.hoa_library_files; v_metadata jsonb; v_bytes bigint;
begin
  if auth.uid() is null or not private.hoa_records_staff() then raise exception 'Current Director or Officer with MFA required' using errcode='42501'; end if;
  select * into v_file from public.hoa_library_files where id=p_id for update;
  if not found then raise exception 'Upload record not found'; end if;
  if v_file.created_by<>auth.uid() then raise exception 'Only the uploader can complete this upload' using errcode='42501'; end if;
  select metadata into v_metadata from storage.objects where bucket_id=v_file.bucket_id and name=v_file.storage_path;
  v_bytes:=(v_metadata->>'size')::bigint;
  if v_bytes is null or v_bytes<>v_file.expected_bytes or (v_metadata->>'mimetype') is distinct from 'application/pdf' then raise exception 'PDF upload is incomplete or does not match the selected file'; end if;
  update public.hoa_library_files set ready=true,reserved_bytes=v_bytes where id=p_id;
end $$;
create function private.remove_hoa_file(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_file public.hoa_library_files;
begin
  if auth.uid() is null or not private.hoa_records_staff() then raise exception 'Current Director or Officer with MFA required' using errcode='42501'; end if;
  select * into v_file from public.hoa_library_files where id=p_id for update;
  if not found then return; end if;
  if exists(select 1 from storage.objects where bucket_id=v_file.bucket_id and name=v_file.storage_path) then raise exception 'Remove the stored PDF through Storage before removing its record'; end if;
  delete from public.hoa_library_files where id=p_id;
end $$;
create function private.hoa_library_usage() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.hoa_records_staff() then raise exception 'Current Director or Officer with MFA required' using errcode='42501'; end if;
  return jsonb_build_object('budget_bytes',500000000,'allocated_bytes',(select coalesce(sum(reserved_bytes),0) from public.hoa_library_files),
    'stored_bytes',(select coalesce(sum(reserved_bytes),0) from public.hoa_library_files where ready),
    'pending_uploads',(select count(*) from public.hoa_library_files where not ready),
    'project_bytes',(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects));
end $$;
revoke all on function private.reserve_hoa_file(uuid,uuid,text,text,bigint,date,date),private.finish_hoa_file(uuid),private.remove_hoa_file(uuid),private.hoa_library_usage() from public,anon;
grant execute on function private.reserve_hoa_file(uuid,uuid,text,text,bigint,date,date),private.finish_hoa_file(uuid),private.remove_hoa_file(uuid),private.hoa_library_usage() to authenticated;
create function public.reserve_hoa_file(p_contact_id uuid,p_publication_id uuid,p_title text,p_filename text,p_size bigint,p_starts_on date default null,p_ends_on date default null)
returns public.hoa_library_files language sql security invoker set search_path='' as $$ select private.reserve_hoa_file(p_contact_id,p_publication_id,p_title,p_filename,p_size,p_starts_on,p_ends_on); $$;
create function public.finish_hoa_file(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.finish_hoa_file(p_id); $$;
create function public.remove_hoa_file(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.remove_hoa_file(p_id); $$;
create function public.get_hoa_library_usage() returns jsonb language sql stable security invoker set search_path='' as $$ select private.hoa_library_usage(); $$;
revoke all on function public.reserve_hoa_file(uuid,uuid,text,text,bigint,date,date),public.finish_hoa_file(uuid),public.remove_hoa_file(uuid),public.get_hoa_library_usage() from public,anon;
grant execute on function public.reserve_hoa_file(uuid,uuid,text,text,bigint,date,date),public.finish_hoa_file(uuid),public.remove_hoa_file(uuid),public.get_hoa_library_usage() to authenticated;
notify pgrst,'reload schema';
