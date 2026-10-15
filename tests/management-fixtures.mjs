import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function managementTests({t,db,asRole,scalar,admin}) {
  const property='00000000-0000-4000-8000-000000000104';
  const adminAction=fn=>asRole('authenticated',admin,'aal2',fn);
  const workspace=year=>scalar('select public.get_treasury_workspace($1)',[year]);
  async function settings(year,dues=300){await db.query('select public.save_treasury_year($1,$2,25,60,10,$3,\'Fixture policy\',null)',[year,dues,`${year}-01-01`]);}
  const entry=(year,kind,category,amount,key=randomUUID())=>scalar('select public.add_treasury_entry($1,$2,$3,$4,$5,$6,$7,$8,\'TEST\',\'Synthetic ledger evidence\')',[key,property,year,kind,category,amount,`${year}-02-01`,kind==='payment'?'check':null]);
  await t.test('treasury and property management reject anonymous, ordinary member, revoked staff and MFA-less administrators',async()=>{
    for(const [role,uid,aal] of [['anon',null,null],['authenticated','00000000-0000-4000-8000-000000000105','aal2'],['authenticated',admin,'aal1']])await asRole(role,uid,aal,async()=>{
      for(const sql of ['select public.get_treasury_workspace(2009)','select public.get_property_management_workspace()','select public.get_notice_recipients(null)','select public.get_hoa_notices()'])await assert.rejects(db.query(sql),/permission denied|MFA required/);
      await assert.rejects(db.query("select public.save_treasury_year(2009,300,25,60,10,'2009-01-01','',null)"),/permission denied|MFA required/);
      await assert.rejects(db.query('select * from private.treasury_entries'),/permission denied/);
    });
    await adminAction(async()=>{await assert.rejects(db.query("select public.claim_hoa_notice_delivery(gen_random_uuid(),80)"),/permission denied/);await assert.rejects(db.query("select public.record_hoa_notice_delivery_event('x','y','delivered',now())"),/permission denied/);});
  });
  let previousPayment,currentPayment,lateCharge;
  await t.test('year configuration posts no charges; assessment is explicit, idempotent and snapshots amounts without multiplying carry-forward balances',async()=>{
    await adminAction(async()=>{
      await settings(2008,200);await settings(2009);
      assert.equal((await workspace(2009)).properties.find(p=>p.id===property).total_owed,0);
      const cfg=(await workspace(2009)).settings;
      assert.equal(await scalar('select public.assess_treasury_dues(2009,$1)',[cfg.updated_at]),(await workspace(2009)).properties.length);
      assert.equal(await scalar('select public.assess_treasury_dues(2009,$1)',[cfg.updated_at]),0);
      await db.query("select public.save_treasury_year(2009,400,25,60,10,'2009-01-01','Changed defaults',$1)",[cfg.updated_at]);
      assert.equal((await workspace(2009)).properties.find(p=>p.id===property).dues,300);
      await assert.rejects(db.query("select public.save_treasury_year(2009,500,25,60,10,'2009-01-01','Stale',$1)",[cfg.updated_at]),/changed/);
      await assert.rejects(entry(2009,'charge','dues',400),/already assessed/);
      await entry(2008,'charge','dues',200);previousPayment=await entry(2008,'payment','dues',50);
      const row=(await workspace(2009)).properties.find(p=>p.id===property);assert.equal(row.prior_balance,150);assert.equal(row.year_balance,300);assert.equal(row.total_owed,450);assert.equal(row.delinquent,450);
    });
  });
  await t.test('partial payments, payment methods, manual late/lien/interest, and paid checkbox balances are enforced in PostgreSQL',async()=>{
    await adminAction(async()=>{
      const key=randomUUID();currentPayment=await entry(2009,'payment','dues',50,key);assert.equal(await entry(2009,'payment','dues',50,key),currentPayment);
      await assert.rejects(entry(2009,'payment','dues',75,key),/action key/);
      await assert.rejects(entry(2009,'payment','dues',251),/no greater/);
      await assert.rejects(entry(2009,'payment','dues',0.001),/exact-cent/);
      lateCharge=await entry(2009,'charge','late_fee',25);await entry(2009,'charge','lien_fee',60);
      await assert.rejects(entry(2009,'charge','interest',30),/settings changed/);
      await entry(2009,'charge','interest',25); // 10% simple interest on remaining $250 dues.
      await assert.rejects(entry(2009,'charge','interest',25),/already assessed/);
      let row=(await workspace(2009)).properties.find(p=>p.id===property);assert.equal(row.dues_remaining,250);assert.equal(row.year_balance,360);assert.equal(row.prior_balance,150);assert.equal(row.total_owed,510);
      await entry(2009,'payment','dues',250);row=(await workspace(2009)).properties.find(p=>p.id===property);assert.equal(row.dues_remaining,0);assert.equal(row.total_owed,260);assert.equal(row.assessed,true);
      await assert.rejects(entry(2009,'charge','late_fee',25),/overdue, unpaid/);
      await assert.rejects(db.query("select public.add_treasury_entry(gen_random_uuid(),$1,2009,'payment','late_fee',5,'2009-02-01',null,'','Missing method')",[property]),/Choose how/);
      await assert.rejects(db.query("select public.add_treasury_entry(gen_random_uuid(),$1,2009,'payment','late_fee',5,current_date+1,'check','','Future')",[property]),/future/);
    });
  });
  await t.test('corrections retain receipts, restore balances and cannot remove a paid charge before its payments are voided',async()=>{
    await adminAction(async()=>{
      const duesCharge=(await workspace(2009)).properties.find(p=>p.id===property).entries.find(e=>e.kind==='charge'&&e.category==='dues').id;
      await assert.rejects(db.query("select public.void_treasury_entry($1,'Incorrect charge')",[duesCharge]),/Void the payments/);
      await assert.rejects(db.query("select public.void_treasury_entry($1,'')",[currentPayment]),/reason/);
      await db.query("select public.void_treasury_entry($1,'Incorrect receipt')",[currentPayment]);
      await db.query("select public.void_treasury_entry($1,'Already corrected')",[currentPayment]);
      await db.query("select public.void_treasury_entry($1,'Fee waived with evidence')",[lateCharge]);
      const row=(await workspace(2009)).properties.find(p=>p.id===property);assert.equal(row.dues_remaining,50);assert.equal(row.total_owed,285);
      assert.ok(row.entries.find(e=>e.id===currentPayment).voided_at);assert.ok(row.entries.find(e=>e.id===lateCharge).voided_at);
      assert.equal((await workspace(2008)).properties.find(p=>p.id===property).entries.find(e=>e.id===previousPayment).amount,50);
    });
  });
  let historical;
  await t.test('HOA reference contact edits remain unverified, use optimistic locking, preserve raw imports and cannot edit verified account contacts',async()=>{
    const sourceCount=await scalar('select count(*) from public.legacy_property_reference');
    const verified=await scalar('select contact_id from public.user_profiles where user_id=$1',[admin]);
    await adminAction(async()=>{
      historical=await scalar("select public.save_historical_contact($1,null,'{\"display_name\":\"Historical fixture\",\"first_name\":\"Historic\"}','[\"old@example.test\",\"secondary@example.test\"]',null)",[property]);
      let p=(await scalar('select public.get_property_management_workspace()')).find(p=>p.id===property);let contact=p.historical_contacts.find(c=>c.id===historical);
      assert.equal(contact.editable,true);assert.equal(contact.emails.length,2);assert.equal(p.verified_contacts.length,1);
      await db.query("select public.save_historical_contact($1,$2,'{\"display_name\":\"Corrected fixture\"}','[\"new@example.test\"]',$3)",[property,historical,contact.updated_at]);
      await assert.rejects(db.query("select public.save_historical_contact($1,$2,'{\"display_name\":\"Stale\"}','[]',$3)",[property,historical,contact.updated_at]),/changed/);

      await assert.rejects(db.query("select public.save_historical_contact($1,$2,'{\"display_name\":\"Bad edit\"}','[]',now())",[property,verified]),/Only historical/);

    });
    assert.equal(await scalar('select contact_verified_at from public.contacts where id=$1',[historical]),null);
    assert.equal(await scalar('select count(*) from public.contact_emails where contact_id=$1 and verified',[historical]),0);
    assert.equal(await scalar('select count(*) from public.legacy_property_reference'),sourceCount);
  });
  let notice,claimed;
  await t.test('email export and notice snapshots require current verified ownership and consent to the current address; historical and duplicate addresses are excluded',async()=>{
    await adminAction(async()=>{
      await db.query("select public.save_member_profile('{\"first_name\":\"Admin\",\"last_name\":\"Fixture\",\"notification_email\":\"consented@example.test\"}',true)");
      const list=await scalar('select public.get_notice_recipients($1)',[[property]]);assert.equal(list.length,1);assert.equal(list[0].email,'consented@example.test');assert.deepEqual(list[0].lot_numbers,[104]);
      await assert.rejects(db.query("select public.prepare_hoa_notice(gen_random_uuid(),'Notice','Body',$1,'{wrong@example.test}')",[[property]]),/recipient list changed/);
      const key=randomUUID();notice=await scalar("select public.prepare_hoa_notice($1,'Fixture notice','Private operational message',$2,'{consented@example.test}')",[key,[property]]);
      assert.equal(await scalar("select public.prepare_hoa_notice($1,'Fixture notice','Private operational message',$2,'{consented@example.test}')",[key,[property]]),notice);
      assert.equal((await scalar('select public.get_hoa_notices()')).find(n=>n.id===notice).recipients.length,1);
    });
    await asRole('service_role',null,null,async()=>{claimed=await scalar('select public.claim_hoa_notice_delivery($1,80)',[notice]);assert.equal(claimed.email,'consented@example.test');assert.equal(await scalar('select public.claim_hoa_notice_delivery($1,80)',[notice]),null);});
  });
  await t.test('signed delivery events are deduplicated, reconcile events before send completion, and suppress bounced addresses for future notices',async()=>{
    const provider=randomUUID();
    await asRole('service_role',null,null,async()=>{
      await db.query("select public.record_hoa_notice_delivery_event('delivery-first',$1,'delivered',now())",[provider]);
      await db.query("select public.complete_hoa_notice_delivery($1,$2,'accepted',$3,'')",[claimed.id,claimed.claim_token,provider]);
    });
    await adminAction(async()=>assert.equal((await scalar('select public.get_hoa_notices()')).find(n=>n.id===notice).recipients[0].status,'delivered'));
    await asRole('service_role',null,null,async()=>{
      await db.query("select public.record_hoa_notice_delivery_event('bounce-event',$1,'bounced',now())",[provider]);
      await db.query("select public.record_hoa_notice_delivery_event('bounce-event',$1,'bounced',now())",[provider]);
      await db.query("select public.record_hoa_notice_delivery_event('late-delivery',$1,'delivered',now()+interval '1 minute')",[provider]);
    });
    await adminAction(async()=>{
      assert.equal((await scalar('select public.get_hoa_notices()')).find(n=>n.id===notice).recipients[0].status,'bounced');
      assert.equal((await scalar('select public.get_notice_recipients($1)',[[property]])).length,0);
      await assert.rejects(db.query("select public.set_hoa_email_block('consented@example.test',false,'Ignore bounce')"),/remain blocked/);
    });
    assert.equal(await scalar("select count(*) from private.hoa_email_events where event_id='bounce-event'"),1);
  });
  await t.test('email consent withdrawal or revoked ownership skips queued recipients; reset approval returns pending and moved-away revocation immediately blocks member access',async()=>{
    await adminAction(async()=>{
      await db.query("select public.save_member_profile('{\"first_name\":\"Admin\",\"last_name\":\"Fixture\",\"notification_email\":\"new-consented@example.test\"}',true)");
      notice=await scalar("select public.prepare_hoa_notice(gen_random_uuid(),'Withdrawn consent','Message',$1,'{new-consented@example.test}')",[[property]]);
      await db.query("select public.save_member_profile('{\"first_name\":\"Admin\",\"last_name\":\"Fixture\",\"notification_email\":\"new-consented@example.test\"}',false)");
    });
    await asRole('service_role',null,null,async()=>assert.equal(await scalar('select public.claim_hoa_notice_delivery($1,80)',[notice]),null));
    await adminAction(async()=>{
      assert.equal((await scalar('select public.get_hoa_notices()')).find(n=>n.id===notice).recipients[0].status,'skipped');
      const req=(await scalar('select public.get_property_management_workspace()')).find(p=>p.id===property).verified_contacts.find(c=>c.user_id===admin).request_id;
      await db.query("select public.reset_property_approval($1,'reset','Current evidence must be rechecked')",[req]);
      assert.equal((await scalar('select public.get_member_workspace()')).requests.find(r=>r.id===req).status,'revoked');
      const pending=(await scalar('select public.get_staff_workspace()')).requests.find(r=>r.user_id===admin&&r.lot_number===104&&r.status==='pending')?.id;assert.ok(pending);
      await db.query("select public.review_property_access_request($1,'approved','Synthetic ownership evidence rechecked')",[pending]);
      await db.query("select public.reset_property_approval($1,'moved_away','Moved away; synthetic test')",[pending]);
      assert.equal((await scalar('select public.get_property_management_workspace()')).find(p=>p.id===property).verified_contacts.length,0);
      assert.equal((await scalar('select public.get_notice_recipients($1)',[[property]])).length,0);
    });
  });
}
