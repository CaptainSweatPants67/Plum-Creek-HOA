-- Only current published appointments belong to the public roster. The two
-- private helpers bypass row policies solely to avoid recursive roster/name
-- policies; they expose a year or a membership boolean, never historical data.
create function private.public_roster_year(p_board boolean) returns integer
language sql stable security definer set search_path='' as $$
  select case when p_board then
    (select max(service_year) from public.board_member_years where published and record_kind <> 'historical'
      and service_year <= extract(year from now() at time zone 'America/Chicago'))
  else
    (select max(service_year) from public.officer_member_years where published
      and service_year <= extract(year from now() at time zone 'America/Chicago')) end;
$$;
create function private.current_public_person(p_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.board_member_years where person_id=p_person and published
    and record_kind <> 'historical' and service_year=private.public_roster_year(true))
    or exists(select 1 from public.officer_member_years where person_id=p_person and published
      and service_year=private.public_roster_year(false));
$$;
revoke all on function private.public_roster_year(boolean),private.current_public_person(uuid) from public;
grant execute on function private.public_roster_year(boolean),private.current_public_person(uuid) to anon,authenticated;

drop policy leadership_people_public on public.leadership_people;
drop policy board_years_public on public.board_member_years;
drop policy officer_years_public on public.officer_member_years;
drop policy leadership_people_authenticated_read on public.leadership_people;
drop policy board_years_authenticated_read on public.board_member_years;
drop policy officer_years_authenticated_read on public.officer_member_years;
create policy leadership_people_public on public.leadership_people for select to anon,authenticated
  using(is_public and private.current_public_person(id));
create policy board_years_public on public.board_member_years for select to anon,authenticated
  using(published and record_kind <> 'historical' and service_year=(select private.public_roster_year(true)));
create policy officer_years_public on public.officer_member_years for select to anon,authenticated
  using(published and service_year=(select private.public_roster_year(false)));
create policy leadership_people_authenticated_read on public.leadership_people for select to authenticated
  using((is_public and (select private.confirmed_account())) or (select (private.portal_flags()->>'can_manage_leadership')::boolean));
create policy board_years_authenticated_read on public.board_member_years for select to authenticated
  using((published and (select private.confirmed_account())) or (select (private.portal_flags()->>'can_manage_leadership')::boolean));
create policy officer_years_authenticated_read on public.officer_member_years for select to authenticated
  using((published and (select private.confirmed_account())) or (select (private.portal_flags()->>'can_manage_leadership')::boolean));

create or replace function public.get_public_leadership_roster() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'board',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'person_id',b.person_id,'name',coalesce(p.display_name,'Vacant'),
      'year',b.service_year,'term',b.seat_label,'position',b.recorded_position,'kind',b.record_kind) order by b.seat_label,b.id)
      from public.board_member_years b left join public.leadership_people p on p.id=b.person_id
      where b.published and b.record_kind <> 'historical' and b.service_year=private.public_roster_year(true)
        and (b.person_id is null or p.is_public)),'[]'::jsonb),
    'officers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'person_id',o.person_id,'name',coalesce(p.display_name,'Vacant'),
      'year',o.service_year,'position',t.title,'position_code',t.code) order by t.sort_order,o.id)
      from public.officer_member_years o join public.officer_positions t on t.code=o.position_code
      left join public.leadership_people p on p.id=o.person_id
      where o.published and o.service_year=private.public_roster_year(false) and (o.person_id is null or p.is_public)),'[]'::jsonb));
$$;

create function private.member_leadership_history() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  if not private.confirmed_account() then raise exception 'Confirmed member account required' using errcode='42501'; end if;
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
revoke all on function private.member_leadership_history() from public,anon;
grant execute on function private.member_leadership_history() to authenticated;
create function public.get_member_leadership_history() returns jsonb language sql stable security invoker set search_path='' as $$
  select private.member_leadership_history();
$$;
revoke all on function public.get_member_leadership_history() from public,anon;
grant execute on function public.get_member_leadership_history() to authenticated;

-- One existing governing PDF is larger than the ordinary 1 MB publication cap.
-- No client upload/update/delete permission: future replacements are deliberate
-- administrator maintenance. Keep the library's existing limits unchanged.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hoa-member-governance','hoa-member-governance',false,5000000,array['application/pdf']);
create policy hoa_governance_member_read on storage.objects for select to authenticated
  using(bucket_id='hoa-member-governance' and name='plum-creek-bylaws.pdf' and (select private.confirmed_account()));
