-- One SELECT policy per role; writes still require system administrator + MFA.
alter policy leadership_people_public on public.leadership_people to anon;
alter policy board_years_public on public.board_member_years to anon;
alter policy officer_years_public on public.officer_member_years to anon;

create policy leadership_people_authenticated_read on public.leadership_people for select to authenticated
using (is_public or (select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy board_years_authenticated_read on public.board_member_years for select to authenticated
using (published or (select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy officer_years_authenticated_read on public.officer_member_years for select to authenticated
using (published or (select private.portal_flags()->>'can_manage_leadership')::boolean);

drop policy leadership_people_admin on public.leadership_people;
drop policy board_years_admin on public.board_member_years;
drop policy officer_years_admin on public.officer_member_years;
create policy leadership_people_admin_insert on public.leadership_people for insert to authenticated
with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy leadership_people_admin_update on public.leadership_people for update to authenticated
using ((select private.portal_flags()->>'can_manage_leadership')::boolean) with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy board_years_admin_insert on public.board_member_years for insert to authenticated
with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy board_years_admin_update on public.board_member_years for update to authenticated
using ((select private.portal_flags()->>'can_manage_leadership')::boolean) with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy officer_years_admin_insert on public.officer_member_years for insert to authenticated
with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
create policy officer_years_admin_update on public.officer_member_years for update to authenticated
using ((select private.portal_flags()->>'can_manage_leadership')::boolean) with check ((select private.portal_flags()->>'can_manage_leadership')::boolean);
notify pgrst, 'reload schema';
