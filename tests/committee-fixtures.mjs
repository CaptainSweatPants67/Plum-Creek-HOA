import assert from 'node:assert/strict';

export async function committeeTests({t,db,asRole,scalar,admin,applicant,staff}) {
  let committee,member,stamp,memberStamp;
  const details={name:'Fixture private committee',description:'Synthetic committee',responsibilities:['Review fixture items'],show_public:false,active:true,sort_order:55};
  const appointment={name:'Members Only Fixture',role:'Chair',show_public:false,active:true,notes:'PRIVATE NOTES NOT FOR DIRECTORY',starts_on:'',ends_on:''};
  const directory=(members=false)=>scalar(`select public.${members?'get_member_committees':'get_public_committees'}()`);
  const workspace=()=>scalar('select public.get_committee_workspace()');
  const save=(d=details,expected=null,id=null)=>scalar('select public.save_hoa_committee($1,$2,$3)',[id,JSON.stringify(d),expected]);
  const saveMember=(d=appointment,expected=null,id=null,c=committee)=>scalar('select public.save_hoa_committee_member($1,$2,$3,$4)',[id,c,JSON.stringify(d),expected]);
  await t.test('committee administration requires current administration access and MFA, with no direct table access',async()=>{
    for(const [role,id,aal] of [['anon',null,null],['authenticated',admin,'aal1'],['authenticated',applicant,'aal2']])await asRole(role,id,aal,async()=>{
      await assert.rejects(workspace,/permission denied|MFA required/);
      await assert.rejects(save(),/permission denied|MFA required/);
      await assert.rejects(db.query('select * from private.hoa_committees'),/permission denied/);
      await assert.rejects(db.query('select private.committee_directory(true)'),/permission denied/);
    });
    await asRole('authenticated',admin,'aal2',async()=>{
      committee=await save();
      member=await saveMember();
      await saveMember({...appointment,name:'Published Fixture',show_public:true,role:'Member'});
      const row=(await workspace()).find(c=>c.id===committee);stamp=row.updated_at;memberStamp=row.members.find(m=>m.id===member).updated_at;
      assert.equal(row.show_public,false);assert.equal(row.members.find(m=>m.id===member).notes,appointment.notes);
      await assert.rejects(db.query('select * from private.hoa_committee_members'),/permission denied/);
      const acc=(await workspace()).find(c=>c.board_membership);await assert.rejects(saveMember(appointment,null,null,acc.id),/current Board/);
      await assert.rejects(save({...details,show_public:null}),/Choose committee visibility/);
      await assert.rejects(save({...details,responsibilities:['x'.repeat(301)]}),/300 characters/);
    });
  });
  await t.test('public directory hides private committees and names; approved members see both, without administrative notes',async()=>{
    await asRole('anon',null,null,async()=>{
      const rows=await directory();assert.equal(rows.length,4);assert.ok(!rows.some(c=>c.id===committee));
      assert.ok(!JSON.stringify(rows).includes('Barb Mallory'));await assert.rejects(directory.bind(null,true),/permission denied/);
    });
    await asRole('authenticated',applicant,'aal1',async()=>{
      const row=(await directory(true)).find(c=>c.id===committee);assert.equal(row.members.length,2);assert.ok(row.members.some(m=>m.name===appointment.name));
      const json=JSON.stringify(row);assert.ok(!json.includes('PRIVATE NOTES'));assert.ok(!json.includes('updated_at'));assert.ok(!json.includes('updated_by'));
      assert.ok(!JSON.stringify(await directory()).includes(appointment.name));
    });
    await asRole('authenticated','00000000-0000-4000-8000-000000000105','aal1',()=>assert.rejects(directory.bind(null,true),/current rental paperwork/));
    await asRole('authenticated',admin,'aal2',async()=>{await save({...details,show_public:true},stamp,committee);stamp=(await workspace()).find(c=>c.id===committee).updated_at;});
    await asRole('anon',null,null,async()=>{const row=(await directory()).find(c=>c.id===committee);assert.deepEqual(row.members.map(m=>m.name),['Published Fixture']);assert.ok(!JSON.stringify(row).includes('notes'));});
    await asRole('authenticated',admin,'aal2',async()=>{await saveMember({...appointment,show_public:true},memberStamp,member);memberStamp=(await workspace()).find(c=>c.id===committee).members.find(m=>m.id===member).updated_at;});
    await asRole('anon',null,null,async()=>assert.ok((await directory()).find(c=>c.id===committee).members.some(m=>m.name===appointment.name)));
    await asRole('authenticated',admin,'aal2',()=>saveMember(appointment,memberStamp,member));
    await asRole('anon',null,null,async()=>assert.ok(!(await directory()).find(c=>c.id===committee).members.some(m=>m.name===appointment.name)));
  });
  await t.test('committee appointment dates, archive status and optimistic concurrency are enforced server-side',async()=>{
    await asRole('authenticated',admin,'aal2',async()=>{
      await assert.rejects(save(details,'2000-01-01',committee),/changed/);
      await assert.rejects(saveMember(appointment,'2000-01-01',member),/changed/);
      await assert.rejects(saveMember({...appointment,name:'Invalid range',starts_on:'2030-01-01',ends_on:'2020-01-01'}),/check constraint/);
      await saveMember({...appointment,name:'Future fixture',show_public:true,starts_on:'2099-01-01'});
      await saveMember({...appointment,name:'Past fixture',show_public:true,ends_on:'2000-01-01'});
      await saveMember({...appointment,name:'Archived fixture',show_public:true,active:false});
    });
    for(const [role,id,aal,isMember] of [['anon',null,null,false],['authenticated',applicant,'aal1',true]])await asRole(role,id,aal,async()=>{const row=(await directory(isMember)).find(c=>c.id===committee);assert.ok(!row.members.some(m=>/Future|Past|Archived/.test(m.name)));});
    await asRole('authenticated',admin,'aal2',()=>save({...details,show_public:true,active:false},stamp,committee));
    await asRole('anon',null,null,async()=>assert.ok(!(await directory()).some(c=>c.id===committee)));
    await asRole('authenticated',applicant,'aal1',async()=>assert.ok(!(await directory(true)).some(c=>c.id===committee)));
    assert.equal(await scalar("select count(*) from public.user_roles where user_id=$1 and role='admin'",[applicant]),0);
    assert.equal(await scalar("select count(*) from private.leadership_audit where action='committee_saved' and details->>'committee_id'=$1",[committee]),3);
    await asRole('authenticated',staff,'aal1',()=>assert.rejects(directory.bind(null,true),/Approved membership/));
  });
}
