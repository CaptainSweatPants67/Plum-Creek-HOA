-- Committee appointments never grant ownership, login accounts or staff tools.
create table private.hoa_committees (
  id uuid primary key default gen_random_uuid(),source_key text unique,
  name text not null check(length(trim(name)) between 1 and 120),
  description text not null default '' check(length(description)<=2000),
  responsibilities jsonb not null default '[]' check(jsonb_typeof(responsibilities)='array' and jsonb_array_length(responsibilities)<=12),
  show_public boolean not null default false,active boolean not null default true,
  board_membership boolean not null default false,
  sort_order integer not null default 0 check(sort_order between 0 and 1000),
  updated_at timestamptz not null default clock_timestamp(),updated_by uuid references auth.users(id)
);
create unique index hoa_committees_name_idx on private.hoa_committees(lower(trim(name)));
create index hoa_committees_actor_idx on private.hoa_committees(updated_by);
create table private.hoa_committee_members (
  id uuid primary key default gen_random_uuid(),committee_id uuid not null references private.hoa_committees(id),
  display_name text not null check(length(trim(display_name)) between 1 and 160),
  role text not null default 'Member' check(length(trim(role)) between 1 and 80),
  show_public boolean not null default false,active boolean not null default true,
  starts_on date,ends_on date,notes text not null default '' check(length(notes)<=1000),
  updated_at timestamptz not null default clock_timestamp(),updated_by uuid references auth.users(id),
  check(starts_on is null or ends_on is null or ends_on>=starts_on)
);
create index hoa_committee_members_committee_idx on private.hoa_committee_members(committee_id);
create unique index hoa_committee_members_name_idx on private.hoa_committee_members(committee_id,lower(trim(display_name))) where active;
create index hoa_committee_members_actor_idx on private.hoa_committee_members(updated_by);
alter table private.hoa_committees enable row level security;
alter table private.hoa_committee_members enable row level security;
revoke all on private.hoa_committees,private.hoa_committee_members from public,anon,authenticated;

-- Preserve the descriptions and already-public roster from the existing website.
-- New records created through the portal default to member-only visibility.
insert into private.hoa_committees(source_key,name,description,responsibilities,show_public,board_membership,sort_order) values
('architectural','Architectural Control Committee','Reviews proposed exterior construction and property changes for consistency with Plum Creek''s recorded restrictions. The current Board of Directors serves as this committee.',
 '["Review plans, specifications, materials, exterior colors, and project placement","Consider fences, roofs, detached structures, pools, solar panels, basketball goals, and similar exterior improvements","Provide written approval guidance before covered work begins"]',true,true,10),
('covenants','Covenants Review Committee','Supports the Board by reviewing Plum Creek''s governing documents, identifying questions or areas that may need clarification, and making recommendations for Board consideration.',
 '["Study the declarations, restrictions, and bylaws","Help organize covenant questions raised by homeowners","Present findings and recommendations to the Board"]',true,false,20),
('beautification','Beautification Committee','Encourages a welcoming neighborhood appearance and helps the Board plan community beautification efforts and shared-area improvements.',
 '["Recommend neighborhood appearance projects","Help coordinate seasonal or volunteer beautification efforts","Share improvement ideas and project needs with the Board"]',true,false,30),
('welcoming','Welcoming Committee','Helps new residents feel at home by introducing them to the neighborhood, HOA resources, important contacts, and opportunities to participate in the community.',
 '["Welcome new Plum Creek households","Share helpful HOA and neighborhood information","Encourage connection and community involvement"]',true,false,40);
insert into private.hoa_committee_members(committee_id,display_name,role,show_public,active,notes)
select c.id,m.name,m.role,true,m.active,'Carried forward from the existing public website roster; confirm appointment details.' from private.hoa_committees c join (values
 ('covenants','Michael Bruna','Chair',true),('covenants','Harvey Sime','Member',true),('covenants','Tana Johnson','Member',true),
 ('covenants','Charity Thurston','Member',true),('covenants','Barb Mallory','Member',false),('covenants','Kevin Coker','Member',true),('covenants','Jake Danner','Member',true),
 ('beautification','Andrew Benedict-Nelson','Member',true),('beautification','Emily Redding','Member',true),('beautification','Charity Coker','Member',true)
) m(key,name,role,active) on c.source_key=m.key;

create function private.committee_directory(p_members boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if p_members and not private.can_read_member_information() then raise exception 'Approved membership and current rental paperwork, or authorized staff with MFA, required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'responsibilities',c.responsibilities,
    'board_membership',c.board_membership,'show_public',c.show_public,
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'role',m.role,'show_public',m.show_public) order by case when lower(m.role)='chair' then 0 else 1 end,m.display_name,m.id)
      from private.hoa_committee_members m where m.committee_id=c.id and m.active and (p_members or m.show_public)
        and (m.starts_on is null or m.starts_on<=private.hoa_today()) and (m.ends_on is null or m.ends_on>=private.hoa_today())),'[]'::jsonb)) order by c.sort_order,c.name,c.id)
      from private.hoa_committees c where c.active and (p_members or c.show_public)),'[]'::jsonb);
end $$;
revoke all on function private.committee_directory(boolean) from public,anon,authenticated;
-- Separate no-argument implementations prevent anonymous callers choosing the private branch.
create function private.public_committee_directory() returns jsonb language sql stable security definer set search_path='' as $$select private.committee_directory(false);$$;
create function private.member_committee_directory() returns jsonb language sql stable security definer set search_path='' as $$select private.committee_directory(true);$$;
create function private.committee_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(to_jsonb(c)-'updated_by'||jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(m)-'updated_by' order by m.active desc,m.display_name,m.id)
    from private.hoa_committee_members m where m.committee_id=c.id),'[]'::jsonb)) order by c.active desc,c.sort_order,c.name) from private.hoa_committees c),'[]'::jsonb);
end $$;
create function private.save_committee(p_id uuid,p_details jsonb,p_expected timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=p_id;v_row private.hoa_committees;v_responsibility jsonb;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501';end if;
  if jsonb_typeof(p_details) is distinct from 'object' or jsonb_typeof(p_details->'show_public') is distinct from 'boolean' or jsonb_typeof(p_details->'active') is distinct from 'boolean' then raise exception 'Choose committee visibility and active status';end if;
  if jsonb_typeof(p_details->'responsibilities') is distinct from 'array' or jsonb_array_length(p_details->'responsibilities')>12 then raise exception 'Enter up to twelve responsibilities';end if;
  for v_responsibility in select jsonb_array_elements(p_details->'responsibilities') loop
    if jsonb_typeof(v_responsibility)<>'string' or length(trim(v_responsibility#>>'{}')) not between 1 and 300 then raise exception 'Each responsibility must be text, up to 300 characters';end if;
  end loop;
  if length(trim(coalesce(p_details->>'name',''))) not between 1 and 120 then raise exception 'Enter a committee name';end if;
  if v_id is not null then
    select * into v_row from private.hoa_committees where id=v_id for update;
    if not found or p_expected is null or v_row.updated_at<>p_expected then raise exception 'Committee changed. Refresh before saving.';end if;
    update private.hoa_committees set name=trim(p_details->>'name'),description=trim(coalesce(p_details->>'description','')),responsibilities=p_details->'responsibilities',
      show_public=(p_details->>'show_public')::boolean,active=(p_details->>'active')::boolean,sort_order=(p_details->>'sort_order')::integer,updated_at=clock_timestamp(),updated_by=auth.uid() where id=v_id;
  else
    insert into private.hoa_committees(name,description,responsibilities,show_public,active,sort_order,updated_by)
      values(trim(p_details->>'name'),trim(coalesce(p_details->>'description','')),p_details->'responsibilities',(p_details->>'show_public')::boolean,(p_details->>'active')::boolean,(p_details->>'sort_order')::integer,auth.uid()) returning id into v_id;
  end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'committee_saved',jsonb_build_object('committee_id',v_id,'show_public',(p_details->>'show_public')::boolean,'active',(p_details->>'active')::boolean));
  return v_id;
end $$;
create function private.save_committee_member(p_id uuid,p_committee uuid,p_details jsonb,p_expected timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=p_id;v_row private.hoa_committee_members;v_board boolean;
begin
  if not private.staff_authorized() then raise exception 'HOA administration with MFA required' using errcode='42501';end if;
  select board_membership into v_board from private.hoa_committees where id=p_committee for update;
  if not found then raise exception 'Choose a committee';end if;
  if v_board then raise exception 'The current Board serves this committee. Manage Board appointments through leadership settings.';end if;
  if jsonb_typeof(p_details) is distinct from 'object' or jsonb_typeof(p_details->'show_public') is distinct from 'boolean' or jsonb_typeof(p_details->'active') is distinct from 'boolean' then raise exception 'Choose member visibility and active status';end if;
  if length(trim(coalesce(p_details->>'name',''))) not between 1 and 160 or length(trim(coalesce(p_details->>'role',''))) not between 1 and 80 then raise exception 'Enter the member name and role';end if;
  if v_id is not null then
    select * into v_row from private.hoa_committee_members where id=v_id and committee_id=p_committee for update;
    if not found or p_expected is null or v_row.updated_at<>p_expected then raise exception 'Committee member changed. Refresh before saving.';end if;
    update private.hoa_committee_members set display_name=trim(p_details->>'name'),role=trim(p_details->>'role'),show_public=(p_details->>'show_public')::boolean,
      active=(p_details->>'active')::boolean,starts_on=nullif(p_details->>'starts_on','')::date,ends_on=nullif(p_details->>'ends_on','')::date,
      notes=trim(coalesce(p_details->>'notes','')),updated_at=clock_timestamp(),updated_by=auth.uid() where id=v_id;
  else
    insert into private.hoa_committee_members(committee_id,display_name,role,show_public,active,starts_on,ends_on,notes,updated_by)
      values(p_committee,trim(p_details->>'name'),trim(p_details->>'role'),(p_details->>'show_public')::boolean,(p_details->>'active')::boolean,
        nullif(p_details->>'starts_on','')::date,nullif(p_details->>'ends_on','')::date,trim(coalesce(p_details->>'notes','')),auth.uid()) returning id into v_id;
  end if;
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'committee_member_saved',jsonb_build_object('committee_id',p_committee,'member_id',v_id,'show_public',(p_details->>'show_public')::boolean,'active',(p_details->>'active')::boolean));
  return v_id;
end $$;

create function public.get_public_committees() returns jsonb language sql stable security invoker set search_path='' as $$select private.public_committee_directory();$$;
create function public.get_member_committees() returns jsonb language sql stable security invoker set search_path='' as $$select private.member_committee_directory();$$;
create function public.get_committee_workspace() returns jsonb language sql stable security invoker set search_path='' as $$select private.committee_workspace();$$;
create function public.save_hoa_committee(p_id uuid,p_details jsonb,p_expected timestamptz) returns uuid language sql security invoker set search_path='' as $$select private.save_committee(p_id,p_details,p_expected);$$;
create function public.save_hoa_committee_member(p_id uuid,p_committee uuid,p_details jsonb,p_expected timestamptz) returns uuid language sql security invoker set search_path='' as $$select private.save_committee_member(p_id,p_committee,p_details,p_expected);$$;
revoke all on function private.public_committee_directory(),public.get_public_committees() from public;
grant execute on function private.public_committee_directory(),public.get_public_committees() to anon,authenticated;
revoke all on function private.member_committee_directory(),private.committee_workspace(),private.save_committee(uuid,jsonb,timestamptz),private.save_committee_member(uuid,uuid,jsonb,timestamptz),
  public.get_member_committees(),public.get_committee_workspace(),public.save_hoa_committee(uuid,jsonb,timestamptz),public.save_hoa_committee_member(uuid,uuid,jsonb,timestamptz) from public,anon;
grant execute on function private.member_committee_directory(),private.committee_workspace(),private.save_committee(uuid,jsonb,timestamptz),private.save_committee_member(uuid,uuid,jsonb,timestamptz),
  public.get_member_committees(),public.get_committee_workspace(),public.save_hoa_committee(uuid,jsonb,timestamptz),public.save_hoa_committee_member(uuid,uuid,jsonb,timestamptz) to authenticated;
notify pgrst,'reload schema';
