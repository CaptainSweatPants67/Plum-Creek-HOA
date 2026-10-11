-- Run AFTER existing Plum Creek schema and properties import.
-- CSV import sequence: plum_creek_contacts.csv -> public.contacts;
--                      plum_creek_contact_emails.csv -> public.contact_emails.
-- All contact data imported from this historical list is UNVERIFIED.
-- No ownership privileges or authentication accounts are created here.

create table if not exists public.contact_emails (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  lot_number integer references public.properties(lot_number) on delete restrict,
  display_name text,
  email text not null,
  email_type text not null check (email_type in ('primary','secondary')),
  verified boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  unique(contact_id,email)
);
create index if not exists contact_emails_contact_idx on public.contact_emails(contact_id);
alter table public.contact_emails enable row level security;
-- No browser policies are provided: private pending authorization design.

-- After importing plum_creek_contacts.csv, create unverified associations by lot:
-- Import the supplied link reference CSV into a temporary staging table, then run:
create table if not exists public.legacy_contact_links_staging (
  id uuid primary key,
  lot_number integer not null,
  contact_id uuid not null,
  relationship text,
  started_on date,
  ended_on date,
  ownership_verified_at timestamptz,
  notes text
);
alter table public.legacy_contact_links_staging enable row level security;

-- After importing plum_creek_contact_property_links_reference.csv into
-- legacy_contact_links_staging, execute this statement once:
-- insert into public.property_contacts
--     (id,property_id,contact_id,relationship,started_on,ended_on,ownership_verified_at,notes)
-- select s.id,p.id,s.contact_id,'other',s.started_on,s.ended_on,
--        s.ownership_verified_at,s.notes
-- from public.legacy_contact_links_staging s
-- join public.properties p on p.lot_number=s.lot_number
-- on conflict (id) do nothing;
