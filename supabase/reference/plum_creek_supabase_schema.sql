-- Plum Creek HOA — initial schema for Supabase PostgreSQL
-- Run once in Supabase SQL Editor before importing plum_creek_properties.csv.
-- This establishes tables and restrictive Row Level Security defaults.
-- Do not load legacy names/emails/dues into current records without verification.

create extension if not exists pgcrypto;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  lot_number integer not null unique check (lot_number > 0),
  street_address text not null,
  city text not null default 'Gardner',
  state text not null default 'KS',
  postal_code text not null default '66030',
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  display_name text,
  email text,
  phone text,
  mailing_street text,
  mailing_city text,
  mailing_state text,
  mailing_postal_code text,
  contact_notes text,
  contact_verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Many-to-many association: two co-owners, owner of multiple lots,
-- historical owners, and non-owner contacts are all possible.
create table if not exists public.property_contacts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  relationship text not null check (relationship in ('owner','co_owner','resident','tenant','agent','other')),
  started_on date,
  ended_on date,
  ownership_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);
create index if not exists property_contacts_property_idx on public.property_contacts(property_id);
create index if not exists property_contacts_contact_idx on public.property_contacts(contact_id);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_id uuid unique references public.contacts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Roles are administrative assignments, NEVER self-assigned by a browser.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','board','treasurer','committee')),
  primary key(user_id,role)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  assessment_year integer not null check (assessment_year between 2000 and 2200),
  description text not null default 'Annual dues',
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  created_at timestamptz not null default now(),
  unique(property_id,assessment_year,description)
);
create index if not exists assessments_property_idx on public.assessments(property_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null,
  payment_method text,
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists payments_assessment_idx on public.payments(assessment_id);

-- Historical import is reference-only and should never confer login/voting rights.
create table if not exists public.legacy_property_reference (
  lot_number integer primary key references public.properties(lot_number) on delete restrict,
  legacy_full_name text,
  legacy_first text,
  legacy_spouse text,
  legacy_last text,
  legacy_non_payer text,
  legacy_owed text,
  legacy_mailing_street text,
  legacy_mailing_city_state_zip text,
  legacy_email text,
  verification_note text,
  imported_at timestamptz not null default now()
);

-- Enable RLS. With NO policies, browser clients cannot read/write any rows.
-- Safe starting point: add narrowly scoped policies after deciding exact roles.
alter table public.properties enable row level security;
alter table public.contacts enable row level security;
alter table public.property_contacts enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.assessments enable row level security;
alter table public.payments enable row level security;
alter table public.legacy_property_reference enable row level security;

-- Logged-in users can read ONLY their own profile-to-contact link.
create policy "users_read_own_profile"
  on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()));

-- Admin operations and verification should initially occur from trusted
-- administrative code or the Supabase dashboard, NEVER via a published
-- service-role key. Add homeowner/board policies after testing permissions.


-- ===== Rental and occupancy extension =====
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
