import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {createNoticeHandler,createWebhookHandler,verifyWebhook} from "../supabase/functions/_shared/hoa-notice-handler.mjs";
const env={SUPABASE_URL:"https://fixture.supabase.test",SUPABASE_ANON_KEY:"public-fixture",SUPABASE_SERVICE_ROLE_KEY:"server-fixture",HOA_RESEND_API_KEY:"sender-fixture",HOA_RESEND_WEBHOOK_SECRET:"whsec_"+Buffer.from("fixture-webhook-key").toString("base64")};
const notice="11111111-1111-4111-8111-111111111111",recipient="22222222-2222-4222-8222-222222222222";
const req=(body={action:"send",notice_id:notice},headers={})=>new Request("https://fixture/functions/v1/hoa-notices",{method:"POST",headers:{authorization:"Bearer fixture-user",origin:"https://plumcreekgardner.com",...headers},body:JSON.stringify(body)});
function sender({flags={can_access_admin:true,has_mfa:true},sentStatus=200}={}){
  const calls=[];let claimed=false;
  const request=async(url,options={})=>{
    const body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});
    if(url.endsWith('/auth/v1/user'))return Response.json({id:'fixture'});
    if(url.endsWith('/get_portal_flags'))return Response.json(flags);
    if(url.endsWith('/get_hoa_notices'))return Response.json([{id:notice}]);
    if(url.endsWith('/claim_hoa_notice_delivery')){if(claimed)return Response.json(null);claimed=true;return Response.json({id:recipient,claim_token:'claim-fixture',email:'owner@example.test',subject:'Saved subject',body:'Saved body'});}
    if(url.endsWith('/complete_hoa_notice_delivery'))return new Response(null,{status:204});
    if(url==='https://api.resend.com/emails')return Response.json(sentStatus===200?{id:'provider-fixture'}:{message:'provider failure'},{status:sentStatus});
    throw Error('Unexpected network request');
  };return {calls,request};
}
test('notice sender authenticates users, requires administration and MFA, and rejects foreign origins before external calls',async()=>{
  for(const flags of [{can_access_admin:false,has_mfa:true},{can_access_admin:true,has_mfa:false}]){
    const {calls,request}=sender({flags});const response=await createNoticeHandler({env,fetch:request})(req());assert.equal(response.status,403);assert.ok(calls.every(c=>!c.url.includes('resend.com')&&!c.url.includes('claim_')));
  }
  const {calls,request}=sender();const handler=createNoticeHandler({env,fetch:request});assert.equal((await handler(req({}, {origin:'https://attacker.test'}))).status,403);assert.equal(calls.length,0);
  assert.equal((await handler(new Request('https://fixture',{method:'POST'}))).status,401);
});
test('missing credentials report setup status and never claim or send notices',async()=>{
  const {calls,request}=sender();const handler=createNoticeHandler({env:{...env,HOA_RESEND_API_KEY:undefined},fetch:request});
  assert.deepEqual((await (await handler(req({action:'status'}))).json()).ready,false);
  assert.equal((await handler(req())).status,503);assert.ok(calls.every(c=>!c.url.includes('claim_')&&!c.url.includes('resend.com')));
});
test('sender uses only database-selected recipients, saved content, individual addressing, a stable idempotency key and server-only credentials',async()=>{
  const {calls,request}=sender();const handler=createNoticeHandler({env,fetch:request});const response=await handler(req({action:'send',notice_id:notice,to:['attacker@example.test'],body:'Injected body'}));assert.equal(response.status,200);assert.equal((await response.json()).accepted,1);
  const sent=calls.find(c=>c.url==='https://api.resend.com/emails');assert.deepEqual(sent.body.to,['owner@example.test']);assert.equal(sent.body.subject,'Saved subject');assert.ok(sent.body.text.startsWith('Saved body'));assert.ok(sent.body.text.includes('/members/'));assert.equal(sent.body.bcc,undefined);assert.equal(sent.options.headers['Idempotency-Key'],`hoa-notice/${recipient}`);assert.equal(sent.options.headers.Authorization,'Bearer sender-fixture');
  assert.equal(calls.find(c=>c.url.endsWith('/claim_hoa_notice_delivery')).options.headers.Authorization,'Bearer server-fixture');
  assert.equal(calls.find(c=>c.url.endsWith('/complete_hoa_notice_delivery')).body.p_status,'accepted');
});
test('temporary Resend errors retain queued recipients while permanent errors are visible and do not silently retry',async()=>{
  for(const [sentStatus,expected] of [[429,'queued'],[503,'queued'],[403,'failed']]){
    const {calls,request}=sender({sentStatus});await createNoticeHandler({env,fetch:request})(req());assert.equal(calls.find(c=>c.url.endsWith('/complete_hoa_notice_delivery')).body.p_status,expected);assert.equal(calls.filter(c=>c.url.includes('api.resend.com')).length,1);
  }
});
function signed(raw,timestamp=Math.floor(Date.now()/1000),id='event-fixture'){
  const sig=createHmac('sha256',Buffer.from('fixture-webhook-key')).update(`${id}.${timestamp}.${raw}`).digest('base64');return new Headers({'svix-id':id,'svix-timestamp':String(timestamp),'svix-signature':`v1,${sig}`});
}
test('delivery webhooks require a valid signature over the exact body and reject replay-age, tampering and missing credentials',async()=>{
  const raw=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'provider-fixture'}});const headers=signed(raw);
  assert.equal(await verifyWebhook(raw,headers,env.HOA_RESEND_WEBHOOK_SECRET),true);assert.equal(await verifyWebhook(raw+' ',headers,env.HOA_RESEND_WEBHOOK_SECRET),false);assert.equal(await verifyWebhook(raw,signed(raw,Math.floor(Date.now()/1000)-400),env.HOA_RESEND_WEBHOOK_SECRET),false);assert.equal(await verifyWebhook(raw,headers,''),false);
  const calls=[];const handler=createWebhookHandler({env,fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return new Response(null,{status:204});}});
  const response=await handler(new Request('https://fixture',{method:'POST',headers,body:raw}));assert.equal(response.status,200);assert.equal(calls[0].p_status,'delivered');assert.equal(calls[0].p_event,'event-fixture');
  assert.equal((await handler(new Request('https://fixture',{method:'POST',body:raw}))).status,401);assert.equal(calls.length,1);
});
