-- Keep member-submitted household values safe to render in staff views.
create or replace function private.save_property_household(p_request uuid,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_members jsonb:=coalesce(p_details->'additional_members','[]'::jsonb); v_member jsonb; v_trust boolean:=coalesce((p_details->>'is_trust')::boolean,false);
begin
  if not private.confirmed_account() then raise exception 'Confirmed account required' using errcode='42501'; end if;
  perform 1 from private.property_access_requests where id=p_request and user_id=auth.uid() and status in ('pending','approved') for update;
  if not found then raise exception 'Choose your own active property request' using errcode='42501'; end if;
  if jsonb_typeof(v_members)<>'array' or jsonb_array_length(v_members)>10 then raise exception 'Add at most ten other household members'; end if;
  for v_member in select value from jsonb_array_elements(v_members) loop
    if jsonb_typeof(v_member)<>'object' or length(trim(coalesce(v_member->>'first_name',''))) not between 1 and 80
      or length(trim(coalesce(v_member->>'last_name',''))) not between 1 and 80
      or exists(select 1 from jsonb_each(v_member) e where jsonb_typeof(e.value)<>'string')
      or coalesce(v_member->>'relationship','') not in ('spouse','co_owner','other')
      or length(coalesce(v_member->>'email',''))>254 or length(coalesce(v_member->>'phone',''))>50
      or (v_member - array['first_name','last_name','relationship','email','phone'])<>'{}'::jsonb then raise exception 'Enter a first name, last name and relationship for each additional member'; end if;
  end loop;
  if v_trust and (length(trim(coalesce(p_details->>'trust_name','')))=0 or length(trim(coalesce(p_details->>'decision_first_name','')))=0 or length(trim(coalesce(p_details->>'decision_last_name','')))=0) then raise exception 'Enter the trust name and the decision maker first and last names'; end if;
  insert into private.property_households(request_id,additional_members,is_trust,trust_name,decision_first_name,decision_last_name,decision_email,decision_phone)
    values(p_request,v_members,v_trust,case when v_trust then trim(coalesce(p_details->>'trust_name','')) else '' end,
      case when v_trust then trim(coalesce(p_details->>'decision_first_name','')) else '' end,case when v_trust then trim(coalesce(p_details->>'decision_last_name','')) else '' end,
      case when v_trust then trim(coalesce(p_details->>'decision_email','')) else '' end,case when v_trust then trim(coalesce(p_details->>'decision_phone','')) else '' end)
    on conflict(request_id) do update set additional_members=excluded.additional_members,is_trust=excluded.is_trust,trust_name=excluded.trust_name,
      decision_first_name=excluded.decision_first_name,decision_last_name=excluded.decision_last_name,decision_email=excluded.decision_email,decision_phone=excluded.decision_phone,updated_at=now();
  insert into private.leadership_audit(actor_user_id,action,details) values(auth.uid(),'property_household_updated',jsonb_build_object('request_id',p_request,'is_trust',v_trust));
end $$;

notify pgrst,'reload schema';
