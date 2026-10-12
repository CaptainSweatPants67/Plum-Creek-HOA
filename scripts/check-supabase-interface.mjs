import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

// Read-only live smoke test. Never prints API keys, contact records or passcodes.
const env = Object.fromEntries((await readFile(new URL("../.env.local",import.meta.url),"utf8"))
  .split(/\r?\n/).filter((line)=>line.includes("=")).map((line)=>[line.slice(0,line.indexOf("=")),line.slice(line.indexOf("=")+1)]));
const url=env.NEXT_PUBLIC_SUPABASE_URL;
const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key?.startsWith("sb_publishable_"));
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const roster=await client.rpc("get_public_leadership_roster");
assert.ifError(roster.error);
assert.equal(roster.data.board.length,5);
assert.ok(roster.data.board.every(row=>row.kind !== 'historical'));
assert.ok((await client.rpc('get_member_leadership_history')).error);
const anonymousHistory=await client.from('board_member_years').select('id').eq('record_kind','historical');
assert.ifError(anonymousHistory.error);
assert.equal(anonymousHistory.data.length,0);
const anonymousBylaws=await client.storage.from('hoa-member-governance').download('plum-creek-bylaws.pdf');
assert.ok(anonymousBylaws.error,'Bylaws downloads must require member authentication');
const publicBylaws=await fetch(`${url}/storage/v1/object/public/hoa-member-governance/plum-creek-bylaws.pdf`);
assert.notEqual(publicBylaws.status,200,'The governing PDF must not have a public Storage URL');
assert.equal(roster.data.officers.find((row)=>row.year===2026 && row.position_code==="president").name,"Michael Bruna");
for(const table of ["contacts","contact_emails","property_contacts","rental_agreements","property_documents","portal_account_details","hoa_service_contacts","hoa_publications","hoa_library_files"]) {
  const {data,error}=await client.from(table).select("*");
  assert.ok(error || data.length===0,`Anonymous access must be denied: ${table}`);
}
const secret=await client.rpc("get_homeowner_signup_passcode");
assert.ok(secret.error,"Public access to the signup code must be denied");
const libraryUsage=await client.rpc("get_hoa_library_usage");
assert.ok(libraryUsage.error,"Public access to library management must be denied");
for(const name of ['get_member_access','get_rental_workspace','get_staff_rental_workspace']) {
  assert.ok((await client.rpc(name)).error,`Anonymous access must be denied: ${name}`);
}
const settingsResponse=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key}});
assert.equal(settingsResponse.status,200);
const settings=await settingsResponse.json();
assert.equal(settings.mailer_autoconfirm,false,"Email confirmation must be enabled before bootstrap signup");
assert.equal(settings.external.email,true,"Email registration must be enabled");
console.log("Live checks passed: current public roster available; history/bylaws/private data/passcode denied to anonymous users; email confirmation enabled. No account or email created.");
