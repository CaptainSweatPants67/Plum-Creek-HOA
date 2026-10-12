import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("real PostgreSQL permissions, signup gate, bootstrap and dated leadership", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const admin = "00000000-0000-4000-8000-000000000001";
  const homeowner = "00000000-0000-4000-8000-000000000002";
  const staff = "00000000-0000-4000-8000-000000000003";
  const person = "00000000-0000-4000-8000-000000000004";
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const migrationFiles = await readdir(new URL("../supabase/migrations/",import.meta.url));
  const migration = (name) => read(`supabase/migrations/${migrationFiles.find((file)=>file.endsWith(`_${name}.sql`))}`);
  await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz, is_anonymous boolean default false,
      raw_app_meta_data jsonb default '{"provider":"email"}', raw_user_meta_data jsonb default '{}');
  `);
  // Match Supabase's signed-token helpers, with claims supplied by test fixtures.
  await db.exec(`create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}')$$;
    grant usage on schema auth,public to anon,authenticated,supabase_auth_admin;
    grant execute on all functions in schema auth to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  await db.exec((await read("supabase/reference/plum_creek_supabase_schema.sql")).replace("create extension if not exists pgcrypto;", ""));
  await db.exec(await read("supabase/reference/plum_creek_contact_import_setup.sql"));
  await db.exec(`grant all on all tables in schema public to anon,authenticated;
    insert into auth.users(id,email,email_confirmed_at) values('${homeowner}','homeowner@example.test',now()),('${staff}','staff@example.test',now());
    insert into public.contacts(display_name,email) values('Historical contact','homeowner@example.test');`);
  await db.exec(await migration("leadership_and_signup_gate"));
  await db.exec(await migration("public_leadership_roster_seed"));
  await db.exec(await migration("leadership_policy_refinement"));
  await db.exec(await migration("member_information_and_property_review"));
  await db.exec(await migration("leadership_contacts_and_member_documents"));
  async function asRole(role, uid, aal, fn) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(uid ? { sub: uid, aal, user_metadata: { role: "admin", is_director: true } } : {})]);
    await db.exec(`set role ${role}`);
    try { return await fn(); } finally { await db.exec("reset role"); await db.exec("select set_config('request.jwt.claims','{}',false)"); }
  }
  const scalar = async (sql, params=[]) => Object.values((await db.query(sql,params)).rows[0])[0];
  const flags = () => scalar("select public.get_portal_flags()");
  await t.test("anonymous roster shows current President and preserves historical rows without privileges", async () => {
    await asRole("anon", null, null, async () => {
      const roster = await scalar("select public.get_public_leadership_roster()");
      assert.equal(roster.board.length,86);
      assert.equal(roster.officers.find((r) => r.year===2026 && r.position_code==="president").name,"Michael Bruna");
      assert.equal(roster.officers.find((r) => r.year===2026 && r.position_code==="vice_president").person_id,null);
      assert.ok(!JSON.stringify(roster).includes("@"));
      await assert.rejects(db.query("select * from private.signup_passcode"), /permission denied/);
      await assert.rejects(db.query("select public.get_homeowner_signup_passcode()"), /permission denied/);
      await assert.rejects(db.query("truncate public.contacts"), /permission denied/);
      assert.equal(await scalar("select count(*) from public.contacts"),0);
    });
    assert.equal(await scalar("select count(*) from public.board_member_years where privileges_enabled"),0);
  });
  await t.test("user metadata cannot grant admin or homeowner contact access", async () => {
    await asRole("authenticated",homeowner,"aal2",async () => {
      assert.equal((await flags()).is_admin,false);
      await assert.rejects(db.query("select public.get_homeowner_signup_passcode()"), /MFA required/);
      await assert.rejects(db.query("insert into public.leadership_people(display_name) values('Self appointed')"), /row-level security/);
      await assert.rejects(db.query("insert into public.user_roles values($1,'admin')",[homeowner]), /row-level security/);
      assert.equal(await scalar("select count(*) from public.contacts"),0);
    });
  });
  await db.query("insert into public.leadership_people(id,display_name,is_public) values($1,'Verified officer',false)",[person]);
  await db.query("insert into private.leadership_account_links(person_id,user_id) values($1,$2)",[person,staff]);
  await db.query("insert into public.officer_member_years(person_id,position_code,service_year,starts_on,ends_on,privileges_enabled) values($1,'president',extract(year from current_date),current_date,current_date,true)",[person]);
  await t.test("active Officer needs MFA; expired assignment and revoked link remove privileges immediately", async () => {
    await asRole("authenticated",staff,"aal1",async () => {
      assert.equal((await flags()).is_officer,true);
      await assert.rejects(db.query("select public.get_homeowner_signup_passcode()"),/MFA required/);
    });
    await asRole("authenticated",staff,"aal2",async () => {
      assert.equal((await flags()).can_view_signup_code,true);
      assert.match((await scalar("select public.get_homeowner_signup_passcode()")).passcode,/^[A-F0-9]{24}$/);
      await assert.rejects(db.query("select public.rotate_homeowner_signup_passcode()"),/Administrator/);
    });
    await db.query("update private.leadership_account_links set revoked_at=now() where person_id=$1",[person]);
    await asRole("authenticated",staff,"aal2",async () => assert.equal((await flags()).is_officer,false));
    await db.query("update private.leadership_account_links set revoked_at=null where person_id=$1",[person]);
    await db.query("update public.officer_member_years set starts_on=current_date-1,ends_on=current_date-1 where person_id=$1",[person]);
    await asRole("authenticated",staff,"aal2",async () => assert.equal((await flags()).is_officer,false));
  });
  let code = await scalar("select passcode from private.signup_passcode");
  const ticket = async (email, passcode=code) => asRole("anon",null,null,() => scalar("select public.request_homeowner_signup_ticket($1,$2)",[email,passcode]));
  const newUser = async (id,email,nonce) => db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",[id,email,JSON.stringify(nonce ? {signup_ticket:nonce,role:"admin"} : {})]);
  await t.test("direct Auth inserts, wrong passcodes, mismatched emails and expired tickets fail closed",async () => {
    const id = "00000000-0000-4000-8000-000000000010";
    await assert.rejects(newUser(id,"new@example.test"),/passcode is required/);
    assert.ok((await ticket("new@example.test","wrong")).error);
    const issued = await ticket("new@example.test"); assert.ok(issued.ticket);
    await assert.rejects(newUser(id,"other@example.test",issued.ticket),/passcode is required/);
    await db.query("update private.signup_tickets set expires_at=now()-interval '1 second'");
    await assert.rejects(newUser(id,"new@example.test",issued.ticket),/passcode is required/);
    for (let i=0;i<11;i++) await ticket("limited@example.test","wrong");
    assert.match((await ticket("limited@example.test")).error,/Too many attempts/);
  });
  await t.test("valid ticket permits one pending identity, scrubs ticket, never links historic contact", async () => {
    const id = "00000000-0000-4000-8000-000000000011";
    const issued = await ticket("pending@example.test");
    await newUser(id,"pending@example.test",issued.ticket);
    assert.equal(await scalar("select contact_id from public.user_profiles where user_id=$1",[id]),null);
    assert.equal(await scalar("select raw_user_meta_data ? 'signup_ticket' from auth.users where id=$1",[id]),false);
    await assert.rejects(newUser("00000000-0000-4000-8000-000000000012","pending2@example.test",issued.ticket),/passcode is required/);
    await asRole("authenticated",id,"aal2",async () => assert.equal((await flags()).can_view_signup_code,false));
  });
  await db.exec("update public.officer_member_years set privileges_enabled=false where source='administrative_entry'");
  await db.exec("insert into private.portal_bootstrap_admin(email,person_id) select 'bootstrap@example.test',id from public.leadership_people where display_name='Michael Bruna'");
  await t.test("bootstrap email confirmation grants admin, Director and President independently of contact history", async () => {
    await newUser(admin,"bootstrap@example.test");
    await asRole("authenticated",admin,"aal2",async () => assert.equal((await flags()).is_admin,false));
    await db.query("update auth.users set email_confirmed_at=now() where id=$1",[admin]);
    await asRole("authenticated",admin,"aal2",async () => {
      const f=await flags(); assert.equal(f.is_admin,true);assert.equal(f.is_director,true);assert.equal(f.is_officer,true);
      assert.equal(f.can_manage_leadership,true);
      await db.query("insert into public.leadership_people(display_name,is_public) values('Draft private person',false)");
      await db.query("select public.link_leadership_account($1,'staff@example.test')",[person]);
    });
    assert.equal(await scalar("select count(*) from public.contacts where contact_verified_at is not null"),0);
    assert.equal(await scalar("select contact_id from public.user_profiles where user_id=$1",[admin]),null);
    await asRole("anon",null,null,async () => assert.equal(await scalar("select count(*) from public.leadership_people where display_name='Draft private person'"),0));
  });
  await t.test("rotation invalidates outstanding tickets and old passcode", async () => {
    const issued=await ticket("rotating@example.test");
    await asRole("authenticated",admin,"aal2",async () => db.query("select public.rotate_homeowner_signup_passcode()"));
    await assert.rejects(newUser("00000000-0000-4000-8000-000000000015","rotating@example.test",issued.ticket),/passcode is required/);
    assert.ok((await ticket("rotating@example.test",code)).error);
    code=await scalar("select passcode from private.signup_passcode");
    assert.ok((await ticket("rotating@example.test",code)).ticket);
  });
  await t.test("overlapping approved Officer terms are rejected; historical duplicates stay readable", async () => {
    await assert.rejects(db.query("insert into public.officer_member_years(person_id,position_code,service_year,starts_on,ends_on,privileges_enabled) values($1,'president',extract(year from current_date),current_date,current_date,true)",[person]),/already has an approved appointment/);
    assert.equal(await scalar("select count(*) from public.board_member_years where record_kind='historical' and privileges_enabled"),0);
  });
  const propertyA="00000000-0000-4000-8000-000000000020";
  const propertyB="00000000-0000-4000-8000-000000000021";
  await db.query("insert into public.properties(id,lot_number,street_address) values($1,1,'Test address A'),($2,2,'Test address B')",[propertyA,propertyB]);
  let requestA,requestB,administratorRequest;
  const member=()=>scalar("select public.get_member_workspace()");
  await t.test("members can only edit their own current details and submit pending requests",async()=>{
    await asRole("anon",null,null,async()=>{
      await assert.rejects(db.query("select public.get_member_workspace()"),/permission denied/);
      await assert.rejects(db.query("select public.get_property_choices()"),/permission denied/);
    });
    await asRole("authenticated",homeowner,"aal2",async()=>{
      await assert.rejects(db.query("select public.submit_property_access_request($1,'owner','Current ownership')",[propertyA]),/Save your current contact/);
      await db.query("insert into public.portal_account_details(user_id,display_name,phone) values($1,'Current homeowner','555-0100')",[homeowner]);
      await assert.rejects(db.query("insert into public.portal_account_details(user_id,display_name) values($1,'Impersonated')",[staff]),/row-level security/);
      requestA=await scalar("select public.submit_property_access_request($1,'owner','Current ownership')",[propertyA]);
      requestB=await scalar("select public.submit_property_access_request($1,'co_owner','Second property')",[propertyB]);
      await assert.rejects(db.query("select public.submit_property_access_request($1,'owner','Duplicate')",[propertyA]),/duplicate key/);
      assert.equal((await member()).properties.length,0);assert.equal((await member()).requests.length,2);
      await assert.rejects(db.query("select public.review_property_access_request($1,'approved','Self approved')",[requestA]),/MFA required/);
      await assert.rejects(db.query("select * from private.property_access_requests"),/permission denied/);
    });
    await asRole("authenticated",staff,"aal2",async()=>{
      assert.equal(await scalar("select count(*) from public.portal_account_details"),0);
      assert.equal((await member()).requests.length,0);
      await assert.rejects(db.query("select public.get_staff_workspace()"),/MFA required/);
    });
  });
  await t.test("staff approval is atomic, uses a fresh contact, supports multiple properties and does not verify legacy email",async()=>{
    await asRole("authenticated",admin,"aal1",async()=>{
      await assert.rejects(db.query("select public.review_property_access_request($1,'approved','Current deed checked')",[requestA]),/MFA required/);
    });
    await asRole("authenticated",admin,"aal2",async()=>{
      await assert.rejects(db.query("select public.review_property_access_request($1,'approved','')",[requestA]),/Record how ownership/);
      await db.query("select public.review_property_access_request($1,'approved','Synthetic current ownership evidence checked')",[requestA]);
      await db.query("select public.review_property_access_request($1,'approved','Synthetic second property evidence checked')",[requestB]);
      await assert.rejects(db.query("select public.review_property_access_request($1,'approved','Stale repeat')",[requestA]),/already changed/);
      const staffView=await scalar("select public.get_staff_workspace()");assert.equal(staffView.requests.length,2);
    });
    await asRole("authenticated",homeowner,"aal2",async()=>assert.equal((await member()).properties.length,2));
    await asRole("authenticated",staff,"aal2",async()=>assert.equal((await member()).properties.length,0));
    assert.equal(await scalar("select count(*) from public.contacts where display_name='Historical contact' and contact_verified_at is not null"),0);
    assert.equal(await scalar("select count(distinct contact_id) from public.property_contacts where ownership_verified_at is not null"),1);
    assert.equal(await scalar("select c.display_name from public.user_profiles u join public.contacts c on c.id=u.contact_id where u.user_id=$1",[homeowner]),"Current homeowner");
  });
  await t.test("staff cannot self approve; ending an approved request removes property access on the same day",async()=>{
    await asRole("authenticated",admin,"aal2",async()=>{
      await db.query("insert into public.portal_account_details(user_id,display_name) values($1,'Administrator')",[admin]);
      administratorRequest=await scalar("select public.submit_property_access_request($1,'co_owner','Own request')",[propertyA]);
      await assert.rejects(db.query("select public.review_property_access_request($1,'approved','Self approval')",[administratorRequest]),/cannot review your own/);
      await db.query("select public.review_property_access_request($1,'revoked','Synthetic ownership ended')",[requestA]);
    });
    await asRole("authenticated",homeowner,"aal2",async()=>{
      const view=await member();assert.equal(view.properties.length,1);assert.equal(view.properties[0].id,propertyB);
      assert.equal(view.requests.find((r)=>r.id===requestA).status,"revoked");
    });
  });
  await t.test("occupancy changes and audit/history commit together; repeats do not fabricate history",async()=>{
    await asRole("authenticated",homeowner,"aal2",async()=>{
      await assert.rejects(db.query("select public.update_property_occupancy($1,'rental','Unauthorized')",[propertyB]),/MFA required/);
    });
    await asRole("authenticated",admin,"aal2",async()=>{
      await db.query("select public.update_property_occupancy($1,'rental','Synthetic change')",[propertyB]);
      await db.query("select public.update_property_occupancy($1,'rental','Same value')",[propertyB]);
      await assert.rejects(db.query("select public.update_property_occupancy($1,'invalid','Bad status')",[propertyB]),/Invalid occupancy/);
    });
    assert.equal(await scalar("select count(*) from public.property_occupancy_history where property_id=$1",[propertyB]),1);
    assert.equal(await scalar("select count(*) from private.leadership_audit where action='property_occupancy_updated'"),1);
    await asRole("authenticated",homeowner,"aal2",async()=>assert.equal((await member()).properties[0].occupancy_status,"rental"));
  });
  await t.test("future Director terms grant nothing; a current Director can review another person's request",async()=>{
    await db.query("insert into public.board_member_years(person_id,service_year,starts_on,ends_on,privileges_enabled) values($1,extract(year from current_date)::int+1,make_date(extract(year from current_date)::int+1,1,1),make_date(extract(year from current_date)::int+1,12,31),true)",[person]);
    await asRole("authenticated",staff,"aal2",async()=>{
      assert.equal((await flags()).is_director,false);
      await assert.rejects(db.query("select public.get_staff_workspace()"),/MFA required/);
    });
    await db.query("update public.board_member_years set service_year=extract(year from current_date)::int,starts_on=current_date,ends_on=current_date where person_id=$1",[person]);
    await asRole("authenticated",staff,"aal2",async()=>{
      assert.equal((await flags()).is_director,true);
      assert.equal((await flags()).is_admin,false);
      await db.query("select public.review_property_access_request($1,'approved','Independent synthetic co-owner evidence checked')",[administratorRequest]);
    });
    await asRole("authenticated",admin,"aal2",async()=>assert.equal((await member()).properties[0].id,propertyA));
  });
  await t.test("two separate confirmed accounts can hold approved access to the same lot",async()=>{
    let repeatRequest;
    await asRole("authenticated",homeowner,"aal2",async()=>{repeatRequest=await scalar("select public.submit_property_access_request($1,'owner','New current approval request')",[propertyA]);});
    await asRole("authenticated",staff,"aal2",async()=>db.query("select public.review_property_access_request($1,'approved','Independent new current ownership evidence checked')",[repeatRequest]));
    await asRole("authenticated",homeowner,"aal2",async()=>assert.equal((await member()).properties.length,2));
    await asRole("authenticated",admin,"aal2",async()=>assert.equal((await member()).properties.length,1));
    assert.equal(await scalar("select count(distinct contact_id) from public.property_contacts where property_id=$1 and ownership_verified_at is not null and ended_on is null",[propertyA]),2);
  });
  let serviceContact, publishedPost, draftPost, contractFile, minutesFile, unfinishedFile;
  const reserve = (contactId,postId,size=1000,title="Test PDF",name="test.pdf") => scalar("select to_jsonb(public.reserve_hoa_file($1,$2,$3,$4,$5))",[contactId,postId,title,name,size]);
  const uploadObject = (file,size=1000,mime="application/pdf") => db.query("insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",[file.bucket_id,file.storage_path,JSON.stringify({size,mimetype:mime})]);
  await t.test("members, forged metadata, anonymous and unconfirmed accounts cannot create contacts or publish",async()=>{
    await asRole("anon",null,null,async()=>{
      await assert.rejects(db.query("select * from public.hoa_publications"),/permission denied/);
      assert.equal(await scalar("select count(*) from storage.objects"),0);
    });
    for(const [id,aal] of [[homeowner,"aal2"],[staff,"aal1"]]) await asRole("authenticated",id,aal,async()=>{
      await assert.rejects(db.query("insert into public.hoa_service_contacts(name,purpose) values('Fake vendor','Anything')"),/row-level security/);
      await assert.rejects(db.query("insert into public.hoa_publications(kind,title) values('announcement','Fake update')"),/row-level security/);
      await assert.rejects(db.query("select public.get_hoa_library_usage()"),/MFA required/);
      await assert.rejects(reserve(null,propertyA),/MFA required/);
    });
  });
  await t.test("serving Director can create a custom-purpose contact, edit it, and publish or save a draft",async()=>{
    await asRole("authenticated",staff,"aal2",async()=>{
      serviceContact=await scalar("insert into public.hoa_service_contacts(name,purpose,notes,created_by) values('Pond Specialist','Custom pond service','Private notes',$1) returning id",[homeowner]);
      assert.equal(await scalar("select created_by from public.hoa_service_contacts where id=$1",[serviceContact]),staff);
      await db.query("update public.hoa_service_contacts set phone='555-0101',purpose='Mowing and ponds' where id=$1",[serviceContact]);
      publishedPost=await scalar("insert into public.hoa_publications(kind,title,body,published) values('minutes','Meeting minutes','Member-readable summary',true) returning id");
      draftPost=await scalar("insert into public.hoa_publications(kind,title,body,published) values('announcement','Draft announcement','Unpublished private text',false) returning id");
      assert.equal(await scalar("select count(*) from public.hoa_service_contacts"),1);
    });
    await asRole("authenticated",homeowner,"aal2",async()=>{
      assert.equal(await scalar("select count(*) from public.hoa_service_contacts"),0);
      assert.equal(await scalar("select count(*) from public.hoa_publications"),1);
      assert.equal(await scalar("select title from public.hoa_publications"),"Meeting minutes");
      assert.equal((await db.query("update public.hoa_publications set title='Hacked' returning id")).rows.length,0);
    });
    const pending="00000000-0000-4000-8000-000000000011";
    await asRole("authenticated",pending,"aal2",async()=>assert.equal(await scalar("select count(*) from public.hoa_publications"),0));
    await db.query("update auth.users set is_anonymous=true where id=$1",[homeowner]);
    await asRole("authenticated",homeowner,"aal2",async()=>assert.equal(await scalar("select count(*) from public.hoa_publications"),0));
    await db.query("update auth.users set is_anonymous=false where id=$1",[homeowner]);
  });
  await t.test("uploads reserve full slots, enforce PDF limits, reject arbitrary paths, and verify actual bytes",async()=>{
    await asRole("authenticated",staff,"aal2",async()=>{
      await assert.rejects(reserve(serviceContact,null,2000001),/allowed upload size/);
      await assert.rejects(reserve(null,publishedPost,1000001),/allowed upload size/);
      await assert.rejects(reserve(serviceContact,null,1000,"Image","photo.png"),/Only PDF/);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name,metadata) values('hoa-contracts','arbitrary.pdf','{\"size\":1,\"mimetype\":\"application/pdf\"}')"),/row-level security/);
      contractFile=await reserve(serviceContact,null);
      assert.equal(contractFile.reserved_bytes,2000000);
      assert.equal((await scalar("select public.get_hoa_library_usage()")).allocated_bytes,2000000);
      await assert.rejects(uploadObject(contractFile,2000001),/row-level security/);
      await assert.rejects(uploadObject(contractFile,1000,"image/png"),/row-level security/);
      await uploadObject(contractFile);
      await db.query("select public.finish_hoa_file($1)",[contractFile.id]);
      assert.equal((await scalar("select public.get_hoa_library_usage()")).allocated_bytes,1000);
      unfinishedFile=await reserve(null,publishedPost,2000,"Incomplete PDF");
      await uploadObject(unfinishedFile,1000);
      await assert.rejects(db.query("select public.finish_hoa_file($1)",[unfinishedFile.id]),/incomplete or does not match/);
      minutesFile=await reserve(null,publishedPost);
      await uploadObject(minutesFile);
      await db.query("select public.finish_hoa_file($1)",[minutesFile.id]);
      const draftFile=await reserve(null,draftPost);
      await uploadObject(draftFile);
      await db.query("select public.finish_hoa_file($1)",[draftFile.id]);
      assert.equal(await scalar("select ready from public.hoa_library_files where id=$1",[unfinishedFile.id]),false);
    });
  });
  await t.test("member downloads allow only finished published PDFs; contracts, drafts and incomplete PDFs stay private",async()=>{
    await asRole("anon",null,null,async()=>assert.equal(await scalar("select count(*) from storage.objects"),0));
    await asRole("authenticated",homeowner,"aal1",async()=>{
      assert.equal(await scalar("select count(*) from public.hoa_library_files"),1);
      assert.equal(await scalar("select count(*) from storage.objects"),1);
      await assert.rejects(uploadObject(contractFile),/row-level security/);
      assert.equal((await db.query("delete from storage.objects returning id")).rows.length,0);
    });
    await asRole("authenticated",staff,"aal2",async()=>db.query("update public.hoa_publications set published=false where id=$1",[publishedPost]));
    await asRole("authenticated",homeowner,"aal2",async()=>{
      assert.equal(await scalar("select count(*) from public.hoa_library_files"),0);
      assert.equal(await scalar("select count(*) from storage.objects"),0);
    });
    await asRole("authenticated",staff,"aal2",async()=>db.query("update public.hoa_publications set published=true where id=$1",[publishedPost]));
  });
  await t.test("library budget cannot be bypassed with small declarations; removal requires deleting the physical object first",async()=>{
    await asRole("authenticated",staff,"aal2",async()=>{
      await assert.rejects(db.query("delete from public.hoa_library_files where id=$1",[contractFile.id]),/permission denied/);
      await assert.rejects(db.query("select public.remove_hoa_file($1)",[contractFile.id]),/Remove the stored PDF/);
      await db.query("delete from storage.objects where bucket_id=$1 and name=$2",[contractFile.bucket_id,contractFile.storage_path]);
      await db.query("select public.remove_hoa_file($1)",[contractFile.id]);
    });
    const baseline=Number(await scalar("select sum(reserved_bytes) from public.hoa_library_files"));
    await db.query("insert into public.hoa_library_files(contact_id,bucket_id,storage_path,title,original_filename,expected_bytes,reserved_bytes,created_by) select $1,'hoa-contracts','fixture-'||n||'.pdf','Quota fixture','test.pdf',1,least(2000000,500000000-$2-((n-1)*2000000)),$3 from generate_series(1,ceil((500000000-$2)/2000000.0)::int) n",[serviceContact,baseline,staff]);
    await asRole("authenticated",staff,"aal2",async()=>{
      assert.equal((await scalar("select public.get_hoa_library_usage()")).allocated_bytes,500000000);
      await assert.rejects(reserve(serviceContact,null,1),/500 MB library budget/);
      await assert.rejects(db.query("update public.hoa_library_files set reserved_bytes=1"),/permission denied/);
    });
    await db.query("delete from public.hoa_library_files where title='Quota fixture'");
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('hoa-private-documents','other-project-fixture.pdf','{\"size\":799999000}')");
    await asRole("authenticated",staff,"aal2",async()=>await assert.rejects(reserve(serviceContact,null,1),/Project storage is near/));
    await db.query("delete from storage.objects where name='other-project-fixture.pdf'");
  });
  await t.test("role revocation immediately removes contacts, contract and upload access; a serving Officer alone has access",async()=>{
    await db.query("update public.board_member_years set privileges_enabled=false where person_id=$1",[person]);
    await asRole("authenticated",staff,"aal2",async()=>{
      assert.equal(await scalar("select count(*) from public.hoa_service_contacts"),0);
      await assert.rejects(reserve(serviceContact,null),/MFA required/);
    });
    await db.query("update public.officer_member_years set position_code='secretary',privileges_enabled=true,starts_on=current_date,ends_on=current_date where person_id=$1 and source='administrative_entry'",[person]);
    await asRole("authenticated",staff,"aal2",async()=>{
      assert.equal((await flags()).is_director,false); assert.equal((await flags()).is_officer,true);
      assert.equal(await scalar("select count(*) from public.hoa_service_contacts"),1);
      await db.query("update public.hoa_service_contacts set archived=true where id=$1",[serviceContact]);
      await assert.rejects(reserve(serviceContact,null),/active contact/);
    });
  });
});
