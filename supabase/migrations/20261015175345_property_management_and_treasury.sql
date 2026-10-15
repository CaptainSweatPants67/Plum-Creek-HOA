-- Private, append-only treasury. No historical amounts are inferred or imported.
create table private.treasury_years (
  year integer primary key check(year between 2000 and 2200),
  annual_dues numeric(12,2) not null check(annual_dues between 0 and 100000),
  late_fee numeric(12,2) not null check(late_fee between 0 and 100000),
  lien_fee numeric(12,2) not null check(lien_fee between 0 and 100000),
  interest_rate numeric(7,4) not null check(interest_rate between 0 and 100),
  due_date date not null, notes text not null default '' check(length(notes)<=1000),
  updated_at timestamptz not null default clock_timestamp(), updated_by uuid not null references auth.users(id),
  check(extract(year from due_date)=year)
);
create index treasury_years_actor_idx on private.treasury_years(updated_by);
create table private.treasury_entries (
  id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
  property_id uuid not null references public.properties(id), year integer not null references private.treasury_years(year),
  kind text not null check(kind in ('charge','payment')),
  category text not null check(category in ('dues','late_fee','lien_fee','interest','opening_balance')),
  amount numeric(12,2) not null check(amount>0 and amount<=1000000),
  effective_date date not null, payment_method text check(payment_method in ('check','cash','ach','bank_transfer','online','money_order','other')),
  reference text not null default '' check(length(reference)<=120), note text not null check(length(trim(note)) between 1 and 1000),
  created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
  voided_at timestamptz, voided_by uuid references auth.users(id), void_reason text,
  check((kind='payment' and payment_method is not null) or (kind='charge' and payment_method is null)),
  check((voided_at is null and voided_by is null and void_reason is null) or (voided_at is not null and voided_by is not null and length(trim(void_reason)) between 1 and 1000))
);
create unique index treasury_one_charge_idx on private.treasury_entries(property_id,year,category) where kind='charge' and voided_at is null;
create index treasury_entries_year_idx on private.treasury_entries(year,property_id);
create index treasury_entries_actor_idx on private.treasury_entries(created_by);
create index treasury_entries_void_actor_idx on private.treasury_entries(voided_by);
alter table private.treasury_years enable row level security;
alter table private.treasury_entries enable row level security;
revoke all on private.treasury_years,private.treasury_entries from public,anon,authenticated;

create function private.treasury_balance(p_property uuid,p_year integer,p_category text default null) returns numeric
language sql stable security definer set search_path='' as $$
  select coalesce(sum(case when kind='charge' then amount else -amount end),0) from private.treasury_entries
    where property_id=p_property and year=p_year and voided_at is null and (p_category is null or category=p_category);
$$;
create function private.property_debt(p_property uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('total_owed',coalesce(sum(balance),0),'delinquent',coalesce(sum(balance) filter(where due_date<private.hoa_today()),0))
  from (select year,category,sum(case when kind='charge' then amount else -amount end) balance,
    min(effective_date) filter(where kind='charge') due_date from private.treasury_entries
    where property_id=p_property and voided_at is null group by year,category) b;
$$;
revoke all on function private.treasury_balance(uuid,integer,text),private.property_debt(uuid) from public,anon,authenticated;

create function private.treasury_workspace(p_year integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  if p_year is null or p_year not between 2000 and 2200 then raise exception 'Choose a valid year'; end if;
  return jsonb_build_object('year',p_year,'settings',(select to_jsonb(y)-'updated_by' from private.treasury_years y where year=p_year),
    'years',coalesce((select jsonb_agg(year order by year desc) from private.treasury_years),'[]'::jsonb),
    'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,
      'total_owed',private.property_debt(p.id)->'total_owed','delinquent',private.property_debt(p.id)->'delinquent',
      'prior_balance',(select coalesce(sum(case when e.kind='charge' then e.amount else -e.amount end),0) from private.treasury_entries e where e.property_id=p.id and e.year<p_year and e.voided_at is null),
      'dues',coalesce(b.dues,0),'late_fee',coalesce(b.late_fee,0),'lien_fee',coalesce(b.lien_fee,0),'interest',coalesce(b.interest,0),'opening_balance',coalesce(b.opening_balance,0),
      'payments',coalesce(b.payments,0),'year_balance',private.treasury_balance(p.id,p_year),
      'dues_remaining',private.treasury_balance(p.id,p_year,'dues'),'assessed',coalesce(b.assessed,false),
      'entries',coalesce((select jsonb_agg(to_jsonb(e)-'created_by'-'voided_by'-'request_key' order by e.created_at desc,e.id)
        from private.treasury_entries e where e.property_id=p.id and e.year=p_year),'[]'::jsonb)) order by p.lot_number)
      from public.properties p left join lateral (select
        sum(amount) filter(where kind='charge' and category='dues') dues,
        sum(amount) filter(where kind='charge' and category='late_fee') late_fee,
        sum(amount) filter(where kind='charge' and category='lien_fee') lien_fee,
        sum(amount) filter(where kind='charge' and category='interest') interest,
        sum(amount) filter(where kind='charge' and category='opening_balance') opening_balance,
        sum(amount) filter(where kind='payment') payments,bool_or(kind='charge' and category='dues') assessed
        from private.treasury_entries where property_id=p.id and year=p_year and voided_at is null) b on true),'[]'::jsonb));
end $$;

-- Notice consent and delivery are separate from ownership and login verification.
create table private.hoa_email_suppressions(email text primary key,reason text not null check(reason in ('manual','bounced','complained','suppressed')),note text not null default '',updated_at timestamptz not null default now());
create table private.hoa_notices(
  id uuid primary key default gen_random_uuid(),request_key uuid not null unique,subject text not null check(length(trim(subject)) between 1 and 180),
  body text not null check(length(trim(body)) between 1 and 20000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index hoa_notices_actor_idx on private.hoa_notices(created_by);
create table private.hoa_notice_recipients(
  id uuid primary key default gen_random_uuid(),notice_id uuid not null references private.hoa_notices(id),email text not null,
  property_ids uuid[] not null,lot_numbers integer[] not null,
  status text not null default 'queued' check(status in ('queued','sending','accepted','delivered','delivery_delayed','bounced','complained','failed','suppressed','skipped','uncertain')),
  provider_id text unique,first_attempt_at timestamptz,last_attempt_at timestamptz,claim_until timestamptz,claim_token uuid,
  attempt_count integer not null default 0,status_at timestamptz not null default now(),error text not null default '',
  unique(notice_id,email)
);
create index hoa_notice_recipients_property_idx on private.hoa_notice_recipients using gin(property_ids);
create index hoa_notice_recipients_email_idx on private.hoa_notice_recipients(email,status_at desc);
create index hoa_notice_recipients_queue_idx on private.hoa_notice_recipients(notice_id,status,claim_until);
create table private.hoa_email_events(event_id text primary key,provider_id text not null,status text not null,event_at timestamptz not null,received_at timestamptz not null default now());
create index hoa_email_events_provider_idx on private.hoa_email_events(provider_id,event_at);
alter table private.hoa_email_suppressions enable row level security;
alter table private.hoa_notices enable row level security;
alter table private.hoa_notice_recipients enable row level security;
alter table private.hoa_email_events enable row level security;
revoke all on private.hoa_email_suppressions,private.hoa_notices,private.hoa_notice_recipients,private.hoa_email_events from public,anon,authenticated;

create function private.eligible_notice_recipients(p_properties uuid[] default null) returns table(email text,property_ids uuid[],lot_numbers integer[],names text[])
language sql stable security definer set search_path='' as $$
  select lower(trim(d.notification_email)),array_agg(distinct r.property_id),array_agg(distinct p.lot_number),array_agg(distinct d.display_name)
  from private.property_access_requests r join public.properties p on p.id=r.property_id
  join public.portal_account_details d on d.user_id=r.user_id join auth.users a on a.id=r.user_id
  join private.email_notice_preferences n on n.user_id=r.user_id
  where private.verified_property_request(r.id) and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
    and n.consented and lower(trim(n.email_at_consent))=lower(trim(d.notification_email))
    and d.notification_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and (p_properties is null or r.property_id=any(p_properties))
    and not exists(select 1 from private.hoa_email_suppressions s where s.email=lower(trim(d.notification_email)))
  group by lower(trim(d.notification_email));
$$;
revoke all on function private.eligible_notice_recipients(uuid[]) from public,anon,authenticated;
create function private.notice_recipients(p_properties uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.email) from private.eligible_notice_recipients(p_properties) r),'[]'::jsonb);
end $$;
create function private.create_hoa_notice(p_key uuid,p_subject text,p_body text,p_properties uuid[],p_expected text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_actual text[];
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  perform 1 from auth.users where id=auth.uid() for update;
  select id into v_id from private.hoa_notices where request_key=p_key and created_by=auth.uid();
  if found then return v_id; end if;
  select array_agg(email order by email) into v_actual from private.eligible_notice_recipients(p_properties);
  if v_actual is null then raise exception 'No current verified homeowners with notice consent are eligible'; end if;
  if v_actual is distinct from array(select distinct unnest(p_expected) order by 1) then raise exception 'The recipient list changed. Preview it again before preparing the notice.'; end if;
  if (select count(*) from private.hoa_notices where created_by=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Too many notices prepared. Try again later.'; end if;
  insert into private.hoa_notices(request_key,subject,body,created_by) values(p_key,trim(p_subject),trim(p_body),auth.uid()) returning id into v_id;
  insert into private.hoa_notice_recipients(notice_id,email,property_ids,lot_numbers)
    select v_id,email,property_ids,lot_numbers from private.eligible_notice_recipients(p_properties);
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'homeowner_notice_prepared',jsonb_build_object('notice_id',v_id,'recipients',cardinality(v_actual)));
  return v_id;
end $$;
create function private.notice_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(n)||jsonb_build_object('recipients',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'email',r.email,'lot_numbers',r.lot_numbers,'status',r.status,'status_at',r.status_at,'error',r.error) order by r.email)
    from private.hoa_notice_recipients r where r.notice_id=n.id),'[]'::jsonb)) order by n.created_at desc)
    from (select id,subject,body,created_at from private.hoa_notices order by created_at desc limit 30) n),'[]'::jsonb);
end $$;
create function private.set_hoa_email_block(p_email text,p_block boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email));
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  if p_block is null or length(trim(coalesce(p_note,''))) not between 1 and 1000 then raise exception 'Enter the communication-status reason'; end if;
  if not exists(select 1 from public.portal_account_details where lower(trim(notification_email))=v_email) then raise exception 'Select a registered notification email'; end if;
  if p_block then
    insert into private.hoa_email_suppressions(email,reason,note) values(v_email,'manual',trim(p_note)) on conflict(email) do nothing;
  else
    if exists(select 1 from private.hoa_email_suppressions where email=v_email and reason<>'manual') then raise exception 'Bounced or complained addresses remain blocked. The homeowner must supply a working notification address.'; end if;
    delete from private.hoa_email_suppressions where email=v_email and reason='manual';
  end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'homeowner_email_block_changed',jsonb_build_object('blocked',p_block));
end $$;

-- Only service_role may claim/update delivery. No client-provided recipient or email body reaches the sender.
create function private.claim_hoa_notice(p_notice uuid,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_r private.hoa_notice_recipients;v_token uuid;v_daily integer;
begin
  perform pg_advisory_xact_lock(47516,1);
  select count(*) into v_daily from private.hoa_notice_recipients where first_attempt_at>now()-interval '24 hours';
  update private.hoa_notice_recipients r set status='skipped',error='Ownership, consent or email eligibility changed.',status_at=now()
    where r.notice_id=p_notice and r.status in ('queued','sending') and (r.claim_until is null or r.claim_until<now())
      and not exists(select 1 from private.eligible_notice_recipients(r.property_ids) e where e.email=r.email);
  update private.hoa_notice_recipients set status='uncertain',error='Retry window expired; check Resend before any further send.',status_at=now()
    where notice_id=p_notice and status in ('queued','sending') and first_attempt_at<now()-interval '23 hours' and (claim_until is null or claim_until<now());
  select * into v_r from private.hoa_notice_recipients where notice_id=p_notice and status in ('queued','sending')
    and (claim_until is null or claim_until<now()) and (first_attempt_at is not null or v_daily<least(greatest(p_limit,1),80))
    order by first_attempt_at nulls first,id limit 1 for update skip locked;
  if not found then return null; end if;
  v_token:=gen_random_uuid();
  update private.hoa_notice_recipients set status='sending',claim_token=v_token,claim_until=now()+interval '2 minutes',
    first_attempt_at=coalesce(first_attempt_at,now()),last_attempt_at=now(),attempt_count=attempt_count+1,status_at=now() where id=v_r.id;
  return (select jsonb_build_object('id',v_r.id,'claim_token',v_token,'email',v_r.email,'subject',n.subject,'body',n.body) from private.hoa_notices n where n.id=v_r.notice_id);
end $$;
create function private.complete_hoa_notice(p_recipient uuid,p_token uuid,p_status text,p_provider text,p_error text) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_status is null or p_status not in ('accepted','queued','failed','suppressed') then raise exception 'Invalid send result'; end if;
  update private.hoa_notice_recipients set status=p_status,provider_id=coalesce(p_provider,provider_id),error=left(coalesce(p_error,''),500),
    claim_until=null,claim_token=null,status_at=now() where id=p_recipient and claim_token=p_token and status='sending';
  if p_provider is not null then perform private.apply_hoa_email_events(p_provider); end if;
end $$;
create function private.apply_hoa_email_events(p_provider text) returns void language plpgsql security definer set search_path='' as $$
declare v_email text;v_event private.hoa_email_events;
begin
  select email into v_email from private.hoa_notice_recipients where provider_id=p_provider for update;
  if v_email is null then return; end if;
  select * into v_event from private.hoa_email_events where provider_id=p_provider
    order by (status in ('bounced','complained','suppressed')) desc,event_at desc limit 1;
  if not found then return; end if;
  update private.hoa_notice_recipients set status=v_event.status,status_at=v_event.event_at,error='' where provider_id=p_provider
    and status not in ('bounced','complained','suppressed');
  if v_event.status in ('bounced','complained','suppressed') then
    insert into private.hoa_email_suppressions(email,reason) values(v_email,v_event.status) on conflict(email) do update set reason=excluded.reason,updated_at=now();
  end if;
end $$;
revoke all on function private.apply_hoa_email_events(text) from public,anon,authenticated;
create function private.record_hoa_email_event(p_event text,p_provider text,p_status text,p_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare v_status text:=case p_status when 'sent' then 'accepted' else p_status end;
begin
  if v_status is null or v_status not in ('accepted','delivered','delivery_delayed','bounced','complained','failed','suppressed') then return; end if;
  insert into private.hoa_email_events(event_id,provider_id,status,event_at) values(p_event,p_provider,v_status,p_at) on conflict do nothing;
  perform private.apply_hoa_email_events(p_provider);
end $$;

create function private.property_management_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'lot_number',p.lot_number,'street_address',p.street_address,'occupancy_status',p.occupancy_status,
    'debt',private.property_debt(p.id),
    'verified_contacts',coalesce((select jsonb_agg(jsonb_build_object('request_id',r.id,'user_id',r.user_id,'display_name',d.display_name,'login_email',a.email,
      'login_confirmed',a.email_confirmed_at is not null,'notification_email',d.notification_email,'phone',d.phone,'relationship',r.requested_relationship,
      'mailing_address',d.mailing_address,'consented',coalesce(n.consented,false),'consented_at',n.consented_at,
      'consent_matches_email',lower(trim(n.email_at_consent))=lower(trim(d.notification_email)),
      'email_block',s.reason,'delivery_status',delivery.status,'delivery_at',delivery.status_at,
      'rental_required',private.rental_required(r.id),'rental_complete',private.rental_complete(r.id)))
      from private.property_access_requests r join auth.users a on a.id=r.user_id join public.portal_account_details d on d.user_id=r.user_id
      left join private.email_notice_preferences n on n.user_id=r.user_id left join private.hoa_email_suppressions s on s.email=lower(trim(d.notification_email))
      left join lateral(select status,status_at from private.hoa_notice_recipients nr where nr.email=lower(trim(d.notification_email)) order by status_at desc limit 1) delivery on true
      where r.property_id=p.id and private.verified_property_request(r.id)),'[]'::jsonb),
    'historical_contacts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'display_name',c.display_name,'first_name',c.first_name,'last_name',c.last_name,
      'phone',c.phone,'mailing_street',c.mailing_street,'mailing_city',c.mailing_city,'mailing_state',c.mailing_state,'mailing_postal_code',c.mailing_postal_code,
      'notes',c.contact_notes,'updated_at',c.record_updated_at,'editable',c.contact_verified_at is null and not exists(select 1 from public.property_contacts pc where pc.contact_id=c.id and pc.ownership_verified_at is not null) and not exists(select 1 from public.user_profiles u where u.contact_id=c.id),
      'emails',coalesce((select jsonb_agg(e.email order by e.email_type,e.email) from public.contact_emails e where e.contact_id=c.id),case when nullif(c.email,'') is not null then jsonb_build_array(c.email) else '[]'::jsonb end)))
      from public.legacy_contact_links_staging l join public.contacts c on c.id=l.contact_id where l.lot_number=p.lot_number),'[]'::jsonb)) order by p.lot_number) from public.properties p),'[]'::jsonb);
end $$;
create function private.save_treasury_year(p_year integer,p_dues numeric,p_late numeric,p_lien numeric,p_interest numeric,p_due date,p_notes text,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v_existing private.treasury_years;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(47515,p_year);
  select * into v_existing from private.treasury_years where year=p_year for update;
  if v_existing.year is not null and (p_expected is null or p_expected<>v_existing.updated_at) then raise exception 'Year settings changed. Refresh before saving.'; end if;
  if v_existing.year is null and p_expected is not null then raise exception 'Year settings changed. Refresh before saving.'; end if;
  if p_dues<>round(p_dues,2) or p_late<>round(p_late,2) or p_lien<>round(p_lien,2) then raise exception 'Enter exact-cent fee amounts'; end if;
  insert into private.treasury_years(year,annual_dues,late_fee,lien_fee,interest_rate,due_date,notes,updated_by)
    values(p_year,p_dues,p_late,p_lien,p_interest,p_due,trim(coalesce(p_notes,'')),auth.uid())
    on conflict(year) do update set annual_dues=excluded.annual_dues,late_fee=excluded.late_fee,lien_fee=excluded.lien_fee,interest_rate=excluded.interest_rate,
      due_date=excluded.due_date,notes=excluded.notes,updated_at=clock_timestamp(),updated_by=auth.uid();
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'treasury_year_saved',jsonb_build_object('year',p_year));
end $$;
create function private.assess_treasury_dues(p_year integer,p_expected timestamptz) returns integer language plpgsql security definer set search_path='' as $$
declare v_settings private.treasury_years; v_property record; v_count integer:=0; v_added integer;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  select * into v_settings from private.treasury_years where year=p_year for update;
  if not found or p_expected is null or p_expected<>v_settings.updated_at then raise exception 'Refresh and save year settings before assessing dues'; end if;
  if v_settings.annual_dues<=0 then raise exception 'Annual dues must be greater than zero'; end if;
  for v_property in select id from public.properties order by id for update loop
    insert into private.treasury_entries(request_key,property_id,year,kind,category,amount,effective_date,note,created_by)
      values(gen_random_uuid(),v_property.id,p_year,'charge','dues',v_settings.annual_dues,v_settings.due_date,'Annual dues assessed from saved year settings.',auth.uid())
      on conflict(property_id,year,category) where kind='charge' and voided_at is null do nothing;
    get diagnostics v_added=row_count;v_count:=v_count+v_added;
  end loop;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'treasury_dues_assessed',jsonb_build_object('year',p_year,'lots',v_count));
  return v_count;
end $$;
create function private.add_treasury_entry(p_key uuid,p_property uuid,p_year integer,p_kind text,p_category text,p_amount numeric,p_date date,p_method text,p_reference text,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_existing private.treasury_entries; v_settings private.treasury_years; v_amount numeric; v_balance numeric;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  perform 1 from public.properties where id=p_property for update;
  if not found then raise exception 'Property not found'; end if;
  select * into v_existing from private.treasury_entries where request_key=p_key;
  if found then
    if v_existing.property_id<>p_property or v_existing.year<>p_year or v_existing.kind<>p_kind or v_existing.category<>p_category
      or v_existing.amount is distinct from p_amount or (p_kind='payment' and (v_existing.effective_date is distinct from p_date or v_existing.payment_method is distinct from p_method))
      or v_existing.reference is distinct from trim(coalesce(p_reference,'')) or v_existing.note is distinct from trim(p_note) then raise exception 'This action key has already been used. Refresh before creating a different entry.'; end if;
    return v_existing.id;
  end if;
  select * into v_settings from private.treasury_years where year=p_year;
  if not found then raise exception 'Save the fee settings for this year first'; end if;
  if p_kind is null or p_kind not in ('charge','payment') or p_category is null or p_category not in ('dues','late_fee','lien_fee','interest','opening_balance') then raise exception 'Choose a valid ledger action'; end if;
  if length(trim(coalesce(p_note,''))) not between 1 and 1000 then raise exception 'Enter a ledger note or evidence source'; end if;
  if p_date is null then raise exception 'Enter a date'; end if;
  v_balance:=private.treasury_balance(p_property,p_year,p_category);
  if p_kind='payment' then
    if p_date>private.hoa_today() then raise exception 'Payment date cannot be in the future'; end if;
    v_amount:=round(p_amount,2);
    if p_amount is null or p_amount<>v_amount or v_amount<=0 or v_amount>v_balance then raise exception 'Payment must be a positive exact-cent amount no greater than the unpaid category balance'; end if;
    if p_method is null or p_method not in ('check','cash','ach','bank_transfer','online','money_order','other') then raise exception 'Choose how the dues were paid'; end if;
  else
    if p_category='dues' then v_amount:=v_settings.annual_dues;
    elsif p_category='opening_balance' then v_amount:=p_amount;
    else
      if private.hoa_today()<=v_settings.due_date or private.treasury_balance(p_property,p_year,'dues')<=0 then raise exception 'Fees require overdue, unpaid annual dues for the selected year'; end if;
      v_amount:=case p_category when 'late_fee' then v_settings.late_fee when 'lien_fee' then v_settings.lien_fee
        when 'interest' then round(private.treasury_balance(p_property,p_year,'dues')*v_settings.interest_rate/100,2) end;
    end if;
    if v_amount is null or v_amount<=0 or v_amount<>round(v_amount,2) then raise exception 'The charge must be a positive exact-cent amount; check year settings'; end if;
    if p_amount is null or p_amount<>v_amount then raise exception 'The charge or year settings changed. Refresh before assessing it.'; end if;
    if exists(select 1 from private.treasury_entries where property_id=p_property and year=p_year and category=p_category and kind='charge' and voided_at is null) then raise exception 'This category is already assessed for the year. Void an incorrect charge before replacing it.'; end if;
  end if;
  insert into private.treasury_entries(request_key,property_id,year,kind,category,amount,effective_date,payment_method,reference,note,created_by)
    values(p_key,p_property,p_year,p_kind,p_category,v_amount,case when p_kind='charge' and p_category='dues' then v_settings.due_date else p_date end,
      case when p_kind='payment' then p_method end,trim(coalesce(p_reference,'')),trim(p_note),auth.uid()) returning id into v_existing.id;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'treasury_entry_added',jsonb_build_object('entry_id',v_existing.id,'property_id',p_property,'year',p_year,'kind',p_kind,'category',p_category,'amount',v_amount));
  return v_existing.id;
end $$;
create function private.void_treasury_entry(p_entry uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_entry private.treasury_entries;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Enter a correction reason'; end if;
  select * into v_entry from private.treasury_entries where id=p_entry;
  if not found then raise exception 'Entry not found'; end if;
  perform 1 from public.properties where id=v_entry.property_id for update;
  select * into v_entry from private.treasury_entries where id=p_entry for update;
  if v_entry.voided_at is not null then return; end if;
  if v_entry.kind='charge' and private.treasury_balance(v_entry.property_id,v_entry.year,v_entry.category)<v_entry.amount then raise exception 'Void the payments applied to this category before voiding its charge'; end if;
  update private.treasury_entries set voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason) where id=p_entry;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'treasury_entry_voided',jsonb_build_object('entry_id',p_entry));
end $$;

-- Editable HOA reference records never become verified by editing.
alter table public.contacts add column record_updated_at timestamptz not null default clock_timestamp();
create function private.save_historical_contact(p_property uuid,p_contact uuid,p_details jsonb,p_emails jsonb,p_expected timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_contact uuid:=p_contact; v_before public.contacts; v_email text; v_lot integer;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  select lot_number into v_lot from public.properties where id=p_property for update;
  if not found then raise exception 'Property not found'; end if;
  if jsonb_typeof(p_details) is distinct from 'object' or length(trim(coalesce(p_details->>'display_name',''))) not between 1 and 160 then raise exception 'Enter the HOA record homeowner name'; end if;
  if jsonb_typeof(p_emails) is distinct from 'array' or jsonb_array_length(p_emails)>10 then raise exception 'Enter up to ten email addresses'; end if;
  for v_email in select jsonb_array_elements_text(p_emails) loop
    if length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter valid email addresses'; end if;
  end loop;
  if length(coalesce(p_details->>'first_name',''))>80 or length(coalesce(p_details->>'last_name',''))>80 or length(coalesce(p_details->>'phone',''))>50
    or length(coalesce(p_details->>'notes',''))>1000 or length(coalesce(p_details->>'mailing_street',''))>200 or length(coalesce(p_details->>'mailing_city',''))>100
    or length(coalesce(p_details->>'mailing_state',''))>40 or length(coalesce(p_details->>'mailing_postal_code',''))>20 then raise exception 'Contact field is too long'; end if;
  if v_contact is not null then
    select * into v_before from public.contacts where id=v_contact for update;
    if not found or not exists(select 1 from public.legacy_contact_links_staging where contact_id=v_contact and lot_number=v_lot)
      or v_before.contact_verified_at is not null or exists(select 1 from public.property_contacts where contact_id=v_contact and ownership_verified_at is not null)
      or exists(select 1 from public.user_profiles where contact_id=v_contact) then raise exception 'Only historical, unverified HOA contacts can be edited here' using errcode='42501'; end if;
    if p_expected is null or v_before.record_updated_at<>p_expected then raise exception 'This contact changed. Refresh before saving.'; end if;
  else
    insert into public.contacts(display_name) values(trim(p_details->>'display_name')) returning id into v_contact;
    insert into public.legacy_contact_links_staging(id,lot_number,contact_id,relationship,notes) values(gen_random_uuid(),v_lot,v_contact,'other','HOA reference record; unverified.');
  end if;
  update public.contacts set display_name=trim(p_details->>'display_name'),first_name=trim(p_details->>'first_name'),last_name=trim(p_details->>'last_name'),
    email=p_emails->>0,phone=trim(coalesce(p_details->>'phone','')),mailing_street=trim(coalesce(p_details->>'mailing_street','')),
    mailing_city=trim(coalesce(p_details->>'mailing_city','')),mailing_state=trim(coalesce(p_details->>'mailing_state','')),mailing_postal_code=trim(coalesce(p_details->>'mailing_postal_code','')),
    contact_notes=trim(coalesce(p_details->>'notes','')),record_updated_at=clock_timestamp() where id=v_contact;
  delete from public.contact_emails where contact_id=v_contact and not (email=any(array(select jsonb_array_elements_text(p_emails))));
  insert into public.contact_emails(contact_id,lot_number,display_name,email,email_type,verified,source)
    select v_contact,v_lot,trim(p_details->>'display_name'),email,case when ord=1 then 'primary' else 'secondary' end,false,'HOA administrator reference edit; unverified'
    from (select email,min(ord) ord from jsonb_array_elements_text(p_emails) with ordinality e(email,ord) group by email) e
    on conflict(contact_id,email) do nothing;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'historical_contact_saved',jsonb_build_object('contact_id',v_contact,'property_id',p_property,'created',p_contact is null));
  return v_contact;
end $$;

create function private.reset_property_approval(p_request uuid,p_mode text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_request private.property_access_requests;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501'; end if;
  if p_mode is null or p_mode not in ('moved_away','reset') then raise exception 'Choose revoke or reset'; end if;
  select * into v_request from private.property_access_requests where id=p_request for update;
  if not found or v_request.status<>'approved' then raise exception 'Refresh and select an approved homeowner'; end if;
  perform private.review_property_request(p_request,'revoked',p_reason);
  if p_mode='reset' then
    insert into private.property_access_requests(user_id,property_id,requested_relationship,request_note,declared_rental,occupancy_choice)
      values(v_request.user_id,v_request.property_id,v_request.requested_relationship,'Approval reset by HOA administration; ownership must be reviewed again.',v_request.declared_rental,v_request.occupancy_choice);
  end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_approval_'||p_mode,jsonb_build_object('request_id',p_request,'property_id',v_request.property_id));
end $$;

create function public.get_treasury_workspace(p_year integer) returns jsonb language sql stable security invoker set search_path='' as $$select private.treasury_workspace(p_year);$$;
create function public.save_treasury_year(p_year integer,p_dues numeric,p_late numeric,p_lien numeric,p_interest numeric,p_due date,p_notes text,p_expected timestamptz) returns void language sql security invoker set search_path='' as $$select private.save_treasury_year(p_year,p_dues,p_late,p_lien,p_interest,p_due,p_notes,p_expected);$$;
create function public.assess_treasury_dues(p_year integer,p_expected timestamptz) returns integer language sql security invoker set search_path='' as $$select private.assess_treasury_dues(p_year,p_expected);$$;
create function public.add_treasury_entry(p_key uuid,p_property uuid,p_year integer,p_kind text,p_category text,p_amount numeric,p_date date,p_method text,p_reference text,p_note text) returns uuid language sql security invoker set search_path='' as $$select private.add_treasury_entry(p_key,p_property,p_year,p_kind,p_category,p_amount,p_date,p_method,p_reference,p_note);$$;
create function public.void_treasury_entry(p_entry uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select private.void_treasury_entry(p_entry,p_reason);$$;
create function public.get_property_management_workspace() returns jsonb language sql stable security invoker set search_path='' as $$select private.property_management_workspace();$$;
create function public.save_historical_contact(p_property uuid,p_contact uuid,p_details jsonb,p_emails jsonb,p_expected timestamptz) returns uuid language sql security invoker set search_path='' as $$select private.save_historical_contact(p_property,p_contact,p_details,p_emails,p_expected);$$;
create function public.reset_property_approval(p_request uuid,p_mode text,p_reason text) returns void language sql security invoker set search_path='' as $$select private.reset_property_approval(p_request,p_mode,p_reason);$$;
create function public.get_notice_recipients(p_properties uuid[] default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.notice_recipients(p_properties);$$;
create function public.prepare_hoa_notice(p_key uuid,p_subject text,p_body text,p_properties uuid[],p_expected text[]) returns uuid language sql security invoker set search_path='' as $$select private.create_hoa_notice(p_key,p_subject,p_body,p_properties,p_expected);$$;
create function public.get_hoa_notices() returns jsonb language sql stable security invoker set search_path='' as $$select private.notice_workspace();$$;
create function public.set_hoa_email_block(p_email text,p_block boolean,p_note text) returns void language sql security invoker set search_path='' as $$select private.set_hoa_email_block(p_email,p_block,p_note);$$;
create function public.claim_hoa_notice_delivery(p_notice uuid,p_limit integer) returns jsonb language sql security invoker set search_path='' as $$select private.claim_hoa_notice(p_notice,p_limit);$$;
create function public.complete_hoa_notice_delivery(p_recipient uuid,p_token uuid,p_status text,p_provider text,p_error text) returns void language sql security invoker set search_path='' as $$select private.complete_hoa_notice(p_recipient,p_token,p_status,p_provider,p_error);$$;
create function public.record_hoa_notice_delivery_event(p_event text,p_provider text,p_status text,p_at timestamptz) returns void language sql security invoker set search_path='' as $$select private.record_hoa_email_event(p_event,p_provider,p_status,p_at);$$;

-- Every privileged implementation is private; exposed RPCs are invokers only.
do $$declare f record;begin
  for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
    (n.nspname='private' and p.proname in ('treasury_workspace','save_treasury_year','assess_treasury_dues','add_treasury_entry','void_treasury_entry','property_management_workspace','save_historical_contact','reset_property_approval','notice_recipients','create_hoa_notice','notice_workspace','set_hoa_email_block'))
    or (n.nspname='public' and p.proname in ('get_treasury_workspace','save_treasury_year','assess_treasury_dues','add_treasury_entry','void_treasury_entry','get_property_management_workspace','save_historical_contact','reset_property_approval','get_notice_recipients','prepare_hoa_notice','get_hoa_notices','set_hoa_email_block')) loop
    execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
    (n.nspname='private' and p.proname in ('claim_hoa_notice','complete_hoa_notice','record_hoa_email_event')) or
    (n.nspname='public' and p.proname in ('claim_hoa_notice_delivery','complete_hoa_notice_delivery','record_hoa_notice_delivery_event')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant usage on schema private to service_role;
notify pgrst,'reload schema';
