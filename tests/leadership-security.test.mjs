import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { managementTests } from "./management-fixtures.mjs";

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
  await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz, is_anonymous boolean default false,
      email_change text default '',raw_app_meta_data jsonb default '{"provider":"email"}', raw_user_meta_data jsonb default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),aal text,not_after timestamptz);
    create schema vault;
    -- API/permission stand-in only. Encryption is checked against real hosted Vault.
    create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text,name text,description text);
    create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(new_secret text,new_name text default null,new_description text default null) returns uuid language sql as $$
      insert into vault.secrets(secret,name,description) values(new_secret,new_name,new_description) returning id; $$;
    create function vault.update_secret(secret_id uuid,new_secret text) returns void language sql as $$update vault.secrets set secret=new_secret where id=secret_id;$$;
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
  await db.exec(await migration("private_member_resources"));
  await db.exec(await migration("rental_member_access"));
  await db.exec(await migration("rental_review_index"));
  await db.exec((await migration("member_details_events_and_service_vault")).replace('create extension if not exists supabase_vault with schema vault;',''));
  await db.exec(await migration('household_value_validation'));
  await db.exec(await migration('explicit_occupancy_and_notification_email'));
  await db.exec(await migration('typed_signup_passcode'));
  await db.exec(await migration('passcode_ticket_cleanup_safeupdate'));
  await db.exec(await migration('member_onboarding_and_workspace_access'));
  await db.exec(await migration('property_management_and_treasury'));
  async function asRole(role, uid, aal, fn, claims = {}) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(uid ? { sub: uid, aal, ...claims, user_metadata: { role: "admin", is_director: true } } : {})]);
    await db.exec(`set role ${role}`);
    try { return await fn(); } finally { await db.exec("reset role"); await db.exec("select set_config('request.jwt.claims','{}',false)"); }
  }
  const scalar = async (sql, params=[]) => Object.values((await db.query(sql,params)).rows[0])[0];
  const flags = () => scalar("select public.get_portal_flags()");
  await t.test("anonymous roster and direct tables expose only current published leadership", async () => {
    await asRole("anon", null, null, async () => {
      const roster = await scalar("select public.get_public_leadership_roster()");
      assert.equal(roster.board.length,5);
      assert.equal(roster.officers.length,4);
      assert.ok(roster.board.every(row=>row.kind!=='historical'));
      assert.equal(await scalar("select count(*) from public.board_member_years"),5);
      assert.equal(await scalar("select count(*) from public.officer_member_years"),4);
      assert.ok(await scalar("select count(*) from public.leadership_people") < 10);
      await assert.rejects(db.query("select public.get_member_leadership_history()"),/permission denied/);
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
  await t.test("approved members can read historical leadership and bylaws; pending, anonymous and unconfirmed accounts cannot",async()=>{
    await asRole('authenticated',homeowner,'aal1',()=>assert.rejects(db.query('select public.get_member_leadership_history()'),/required/));
    await db.exec(`insert into public.properties(id,lot_number,street_address) values('00000000-0000-4000-8000-000000000090',90,'Approved fixture home');
      insert into public.contacts(id,display_name,contact_verified_at) values('00000000-0000-4000-8000-000000000091','Approved fixture',now());
      insert into public.user_profiles(user_id,contact_id) values('${homeowner}','00000000-0000-4000-8000-000000000091');
      insert into public.property_contacts(id,property_id,contact_id,relationship,started_on,ownership_verified_at) values('00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000090','00000000-0000-4000-8000-000000000091','owner',current_date,now());
      insert into private.property_access_requests(user_id,property_id,status,requested_relationship,property_contact_id) values('${homeowner}','00000000-0000-4000-8000-000000000090','approved','owner','00000000-0000-4000-8000-000000000092');`);
    await db.exec("insert into storage.objects(bucket_id,name,metadata) values('hoa-member-governance','plum-creek-bylaws.pdf','{\"size\":3600000,\"mimetype\":\"application/pdf\"}')");
    await asRole('authenticated',homeowner,'aal1',async()=>{
      const history=await scalar('select public.get_member_leadership_history()');
      assert.equal(history.board.length,86);
      assert.ok(history.board.some(row=>row.kind==='historical'));
      assert.equal((await scalar('select public.get_public_leadership_roster()')).board.length,5);
      assert.equal(await scalar("select count(*) from storage.objects where bucket_id='hoa-member-governance'"),1);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('hoa-member-governance','unauthorized.pdf')"),/row-level security/);
      assert.equal((await db.query("update storage.objects set name='changed.pdf' where bucket_id='hoa-member-governance' returning id")).rows.length,0);
    });
    await asRole('anon',null,null,async()=>assert.equal(await scalar("select count(*) from storage.objects where bucket_id='hoa-member-governance'"),0));
    await db.query('update auth.users set email_confirmed_at=null where id=$1',[homeowner]);
    await asRole('authenticated',homeowner,'aal1',async()=>{
      await assert.rejects(db.query('select public.get_member_leadership_history()'),/Confirmed member/);
      assert.equal(await scalar("select count(*) from storage.objects where bucket_id='hoa-member-governance'"),0);
      assert.equal(await scalar("select count(*) from public.board_member_years where record_kind='historical'"),0);
    });
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[homeowner]);
    await db.exec(`delete from storage.objects where bucket_id='hoa-member-governance';
      delete from private.property_access_requests where property_id='00000000-0000-4000-8000-000000000090';
      delete from public.property_contacts where id='00000000-0000-4000-8000-000000000092';
      delete from public.user_profiles where user_id='${homeowner}';
      delete from public.contacts where id='00000000-0000-4000-8000-000000000091';
      delete from public.properties where id='00000000-0000-4000-8000-000000000090';`);
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
  await t.test("administrator appointment and display-name edits update the current public roster immediately",async()=>{
    const appointment=await scalar("select id from public.board_member_years where service_year=2026 and record_kind='director' and not privileges_enabled limit 1");
    const original=(await db.query('select * from public.board_member_years where id=$1',[appointment])).rows[0];
    const originalName=await scalar('select display_name from public.leadership_people where id=$1',[original.person_id]);
    await asRole('authenticated',admin,'aal2',async()=>{
      await db.query("update public.leadership_people set display_name='Updated roster fixture' where id=$1",[original.person_id]);
      await db.query("update public.board_member_years set seat_label='Updated term fixture' where id=$1",[appointment]);
    });
    await asRole('anon',null,null,async()=>{
      const row=(await scalar('select public.get_public_leadership_roster()')).board.find(row=>row.id===appointment);
      assert.equal(row.name,'Updated roster fixture'); assert.equal(row.term,'Updated term fixture');
    });
    await asRole('authenticated',admin,'aal2',async()=>db.query('update public.board_member_years set published=false where id=$1',[appointment]));
    await asRole('anon',null,null,async()=>assert.equal((await scalar('select public.get_public_leadership_roster()')).board.some(row=>row.id===appointment),false));
    await asRole('authenticated',homeowner,'aal2',async()=>assert.equal((await db.query('update public.board_member_years set published=true where id=$1 returning id',[appointment])).rows.length,0));
    await db.query('update public.leadership_people set display_name=$1 where id=$2',[originalName,original.person_id]);
    await db.query('update public.board_member_years set published=$1,seat_label=$2 where id=$3',[original.published,original.seat_label,appointment]);
  });
  await t.test("rotation invalidates outstanding tickets and old passcode", async () => {
    const issued=await ticket("rotating@example.test");
    await asRole("authenticated",admin,"aal2",async () => db.query("select public.rotate_homeowner_signup_passcode()"));
    await assert.rejects(newUser("00000000-0000-4000-8000-000000000015","rotating@example.test",issued.ticket),/passcode is required/);
    assert.ok((await ticket("rotating@example.test",code)).error);
    code=await scalar("select passcode from private.signup_passcode");
    assert.ok((await ticket("rotating@example.test",code)).ticket);
  });
  await t.test("chosen passcodes require administrator MFA, validate without changing tickets, normalize and return the saved code", async () => {
    const original=await scalar('select row_to_json(c) from private.signup_passcode c');
    const issued=await ticket('typed-code@example.test');
    for(const [role,uid,aal] of [['anon',null,null],['authenticated',homeowner,'aal2'],['authenticated',staff,'aal2'],['authenticated',admin,'aal1']]) {
      await asRole(role,uid,aal,async()=>assert.rejects(db.query('select public.replace_homeowner_signup_passcode($1)',['Fixture-Code-2026']),/permission denied|Administrator login/));
    }
    await asRole('authenticated',admin,'aal2',async()=>{
      for(const invalid of [null,'','short','WITH SPACES','CODE_2026','X'.repeat(65)]) {
        await assert.rejects(db.query('select public.replace_homeowner_signup_passcode($1)',[invalid]),/8–64/);
      }
      await assert.rejects(db.query('select public.replace_homeowner_signup_passcode($1)',[original.passcode.toLowerCase()]),/already in use/);
    });
    assert.deepEqual(await scalar('select row_to_json(c) from private.signup_passcode c'),original);
    assert.ok(await scalar('select exists(select 1 from private.signup_tickets where ticket_hash=encode(sha256(convert_to($1,\'UTF8\')),\'hex\'))',[issued.ticket]));
    const auditBefore=await scalar("select count(*) from private.leadership_audit where action='signup_code_rotated'");
    const saved=await asRole('authenticated',admin,'aal2',()=>scalar('select public.replace_homeowner_signup_passcode($1)',['  Fixture-Code-2026  ']));
    assert.equal(saved.passcode,'FIXTURE-CODE-2026');assert.equal(saved.enabled,true);assert.ok(saved.updated_at);
    assert.notEqual(await scalar('select version from private.signup_passcode'),original.version);
    assert.equal(await scalar('select count(*) from private.signup_tickets'),0);
    assert.equal(await scalar("select count(*) from private.leadership_audit where action='signup_code_rotated'"),auditBefore+1);
    assert.equal(await scalar("select count(*) from private.leadership_audit where details::text ilike '%fixture-code-2026%'"),0);
    assert.ok((await ticket('typed-code@example.test',original.passcode)).error);
    await assert.rejects(newUser('00000000-0000-4000-8000-000000000016','typed-code@example.test',issued.ticket),/passcode is required/);
    assert.ok((await ticket('typed-code@example.test',' fixture-code-2026 ')).ticket);
    code=saved.passcode;
  });
  await t.test("passcode cleanup meets API safeupdate rules and retains tickets for the current version", async () => {
    // PGlite does not ship the API's safeupdate module. Enforce its WHERE rule
    // against the effective function, then exercise that statement with fixtures.
    const body=await scalar("select prosrc from pg_proc where oid='private.replace_signup_passcode(text)'::regprocedure");
    const cleanup=body.match(/delete\s+from\s+private\.signup_tickets\b[^;]*;/i)?.[0];
    assert.ok(cleanup);assert.match(cleanup,/\bwhere\b/i);
    const current=await scalar('select version from private.signup_passcode');
    const obsolete='00000000-0000-4000-8000-000000000099';
    await db.exec('create temporary table cleanup_fixture(passcode_version uuid not null)');
    await db.query('insert into cleanup_fixture values($1),($2)',[current,obsolete]);
    await db.exec(cleanup.replace('private.signup_tickets','cleanup_fixture').replace('v_code.version',`'${current}'::uuid`));
    assert.deepEqual((await db.query('select passcode_version from cleanup_fixture')).rows,[{passcode_version:current}]);
    await db.exec('drop table cleanup_fixture');
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
  await t.test("administrator self-review is explicit and audited; ending approved access takes effect the same day",async()=>{
    await db.exec('begin');
    await asRole("authenticated",admin,"aal2",async()=>{
      await db.query("insert into public.portal_account_details(user_id,display_name) values($1,'Administrator')",[admin]);
      administratorRequest=await scalar("select public.submit_property_access_request($1,'co_owner','Own request')",[propertyA]);
      await db.exec('savepoint administrator_self_review');
      await db.query("select public.review_property_access_request($1,'approved','Synthetic current deed checked for administrator self-review')",[administratorRequest]);
      assert.equal((await member()).properties.some(p=>p.id===propertyA),true);
      await db.exec('rollback to savepoint administrator_self_review');
      await db.exec('release savepoint administrator_self_review');
      await db.query("select public.review_property_access_request($1,'revoked','Synthetic ownership ended')",[requestA]);
    });
    await asRole("authenticated",homeowner,"aal2",async()=>{
      const view=await member();assert.equal(view.properties.length,1);assert.equal(view.properties[0].id,propertyB);
      assert.equal(view.requests.find((r)=>r.id===requestA).status,"revoked");
    });
    await db.exec('commit');
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
    await asRole("authenticated",homeowner,"aal2",async()=>{ assert.equal((await member()).properties.length,0); assert.equal((await scalar("select public.get_member_access()")).allowed,false); });
    await asRole("authenticated",admin,"aal2",()=>db.query("select public.update_property_occupancy($1,'owner_occupied','Synthetic restoration')",[propertyB]));
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
  let lease;
  const reserveLease=(id=requestB,start='2000-01-01',end='2100-12-31',size=1000,name='lease.pdf')=>scalar('select public.reserve_rental_agreement($1,$2,$3,$4,$5)',[id,name,size,start,end]);
  const access=()=>scalar('select public.get_member_access()');
  const removeLease=async(file)=>{await db.query('delete from storage.objects where bucket_id=$1 and name=$2',[file.bucket_id,file.storage_path]);await db.query('select public.remove_rental_agreement($1)',[file.id]);};
  await t.test('admin rental flag blocks library, history and property details while contact and upload access stay open',async()=>{
    await asRole('authenticated',admin,'aal2',()=>db.query("select public.update_property_occupancy($1,'rental','Synthetic rental requirement')",[propertyB]));
    await db.exec("insert into storage.objects(bucket_id,name,metadata) values('hoa-member-governance','plum-creek-bylaws.pdf','{\"size\":3600000,\"mimetype\":\"application/pdf\"}')");
    await asRole('authenticated',homeowner,'aal1',async()=>{
      assert.equal((await access()).allowed,false);
      assert.equal((await access()).rental_requirements[0].lot_number,2);
      assert.equal((await member()).properties.length,1);
      assert.equal((await member()).properties[0].id,propertyA);
      assert.equal(await scalar('select count(*) from public.hoa_publications'),0);
      assert.equal(await scalar('select count(*) from public.hoa_library_files'),0);
      assert.equal(await scalar("select count(*) from public.board_member_years where record_kind='historical'"),0);
      assert.equal(await scalar('select count(*) from storage.objects'),0);
      await assert.rejects(db.query('select public.get_member_leadership_history()'),/rental paperwork required/);
      await assert.rejects(db.query('select public.set_property_rental($1,false)',[requestB]),/HOA has marked/);
      await db.query("update public.portal_account_details set phone='555-0102' where user_id=$1",[homeowner]);
      assert.equal((await scalar('select public.get_rental_workspace()')).properties.length,2);
      await assert.rejects(db.query('select public.get_staff_rental_workspace()'),/Authorized account/);
      await assert.rejects(reserveLease(administratorRequest),/own active property/);
      await assert.rejects(reserveLease(requestB,null),/Both lease dates/);
      await assert.rejects(reserveLease(requestB,'2100-01-01','2000-01-01'),/Both lease dates/);
      await assert.rejects(reserveLease(requestB,'2000-01-01','2100-01-01',2000001),/2 MB/);
      await assert.rejects(reserveLease(requestB,'2000-01-01','2100-01-01',1000,'bad.png'),/2 MB/);
      await assert.rejects(db.query("insert into public.property_documents(property_id,category,document_title,storage_path) values($1,'lease','Forged','fake.pdf')",[propertyB]),/permission denied/);
    });
  });
  await t.test('rental reservations are private and immutable; only completed matching PDF bytes unlock access',async()=>{
    await asRole('anon',null,null,async()=>{await assert.rejects(reserveLease(),/permission denied/);await assert.rejects(db.query('select * from public.rental_agreements'),/permission denied/);});
    await asRole('authenticated',homeowner,'aal1',async()=>{
      lease=await reserveLease();
      assert.equal(await scalar('select reserved_bytes from public.property_documents where id=$1',[lease.id]),2000000);
      assert.equal((await access()).allowed,false);
      await assert.rejects(reserveLease(),/incomplete lease upload/);
      await assert.rejects(db.query('select public.finish_rental_agreement($1)',[lease.id]),/incomplete/);
      await assert.rejects(uploadObject({...lease,storage_path:'arbitrary.pdf'}),/row-level security/);
      await assert.rejects(uploadObject(lease,2000001),/row-level security/);
      await assert.rejects(uploadObject(lease,1000,'image/png'),/row-level security/);
      await assert.rejects(db.query('update public.property_documents set ready=true where id=$1',[lease.id]),/permission denied/);
    });
    await asRole('authenticated',admin,'aal1',async()=>{
      assert.equal(await scalar("select count(*) from public.property_documents where id=$1",[lease.id]),0);
      await assert.rejects(db.query('select public.finish_rental_agreement($1)',[lease.id]),/upload access/);
      await assert.rejects(uploadObject(lease),/row-level security/);
    });
    await asRole('authenticated',homeowner,'aal1',async()=>{
      await uploadObject(lease);
      assert.equal((await access()).allowed,false);
      await db.query('select public.finish_rental_agreement($1)',[lease.id]);
      assert.equal((await access()).allowed,true);
      assert.equal((await member()).properties.length,2);
      assert.equal(await scalar('select count(*) from public.hoa_publications'),1);
      assert.equal(await scalar('select count(*) from public.hoa_library_files'),1);
      assert.equal(await scalar("select count(*) from storage.objects where bucket_id='hoa-member-governance'"),1);
      assert.ok((await scalar('select public.get_member_leadership_history()')).board.length>5);
      assert.equal((await db.query("update storage.objects set metadata='{}' where bucket_id=$1 and name=$2 returning id",[lease.bucket_id,lease.storage_path])).rows.length,0);
      await assert.rejects(db.query('select public.remove_rental_agreement($1)',[lease.id]),/Remove the stored PDF/);
    });
    await db.query('update auth.users set email_confirmed_at=null where id=$1',[homeowner]);
    await asRole('authenticated',homeowner,'aal1',async()=>{await assert.rejects(reserveLease(),/Confirmed account/);assert.equal(await scalar('select count(*) from public.property_documents'),0);});
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[homeowner]);
  });
  await t.test('expired, future, rejected, missing-object leases restrict access immediately',async()=>{
    for(const [start,end] of [['2000-01-01','2001-01-01'],['2099-01-01','2100-01-01']]){
      await db.query('update public.rental_agreements set lease_start=$1,lease_end=$2 where id=$3',[start,end,lease.agreement_id]);
      await asRole('authenticated',homeowner,'aal1',async()=>assert.equal((await access()).allowed,false));
    }
    await db.query("update public.rental_agreements set lease_start='2000-01-01',lease_end='2100-12-31' where id=$1",[lease.agreement_id]);
    await asRole('authenticated',staff,'aal1',async()=>await assert.rejects(db.query("select public.reject_rental_agreement($1,'Needs correction')",[lease.agreement_id]),/MFA required/));
    await asRole('authenticated',staff,'aal2',async()=>{assert.equal((await scalar('select public.get_staff_rental_workspace()')).properties.find(p=>p.request_id===requestB).files.length,1);await db.query("select public.reject_rental_agreement($1,'Replace the incorrect dates')",[lease.agreement_id]);});
    await asRole('authenticated',homeowner,'aal1',async()=>{
      await db.query('select public.finish_rental_agreement($1)',[lease.id]);
      assert.equal((await access()).allowed,false);
      assert.equal((await scalar('select public.get_rental_workspace()')).properties.find(p=>p.request_id===requestB).files[0].review_note,'Replace the incorrect dates');
    });
    await db.query("update public.rental_agreements set agreement_status='received' where id=$1",[lease.agreement_id]);
    await asRole('authenticated',homeowner,'aal1',async()=>{
      await db.query('delete from storage.objects where bucket_id=$1 and name=$2',[lease.bucket_id,lease.storage_path]);
      assert.equal((await access()).allowed,false);
      await db.query('select public.remove_rental_agreement($1)',[lease.id]);
      lease=await reserveLease();await uploadObject(lease);await db.query('select public.finish_rental_agreement($1)',[lease.id]);
    });
  });
  await t.test('pending rental claim does not alter other owners; verified co-owners share leases after their own proof and approval',async()=>{
    let adminB,otherLease;
    await asRole('authenticated',admin,'aal1',async()=>{
      adminB=await scalar("select public.request_property_verification($1,'co_owner','Synthetic co-owner',true)",[propertyB]);
      assert.equal((await access()).allowed,false);
      assert.equal(await scalar('select count(*) from public.property_documents where id=$1',[lease.id]),0);
    });
    await asRole('authenticated',staff,'aal2',async()=>await assert.rejects(db.query("select public.review_property_access_request($1,'approved','Independent proof')",[adminB]),/current rental agreement/));
    await asRole('authenticated',admin,'aal1',async()=>{otherLease=await reserveLease(adminB);await uploadObject(otherLease);await db.query('select public.finish_rental_agreement($1)',[otherLease.id]);assert.equal((await access()).allowed,true);});
    await asRole('authenticated',staff,'aal2',()=>db.query("select public.reject_rental_agreement($1,'Synthetic rejection to check unverified co-owner isolation')",[lease.agreement_id]));
    await asRole('authenticated',homeowner,'aal1',async()=>assert.equal((await access()).allowed,false));
    await db.query("update public.rental_agreements set agreement_status='received',notes=null where id=$1",[lease.agreement_id]);
    await asRole('authenticated',staff,'aal2',()=>db.query("select public.review_property_access_request($1,'approved','Independent synthetic co-owner proof')",[adminB]));
    await asRole('authenticated',admin,'aal1',async()=>{
      await removeLease(otherLease);
      assert.equal((await access()).allowed,true);
      assert.equal(await scalar('select count(*) from public.property_documents where id=$1',[lease.id]),1);
      assert.equal((await scalar('select public.get_rental_workspace()')).properties.find(p=>p.request_id===adminB).files[0].can_remove,false);
      await assert.rejects(db.query('select public.remove_rental_agreement($1)',[lease.id]),/removal access/);
    });
    await asRole('authenticated',staff,'aal2',()=>db.query("select public.review_property_access_request($1,'revoked','Synthetic removal')",[adminB]));
    await asRole('authenticated',admin,'aal1',async()=>assert.equal(await scalar('select count(*) from public.property_documents where id=$1',[lease.id]),0));
    const propertyC='00000000-0000-4000-8000-000000000023';let reqC;
    await db.query("insert into public.properties(id,lot_number,street_address) values($1,3,'Test address C')",[propertyC]);
    await asRole('authenticated',homeowner,'aal1',async()=>{reqC=await scalar("select public.request_property_verification($1,'owner','Self-reported rental',true)",[propertyC]);assert.equal((await access()).allowed,false);});
    assert.equal(await scalar('select occupancy_status from public.properties where id=$1',[propertyC]),'unknown');
    await asRole('authenticated',admin,'aal1',async()=>assert.equal((await access()).allowed,true));
    await asRole('authenticated',homeowner,'aal1',()=>db.query('select public.set_property_rental($1,false)',[reqC]));
  });
  await t.test('lease retention, rental budget and shared project reservation limit cannot be bypassed',async()=>{
    await asRole('authenticated',homeowner,'aal1',async()=>{
      const second=await reserveLease();await uploadObject(second);await db.query('select public.finish_rental_agreement($1)',[second.id]);
      const third=await reserveLease();await uploadObject(third);await db.query('select public.finish_rental_agreement($1)',[third.id]);
      await assert.rejects(reserveLease(),/at most three/);await removeLease(second);await removeLease(third);
    });
    await db.query("insert into public.property_documents(property_id,category,document_title,storage_bucket,storage_path,reserved_bytes) select $1,'lease','Budget fixture','hoa-rental-agreements','quota-'||n||'.pdf',2000000 from generate_series(1,125) n",[propertyB]);
    await asRole('authenticated',homeowner,'aal1',async()=>await assert.rejects(reserveLease(),/250 MB rental document budget/));
    await db.query("delete from public.property_documents where document_title='Budget fixture'");
    const existingPending=Number(await scalar('select private.pending_storage_bytes()'));
    const existingStored=Number(await scalar("select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects"));
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('hoa-private-documents','rental-quota-test.pdf',$1)",[JSON.stringify({size:800000000-existingPending-existingStored-2500000})]);
    let libraryPending;
    await asRole('authenticated',staff,'aal2',async()=>{libraryPending=await reserve(null,publishedPost,1);});
    await asRole('authenticated',homeowner,'aal1',async()=>await assert.rejects(reserveLease(),/Project storage is near/));
    await asRole('authenticated',staff,'aal2',()=>db.query('select public.remove_hoa_file($1)',[libraryPending.id]));
    let incomplete;
    await asRole('authenticated',homeowner,'aal1',async()=>{incomplete=await reserveLease();await assert.rejects(reserveLease(administratorRequest),/own active/);});
    await asRole('authenticated',staff,'aal2',async()=>await assert.rejects(reserve(null,publishedPost,1),/Project storage is near/));
    await asRole('authenticated',homeowner,'aal1',()=>removeLease(incomplete));
    await db.query("delete from storage.objects where name='rental-quota-test.pdf'");
    await asRole('authenticated',staff,'aal2',()=>db.query("select public.review_property_access_request($1,'revoked','Synthetic rental owner ended')",[requestB]));
    await asRole('authenticated',homeowner,'aal1',async()=>{
      assert.equal(await scalar('select count(*) from public.property_documents where id=$1',[lease.id]),0);
      assert.equal(await scalar("select count(*) from storage.objects where bucket_id='hoa-rental-agreements'"),0);
      await assert.rejects(reserveLease(),/own active property/);
    });
    await asRole('authenticated',staff,'aal2',async()=>assert.equal((await scalar('select public.get_staff_rental_workspace()')).properties.find(p=>p.request_id===requestB).files[0].id,lease.id));
  });
  await t.test('structured profiles and notice consent use only the confirmed owner and server timestamps',async()=>{
    const details={first_name:'Sample',last_name:'Owner',mailing_street:'123 Fixture Lane',mailing_city:'Gardner',mailing_state:'KS',mailing_postal_code:'66030',mailing_country:'US',user_id:admin};
    await asRole('anon',null,null,()=>assert.rejects(db.query('select public.get_member_profile()'),/permission denied/));
    await asRole('authenticated',homeowner,'aal1',async()=>{
      assert.equal((await scalar('select public.get_member_profile()')).notice_consent,false);
      await db.query('select public.save_member_profile($1,true)',[JSON.stringify(details)]);
      const profile=await scalar('select public.get_member_profile()');
      assert.equal(profile.details.first_name,'Sample');assert.equal(profile.details.mailing_postal_code,'66030');assert.equal(profile.details.user_id,homeowner);
      assert.equal(profile.notice_consent,true);assert.ok(profile.consented_at);assert.equal(profile.email,'homeowner@example.test');
      await db.query('select public.save_member_profile($1,true)',[JSON.stringify(details)]);
      await assert.rejects(db.query('select * from private.email_notice_preferences'),/permission denied/);
      await assert.rejects(db.query('select public.save_member_profile($1,true)',[JSON.stringify({...details,last_name:''})]),/first and last names/);
    });
    assert.equal(await scalar('select count(*) from private.email_notice_history where user_id=$1',[homeowner]),1);
    assert.equal(await scalar('select email_at_consent from private.email_notice_preferences where user_id=$1',[homeowner]),'homeowner@example.test');
    await asRole('authenticated',homeowner,'aal1',()=>db.query('select public.save_member_profile($1,false)',[JSON.stringify(details)]));
    assert.equal(await scalar('select count(*) from private.email_notice_history where user_id=$1',[homeowner]),2);
    assert.equal(await scalar('select consented_at from private.email_notice_preferences where user_id=$1',[homeowner]),null);
    assert.equal(await scalar("select display_name from public.contacts where display_name='Historical contact'"),'Historical contact');
    await asRole('authenticated',staff,'aal2',async()=>{
      const r=(await scalar('select public.get_staff_workspace()')).requests.find(r=>r.user_id===homeowner);assert.equal(r.email_notice_consent,false);
    });
  });
  let householdRequest;
  await db.exec("insert into public.properties(id,lot_number,street_address) values('00000000-0000-4000-8000-000000000025',5,'Household fixture')");
  await asRole('authenticated',homeowner,'aal1',async()=>{householdRequest=await scalar("select public.request_property_verification('00000000-0000-4000-8000-000000000025','owner','Current fixture',false)");});
  await t.test('household members and trust details are private records and confer no account or ownership access',async()=>{
    const details={additional_members:[{first_name:'Joint',last_name:'Owner',relationship:'co_owner',email:'joint@example.test'}],is_trust:true,trust_name:'Fixture Family Trust',decision_first_name:'Decision',decision_last_name:'Maker'};
    await asRole('authenticated',homeowner,'aal1',async()=>{
      await db.query('select public.save_property_household($1,$2)',[householdRequest,JSON.stringify(details)]);
      const row=(await scalar('select public.get_property_households()')).properties.find(p=>p.request_id===householdRequest);
      assert.equal(row.household.trust_name,'Fixture Family Trust');assert.equal(row.household.additional_members.length,1);
      await assert.rejects(db.query('select public.save_property_household($1,$2)',[administratorRequest,JSON.stringify(details)]),/own active/);
      await assert.rejects(db.query('select public.save_property_household($1,$2)',[householdRequest,JSON.stringify({...details,trust_name:''})]),/trust name/);
      await assert.rejects(db.query('select public.save_property_household($1,$2)',[householdRequest,JSON.stringify({...details,additional_members:[{...details.additional_members[0],role:'admin'}]})]),/first name/);
      await assert.rejects(db.query('select public.save_property_household($1,$2)',[householdRequest,JSON.stringify({...details,additional_members:Array(11).fill(details.additional_members[0])})]),/at most ten/);
      await assert.rejects(db.query('select public.save_property_household($1,$2)',[householdRequest,JSON.stringify({...details,additional_members:[{...details.additional_members[0],email:{unexpected:'object'}}]})]),/first name/);
      await assert.rejects(db.query('select public.get_staff_property_households()'),/Authorized account/);
    });
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query('select public.save_property_household($1,$2)',[householdRequest,JSON.stringify(details)]),/own active/));
    await asRole('authenticated',staff,'aal2',async()=>assert.ok((await scalar('select public.get_staff_property_households()')).properties.some(p=>p.household.trust_name==='Fixture Family Trust')));
    assert.equal(await scalar("select count(*) from auth.users where email='joint@example.test'"),0);
    assert.equal(await scalar('select status from private.property_access_requests where id=$1',[householdRequest]),'pending');
  });
  await t.test('calendar publishing enforces staff MFA, public/member visibility and drafts at database level',async()=>{
    let event;
    await asRole('authenticated',homeowner,'aal2',()=>assert.rejects(db.query("insert into public.hoa_events(title,event_date) values('Unauthorized',current_date+1)"),/row-level security|Leadership with MFA/));
    await asRole('authenticated',staff,'aal1',()=>assert.rejects(db.query("insert into public.hoa_events(title,event_date) values('Unauthorized',current_date+1)"),/row-level security|Leadership with MFA/));
    await asRole('authenticated',staff,'aal2',async()=>{
      event=await scalar("insert into public.hoa_events(title,event_date,published,created_by) values('Calendar fixture',current_date+1,true,$1) returning id",[homeowner]);
      assert.equal(await scalar('select created_by from public.hoa_events where id=$1',[event]),staff);
    });
    await asRole('anon',null,null,async()=>{assert.ok((await scalar('select public.get_public_events()')).some(e=>e.id===event));await assert.rejects(db.query('select public.get_member_events()'),/permission denied/);});
    await asRole('authenticated',admin,'aal2',()=>db.query("update public.hoa_events set visibility='members',cancelled=true where id=$1",[event]));
    await asRole('anon',null,null,async()=>{assert.equal((await scalar('select public.get_public_events()')).some(e=>e.id===event),false);assert.equal(await scalar('select count(*) from public.hoa_events where id=$1',[event]),0);});
    await asRole('authenticated',homeowner,'aal1',async()=>assert.equal((await scalar('select public.get_member_events()')).find(e=>e.id===event).cancelled,true));
    await db.query('update private.property_access_requests set declared_rental=true where id=$1',[householdRequest]);
    await asRole('authenticated',homeowner,'aal1',async()=>{await assert.rejects(db.query('select public.get_member_events()'),/rental paperwork/);assert.equal(await scalar('select count(*) from public.hoa_events where id=$1',[event]),0);});
    await db.query('update private.property_access_requests set declared_rental=false where id=$1',[householdRequest]);
    await asRole('authenticated',staff,'aal2',()=>db.query('update public.hoa_events set published=false where id=$1',[event]));
    await asRole('authenticated',homeowner,'aal1',async()=>assert.equal((await scalar('select public.get_member_events()')).some(e=>e.id===event),false));
    assert.equal(await scalar("select count(*) from public.hoa_events where source_key='events-txt:2026-10-09:Annual Meeting'"),1);
  });
  const vaultSession='00000000-0000-4000-8000-000000000099';
  await db.query("insert into auth.sessions(id,user_id,aal) values($1,$2,'aal2')",[vaultSession,admin]);
  const vaultClaims=(age=0)=>({session_id:vaultSession,amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)-age}]});
  await t.test('safe requires administrator, live MFA session, fresh authenticator verification and timed unlock',async()=>{
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query('select public.unlock_service_vault()'),/active session/));
    await asRole('authenticated',admin,'aal1',()=>assert.rejects(db.query('select public.unlock_service_vault()'),/Administrator/),vaultClaims());
    await asRole('authenticated',staff,'aal2',()=>assert.rejects(db.query('select public.unlock_service_vault()'),/Administrator/),vaultClaims());
    await asRole('authenticated',homeowner,'aal2',()=>assert.rejects(db.query('select public.unlock_service_vault()'),/Administrator/),vaultClaims());
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query('select public.unlock_service_vault()'),/fresh authenticator/),vaultClaims(120));
    await asRole('authenticated',admin,'aal2',async()=>{
      await assert.rejects(db.query('select public.list_service_credentials($1)',[serviceContact]),/Unlock/);
      await db.query('select public.unlock_service_vault()');assert.equal((await scalar('select public.get_service_vault_status()')).unlocked,true);
    },vaultClaims());
  });
  await db.query('update public.hoa_service_contacts set archived=false where id=$1',[serviceContact]);
  let credential;
  await t.test('credential CRUD exposes plaintext only on reveal and excludes it from metadata and audit logs',async()=>{
    const values={username:'fixture-user',password:'fixture-secret-only',account_number:'fixture-account-only'};
    await asRole('authenticated',admin,'aal2',async()=>{
      credential=await scalar('select public.save_service_credential(null,$1,$2,$3)',[serviceContact,'Fixture service login',JSON.stringify(values)]);
      const listing=await scalar('select public.list_service_credentials($1)',[serviceContact]);assert.equal(listing.find(c=>c.id===credential).title,'Fixture service login');assert.ok(!JSON.stringify(listing).includes(values.password));
      assert.deepEqual(await scalar('select public.reveal_service_credential($1)',[credential]),values);
      await assert.rejects(db.query('select secret from vault.secrets'),/permission denied/);
      await assert.rejects(db.query('select * from vault.decrypted_secrets'),/permission denied/);
      await assert.rejects(db.query('select public.save_service_credential($1,$2,$3,$4)',[credential,'00000000-0000-4000-8000-000000000111','Wrong contact',JSON.stringify(values)]),/active service contact/);
      await assert.rejects(db.query('select public.save_service_credential(null,$1,$2,$3)',[serviceContact,'Bad shape',JSON.stringify({secret_id:'bad'})]),/valid service/);
      await db.query('select public.save_service_credential($1,$2,$3,$4)',[credential,serviceContact,'Updated fixture',JSON.stringify({...values,username:'changed-fixture'})]);
      assert.equal((await scalar('select public.reveal_service_credential($1)',[credential])).username,'changed-fixture');
    },vaultClaims());
    assert.equal(await scalar("select count(*) from private.leadership_audit where details::text like '%fixture-secret-only%' or details::text like '%fixture-account-only%'"),0);
    await db.query("update private.service_vault_unlocks set unlocked_until=now()-interval '1 second' where session_id=$1",[vaultSession]);
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query('select public.reveal_service_credential($1)',[credential]),/Unlock/),vaultClaims());
    await asRole('authenticated',admin,'aal2',()=>db.query('select public.unlock_service_vault()'),vaultClaims());
    await db.query("delete from public.user_roles where user_id=$1 and role='admin'",[admin]);
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query('select public.reveal_service_credential($1)',[credential]),/Unlock/),vaultClaims());
    await db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[admin]);
    await db.query('delete from auth.sessions where id=$1',[vaultSession]);
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query('select public.reveal_service_credential($1)',[credential]),/Unlock/),vaultClaims());
    await db.query("insert into auth.sessions(id,user_id,aal) values($1,$2,'aal2')",[vaultSession,admin]);
    await asRole('authenticated',admin,'aal2',async()=>{await db.query('select public.unlock_service_vault()');await db.query('select public.remove_service_credential($1)',[credential]);await db.query('select public.lock_service_vault()');assert.equal((await scalar('select public.get_service_vault_status()')).unlocked,false);},vaultClaims());
    assert.equal(await scalar('select count(*) from private.service_credentials where id=$1',[credential]),0);assert.equal(await scalar('select count(*) from vault.secrets'),0);
  });

  await t.test('separate notification address saves independently of login and consent tracks recipient changes',async()=>{
    const details={first_name:'Fixture',last_name:'Owner',notification_email:'notices@example.test'};
    const before=Number(await scalar('select count(*) from private.email_notice_history where user_id=$1',[homeowner]));
    await asRole('authenticated',homeowner,'aal1',async()=>{
      await db.query('select public.save_member_profile($1,true)',[JSON.stringify(details)]);
      const profile=await scalar('select public.get_member_profile()');assert.equal(profile.details.notification_email,'notices@example.test');assert.equal(profile.email,'homeowner@example.test');assert.equal(profile.notice_consent,true);
      await assert.rejects(db.query('select public.save_member_profile($1,true)',[JSON.stringify({...details,notification_email:'not an email'})]),/valid email for HOA/);
      await assert.rejects(db.query("update public.portal_account_details set notification_email='invalid' where user_id=$1",[homeowner]),/check constraint/);
      await db.query('select public.save_member_profile($1,true)',[JSON.stringify(details)]);
    });
    assert.equal(await scalar('select email_at_consent from private.email_notice_preferences where user_id=$1',[homeowner]),'notices@example.test');
    assert.equal(Number(await scalar('select count(*) from private.email_notice_history where user_id=$1',[homeowner])),before+1);
    await asRole('authenticated',homeowner,'aal1',()=>db.query('select public.save_member_profile($1,true)',[JSON.stringify({...details,notification_email:'changed-notices@example.test'})]));
    assert.equal(Number(await scalar('select count(*) from private.email_notice_history where user_id=$1',[homeowner])),before+2);
    assert.equal(await scalar('select email_at_consent from private.email_notice_preferences where user_id=$1',[homeowner]),'changed-notices@example.test');
    assert.equal(await scalar('select email from auth.users where id=$1',[homeowner]),'homeowner@example.test');
    await asRole('authenticated',staff,'aal2',async()=>assert.equal((await scalar('select public.get_staff_workspace()')).requests.find(r=>r.user_id===homeowner).notification_email,'changed-notices@example.test'));
  });
  await t.test('occupancy requires one explicit choice, isolates owners and cannot clear a leadership rental flag',async()=>{
    let chosenRequest;
    const p='00000000-0000-4000-8000-000000000026';
    await db.query("insert into public.properties(id,lot_number,street_address) values($1,6,'Occupancy fixture')",[p]);
    await asRole('anon',null,null,()=>assert.rejects(db.query("select public.request_property_verification_with_occupancy($1,'owner','Fixture','owner_occupied')",[p]),/permission denied/));
    await asRole('authenticated',homeowner,'aal1',async()=>{
      for(const choice of [null,'','invalid'])await assert.rejects(db.query("select public.request_property_verification_with_occupancy($1,'owner','Fixture',$2)",[p,choice]),/Select whether/);
      chosenRequest=await scalar("select public.request_property_verification_with_occupancy($1,'owner','Fixture','owner_occupied')",[p]);
      assert.equal((await scalar('select public.get_rental_workspace()')).properties.find(p=>p.request_id===chosenRequest).occupancy_choice,'owner_occupied');
      await assert.rejects(db.query('select public.set_property_occupancy_choice($1,null)',[chosenRequest]),/Select whether/);
      await db.query("select public.set_property_occupancy_choice($1,'rental')",[chosenRequest]);
      assert.equal((await scalar('select public.get_member_access()')).allowed,false);
      await db.query("select public.set_property_occupancy_choice($1,'owner_occupied')",[chosenRequest]);
      assert.equal((await scalar('select public.get_member_access()')).allowed,true);
      await assert.rejects(db.query("select public.set_property_occupancy_choice($1,'rental')",[administratorRequest]),/own active/);
    });
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query("select public.set_property_occupancy_choice($1,'rental')",[chosenRequest]),/own active/));
    await asRole('authenticated',staff,'aal2',()=>db.query("select public.update_property_occupancy($1,'rental','Independent fixture flag')",[p]));
    await asRole('authenticated',homeowner,'aal1',async()=>{
      await db.query("select public.set_property_occupancy_choice($1,'owner_occupied')",[chosenRequest]);
      const row=(await scalar('select public.get_rental_workspace()')).properties.find(p=>p.request_id===chosenRequest);
      assert.equal(row.occupancy_choice,'owner_occupied');assert.equal(row.admin_marked_rental,true);assert.equal(row.is_rental,true);assert.equal((await scalar('select public.get_member_access()')).allowed,false);
    });
    assert.equal(await scalar('select occupancy_status from public.properties where id=$1',[p]),'rental');
    await asRole('authenticated',staff,'aal2',async()=>assert.equal((await scalar('select public.get_staff_workspace()')).requests.find(r=>r.id===chosenRequest).occupancy_choice,'owner_occupied'));
  });

  const applicant='00000000-0000-4000-8000-000000000101';
  const applicantHome='00000000-0000-4000-8000-000000000102';
  const applicationDetails={first_name:'New',last_name:'Applicant',notification_email:'notices-applicant@example.test',phone:'555-0123',mailing_street:'102 Fixture Street',mailing_city:'Gardner',mailing_state:'KS',mailing_postal_code:'66030',mailing_country:'US'};
  const application=()=>scalar('select public.get_member_application_status()');
  const submitApplication=(details=applicationDetails,household={})=>scalar("select public.submit_member_application($1,$2,'owner','Current purchase','owner_occupied',true,$3)",[JSON.stringify(details),applicantHome,JSON.stringify(household)]);
  await t.test('one membership submission saves profile/property/household atomically, shows pending, rejects duplicate submissions and restores updates after approval',async()=>{
    const nonce=await ticket('new-applicant@example.test');await newUser(applicant,'new-applicant@example.test',nonce.ticket);
    await asRole('authenticated',applicant,'aal1',()=>assert.rejects(db.query('select public.get_member_application_status()'),/Confirmed account/));
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[applicant]);
    await db.query("insert into public.properties(id,lot_number,street_address) values($1,102,'102 Fixture Street')",[applicantHome]);
    await asRole('anon',null,null,()=>assert.rejects(db.query('select public.get_member_application_status()'),/permission denied/));
    await asRole('authenticated',applicant,'aal1',async()=>{
      assert.equal((await application()).phase,'setup');assert.equal((await scalar('select public.get_member_access()')).allowed,false);
      await assert.rejects(submitApplication({...applicationDetails,mailing_street:''}),/mailing street/);
      await assert.rejects(submitApplication(applicationDetails,{is_trust:true}),/trust name/);
    });
    assert.equal(await scalar('select count(*) from public.portal_account_details where user_id=$1',[applicant]),0);
    assert.equal(await scalar('select count(*) from private.property_access_requests where user_id=$1',[applicant]),0);
    const household={is_trust:true,trust_name:'Fixture Trust',decision_first_name:'New',decision_last_name:'Applicant',additional_members:[{first_name:'Joint',last_name:'Owner',relationship:'co_owner',email:'joint@example.test',phone:''}]};
    let request;
    await asRole('authenticated',applicant,'aal1',async()=>{
      request=await submitApplication(applicationDetails,household);
      const status=await application();assert.equal(status.phase,'pending');assert.equal(status.requests[0].property_id,applicantHome);assert.equal(status.requests[0].occupancy_choice,'owner_occupied');
      assert.equal((await scalar('select public.get_member_profile()')).details.notification_email,applicationDetails.notification_email);
      assert.equal((await scalar('select public.get_property_households()')).properties[0].household.trust_name,'Fixture Trust');
      await assert.rejects(submitApplication(),/already pending/);assert.equal((await scalar('select public.get_member_access()')).allowed,false);
      assert.equal(await scalar('select count(*) from public.hoa_publications'),0);
    });
    await asRole('authenticated',admin,'aal2',async()=>{
      const queue=await scalar('select public.get_staff_workspace()');assert.ok(queue.requests.some(r=>r.id===request&&r.user_id===applicant));
      const accounts=await scalar('select public.get_account_access_workspace()');assert.equal(accounts.accounts.find(a=>a.user_id===applicant).application_status,'pending');
      await db.query("select public.review_property_access_request($1,'rejected','Provide current ownership evidence')",[request]);
    });
    await asRole('authenticated',applicant,'aal1',async()=>{assert.equal((await application()).phase,'needs_changes');request=await submitApplication(applicationDetails,household);assert.equal((await application()).phase,'pending');});
    await asRole('authenticated',admin,'aal2',()=>db.query("select public.review_property_access_request($1,'approved','Synthetic current ownership evidence checked')",[request]));
    await asRole('authenticated',applicant,'aal1',async()=>{
      assert.equal((await application()).phase,'approved');assert.equal((await scalar('select public.get_member_access()')).allowed,true);
      await assert.rejects(submitApplication(),/already approved/);
      await db.query('select public.save_member_profile($1,true)',[JSON.stringify({...applicationDetails,phone:'555-9999'})]);
      assert.equal((await scalar('select public.get_member_profile()')).details.phone,'555-9999');
    });
  });
  await t.test('workspace checkboxes grant/revoke immediately, cannot create administrators, and can override appointed access without changing the public roster',async()=>{
    const before=await scalar('select public.get_public_leadership_roster()');
    for(const [role,uid,aal] of [['anon',null,null],['authenticated',applicant,'aal2'],['authenticated',staff,'aal2'],['authenticated',admin,'aal1']]){
      await asRole(role,uid,aal,async()=>{
        await assert.rejects(db.query('select public.get_account_access_workspace()'),/permission denied|System administrator/);
        await assert.rejects(db.query('select public.set_account_workspace_access($1,true,true)',[applicant]),/permission denied|System administrator/);
      });
    }
    await asRole('authenticated',admin,'aal2',async()=>{
      await assert.rejects(db.query('select public.set_account_workspace_access($1,false,false)',[admin]),/retain both/);
      await assert.rejects(db.query('select public.set_account_workspace_access($1,null,true)',[applicant]),/Choose both/);
      await db.query('select public.set_account_workspace_access($1,true,true)',[applicant]);
    });
    await asRole('authenticated',applicant,'aal1',async()=>{const f=await flags();assert.equal(f.can_access_admin,true);assert.equal(f.can_access_tools,true);assert.equal(f.can_manage_leadership,false);await assert.rejects(db.query('select public.get_staff_workspace()'),/MFA required/);});
    await asRole('authenticated',applicant,'aal2',async()=>{
      const f=await flags();assert.equal(f.is_admin,false);assert.equal(f.is_director,false);assert.equal(f.is_officer,false);assert.equal(f.can_review_members,true);
      assert.ok((await scalar('select public.get_staff_workspace()')).requests.length>0);await db.query('select public.get_hoa_library_usage()');
      assert.equal((await scalar('select public.get_service_vault_status()')).eligible,false);
      await assert.rejects(db.query('select public.set_account_workspace_access($1,true,true)',[staff]),/System administrator/);
      await assert.rejects(db.query('select * from private.portal_workspace_access'),/permission denied/);
      await assert.rejects(db.query("select public.review_property_access_request($1,'revoked','Attempt self review')",[(await application()).requests.find(r=>r.status==='approved').id]),/Only a system administrator/);
    });
    assert.deepEqual(await scalar('select public.get_public_leadership_roster()'),before);
    await asRole('authenticated',admin,'aal2',async()=>{await db.query('select public.set_account_workspace_access($1,false,false)',[applicant]);await db.query('select public.set_account_workspace_access($1,false,false)',[staff]);});
    for(const id of [applicant,staff])await asRole('authenticated',id,'aal2',async()=>{const f=await flags();assert.equal(f.can_access_admin,false);assert.equal(f.can_access_tools,false);await assert.rejects(db.query('select public.get_staff_workspace()'),/MFA required/);assert.equal(await scalar('select count(*) from public.hoa_service_contacts'),0);});
    assert.equal(await scalar("select count(*) from public.user_roles where user_id=$1 and role='admin'",[applicant]),0);
    assert.equal(await scalar("select count(*) from private.leadership_audit where action='workspace_access_changed'"),3);
    await asRole('authenticated',admin,'aal2',()=>db.query('select public.set_account_workspace_access($1,false,true)',[applicant]));
    await asRole('authenticated',applicant,'aal1',()=>assert.rejects(db.query("insert into public.hoa_events(kind,title,event_date) values('meeting','Tools-only draft fixture',current_date)"),/row-level security|MFA required/));
    await asRole('authenticated',applicant,'aal2',async()=>{
      await assert.rejects(db.query('select public.get_staff_workspace()'),/MFA required/);
      const event=await scalar("insert into public.hoa_events(kind,title,event_date,published) values('meeting','Tools-only draft fixture',current_date,false) returning id");
      assert.equal(await scalar('select published from public.hoa_events where id=$1',[event]),false);
      await db.query("update public.hoa_events set title='Updated tools-only draft' where id=$1",[event]);
    });
    await asRole('authenticated',admin,'aal2',()=>db.query('select public.set_account_workspace_access($1,false,false)',[applicant]));
    await db.query('delete from private.portal_workspace_access where user_id=$1',[staff]);
  });
  await t.test('system administrators may self approve only with MFA and an evidence note; self-review is recorded',async()=>{
    const home='00000000-0000-4000-8000-000000000104';let request;
    await db.query("insert into public.properties(id,lot_number,street_address) values($1,104,'Administrator fixture home')",[home]);
    await asRole('authenticated',admin,'aal2',async()=>{request=await scalar("select public.request_property_verification_with_occupancy($1,'owner','Own home','owner_occupied')",[home]);await assert.rejects(db.query("select public.review_property_access_request($1,'approved','')",[request]),/Record how ownership/);});
    await asRole('authenticated',admin,'aal1',()=>assert.rejects(db.query("select public.review_property_access_request($1,'approved','Fixture evidence')",[request]),/MFA required/));
    await asRole('authenticated',admin,'aal2',()=>db.query("select public.review_property_access_request($1,'approved','Synthetic current deed checked for own property')",[request]));
    assert.equal(await scalar("select status from private.property_access_requests where id=$1",[request]),'approved');
    assert.equal(await scalar("select count(*) from private.leadership_audit where action='property_request_approved' and details->>'request_id'=$1 and details->>'administrator_self_review'='true'",[request]),1);
  });
  await t.test('rental applications stay incomplete until a finished current lease exists; expired leases keep update access but block member information',async()=>{
    const uid='00000000-0000-4000-8000-000000000105',home='00000000-0000-4000-8000-000000000106';let request,file;
    const nonce=await ticket('rental-applicant@example.test');await newUser(uid,'rental-applicant@example.test',nonce.ticket);await db.query('update auth.users set email_confirmed_at=now() where id=$1',[uid]);
    await db.query("insert into public.properties(id,lot_number,street_address,occupancy_status) values($1,106,'Rental application fixture','rental')",[home]);
    await asRole('authenticated',uid,'aal1',async()=>{
      request=await scalar("select public.submit_member_application($1,$2,'owner','Fixture','owner_occupied',false,'{}')",[JSON.stringify(applicationDetails),home]);
      assert.equal((await application()).phase,'setup');assert.equal((await scalar('select public.get_member_access()')).allowed,false);
      const retried=await scalar("select public.submit_member_application($1,$2,'owner','Retry','owner_occupied',false,'{}')",[JSON.stringify(applicationDetails),home]);assert.equal(retried,request);
      file=await scalar("select public.reserve_rental_agreement($1,'fixture.pdf',25,current_date-1,current_date+365)",[request]);
    });
    await asRole('authenticated',admin,'aal2',()=>assert.rejects(db.query("select public.review_property_access_request($1,'approved','Fixture evidence')",[request]),/current rental agreement/));
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('hoa-rental-agreements',$1,'{\"size\":25,\"mimetype\":\"application/pdf\"}')",[file.storage_path]);
    await asRole('authenticated',uid,'aal1',async()=>{await db.query('select public.finish_rental_agreement($1)',[file.id]);assert.equal((await application()).phase,'pending');});
    await asRole('authenticated',admin,'aal2',()=>db.query("select public.review_property_access_request($1,'approved','Synthetic rental ownership evidence checked')",[request]));
    await asRole('authenticated',uid,'aal1',async()=>{assert.equal((await application()).phase,'approved');assert.equal((await scalar('select public.get_member_access()')).allowed,true);});
    await db.query('update public.rental_agreements set lease_end=current_date-1 where document_id=$1',[file.id]);
    await asRole('authenticated',uid,'aal1',async()=>{assert.equal((await application()).phase,'approved');assert.equal((await scalar('select public.get_member_access()')).allowed,false);await db.query('select public.get_member_profile()');await db.query('select public.get_rental_workspace()');});
  });

  await managementTests({t,db,asRole,scalar,admin,homeowner,staff});
});
