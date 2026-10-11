-- Plum Creek HOA: rental and occupancy features (safe to run after the initial schema)
-- Does not import or modify homeowner names, emails, or financial balances.
-- No browser read/write access is granted by this migration.

alter table public.properties
  add column if not exists occupancy_status text not null default 'unknown',
  add column if not exists occupancy_updated_at timestamptz;

-- Only one mutually exclusive occupancy status per property.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_occupancy_status_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_occupancy_status_check
      check (occupancy_status in ('unknown','owner_occupied','rental','vacant'));
  end if;
end $$;

-- All uploads are kept in a private bucket. Paths are references, not public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hoa-private-documents','hoa-private-documents',false,20971520,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false;

create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  category text not null check (category in ('lease','rental_application','ownership','acc','other')),
  document_title text not null,
  storage_bucket text not null default 'hoa-private-documents'
    check (storage_bucket = 'hoa-private-documents'),
  storage_path text not null unique,
  original_filename text,
  content_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  notes text
);
create index if not exists property_documents_property_idx on public.property_documents(property_id);

-- Multiple leases across time are supported; each lease can have a private uploaded file.
create table if not exists public.rental_agreements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  document_id uuid unique references public.property_documents(id) on delete set null,
  agreement_status text not null default 'not_submitted'
    check (agreement_status in ('not_submitted','pending_review','received','expired','rejected')),
  lease_start date,
  lease_end date,
  landlord_contact_id uuid references public.contacts(id) on delete set null,
  property_manager_contact_id uuid references public.contacts(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lease_end is null or lease_start is null or lease_end >= lease_start)
);
create index if not exists rental_agreements_property_idx on public.rental_agreements(property_id);
create index if not exists rental_agreements_end_idx on public.rental_agreements(lease_end);

create table if not exists public.property_occupancy_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  occupancy_status text not null
    check (occupancy_status in ('unknown','owner_occupied','rental','vacant')),
  effective_from date,
  effective_to date,
  changed_by uuid references auth.users(id) on delete set null,
  notes text,
  recorded_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
create index if not exists property_occupancy_history_property_idx
  on public.property_occupancy_history(property_id);

alter table public.property_documents enable row level security;
alter table public.rental_agreements enable row level security;
alter table public.property_occupancy_history enable row level security;

-- Intentionally no RLS policies for these tables or storage.objects.
-- Secure upload/download must be implemented using authorized server-side endpoints
-- or carefully designed and tested storage + table RLS policies. Never expose a
-- service_role / secret key in frontend JavaScript.
-- Do not store leases until a retention/access policy is approved by the HOA.
