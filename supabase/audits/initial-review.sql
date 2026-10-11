-- Read-only inventory for the INSTALLED Plum Creek schema, not an installation script.
-- Execute with trusted administrative access. Returns counts/catalogs, no contact details.
begin read only;

select 'properties' as entity, count(*) as rows from public.properties
union all select 'contacts', count(*) from public.contacts
union all select 'contact_emails', count(*) from public.contact_emails
union all select 'legacy_contact_links_staging', count(*) from public.legacy_contact_links_staging
union all select 'property_contacts', count(*) from public.property_contacts
union all select 'user_profiles', count(*) from public.user_profiles
union all select 'user_roles', count(*) from public.user_roles
union all select 'legacy_property_reference', count(*) from public.legacy_property_reference
union all select 'assessments', count(*) from public.assessments
union all select 'payments', count(*) from public.payments
union all select 'property_documents', count(*) from public.property_documents
union all select 'rental_agreements', count(*) from public.rental_agreements
union all select 'property_occupancy_history', count(*) from public.property_occupancy_history
union all select 'auth_users', count(*) from auth.users
union all select 'private_bucket_objects', count(*) from storage.objects
where bucket_id = 'hoa-private-documents';

select
  (select count(*) from public.contacts where contact_verified_at is not null) as verified_contacts,
  (select count(*) from public.contact_emails where verified) as verified_emails,
  (select count(*) from public.legacy_contact_links_staging
    where ownership_verified_at is not null or relationship is distinct from 'other') as non_provisional_staging_rows,
  (select count(*) from public.legacy_contact_links_staging s
    left join public.properties p on p.lot_number = s.lot_number
    left join public.contacts c on c.id = s.contact_id
    where p.id is null or c.id is null) as orphan_staging_rows,
  (select count(*) from generate_series(1,119) lot
    where not exists (select 1 from public.properties p where p.lot_number = lot)) as missing_lots,
  (select count(*) from public.properties where lot_number not between 1 and 119) as unexpected_lots;

select md5(string_agg(concat_ws('|', lot_number::text, street_address, city, state, postal_code), E'\n' order by lot_number))
  as property_import_fingerprint from public.properties;

select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

select c.relname as table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' order by c.relname, con.conname;

select n.nspname as schema_name, c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'));

select id, public, file_size_limit, allowed_mime_types from storage.buckets
where id = 'hoa-private-documents';

rollback;
