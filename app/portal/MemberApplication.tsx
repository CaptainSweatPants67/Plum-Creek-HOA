"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Household, HouseholdProperty, MemberProfile } from "../../lib/member-profile";
import type { MemberApplicationStatus } from "../../lib/member-application";
import { validatePdf } from "../../lib/hoa-library";
import { RENTAL_MAX_BYTES, rentalError, uploadRentalAgreement, removeRentalAgreement, type RentalFile, type RentalProperty } from "../../lib/rental-agreements";
import { MemberContactFields, contactFields } from "./MemberContactFields";
import { ApplicationHouseholdFields } from "./ApplicationHouseholdFields";
import { OccupancyChoice, type HomeOccupancy } from "./OccupancyChoice";

type Property = { id: string; lot_number: number; street_address: string; is_rental: boolean };
export function MemberApplication({ client, email, status, onChanged, isAdmin }: { client: SupabaseClient; email: string; status: MemberApplicationStatus; onChanged: () => void; isAdmin: boolean }) {
  const [profile,setProfile]=useState<MemberProfile|null>(null);
  const [properties,setProperties]=useState<Property[]>([]);
  const [household,setHousehold]=useState<Household>({});
  const [propertyId,setPropertyId]=useState("");
  const [choice,setChoice]=useState<HomeOccupancy|null>(null);
  const [ready,setReady]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const [incomplete,setIncomplete]=useState<RentalFile[]>([]);
  const pending=status.requests.find(r=>r.status==="pending");
  const rental=choice==="rental" || Boolean(properties.find(p=>p.id===propertyId)?.is_rental);
  useEffect(()=>{
    if(status.phase==="pending")return;
    let active=true;
    void Promise.all([client.rpc("get_member_profile"),client.rpc("get_property_choices"),client.rpc("get_property_households"),client.rpc("get_rental_workspace")]).then(([profile,choices,households,rentals])=>{
      if(!active)return;
      const error=profile.error||choices.error||households.error||rentals.error;
      if(error){setMessage(rentalError(error));return;}
      setProfile(profile.data as MemberProfile);setProperties(choices.data as Property[]);
      setIncomplete((rentals.data.properties as RentalProperty[]).flatMap(p=>p.files.filter(f=>!f.ready&&f.can_remove)));
      if(pending){setPropertyId(pending.property_id);setChoice(pending.occupancy_choice);const home=(households.data.properties as HouseholdProperty[]).find(p=>p.request_id===pending.id);setHousehold(home?.household??{});}
      setReady(true);
    }).catch(error=>{if(active)setMessage(rentalError(error));});
    return()=>{active=false;};
  },[client,pending,status.phase,revision]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const data=new FormData(event.currentTarget);let saved=false;setBusy(true);setMessage("");
    try {
      if(!choice)throw new Error("Select whether you rent out or lease your home, or currently live in it.");
      const file=data.get("lease_pdf") as File;const start=String(data.get("lease_start")??"");const end=String(data.get("lease_end")??"");
      if(rental){await validatePdf(file,RENTAL_MAX_BYTES);if(!start||!end||end<start)throw new Error("Enter both lease dates with the end date on or after the start date.");if(start>new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'})||end<new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'}))throw new Error("The current lease dates must cover today.");}
      const result=await client.rpc("submit_member_application",{p_details:contactFields(data),p_property_id:propertyId,p_relationship:data.get("relationship"),p_note:String(data.get("note")??""),p_occupancy_choice:choice,p_notice_consent:data.has("notice_consent"),p_household:household});
      if(result.error)throw result.error;saved=true;
      if(rental)await uploadRentalAgreement(client,result.data as string,file,start,end);
      onChanged();
    }catch(error){setMessage((saved?"Your details were saved, but the rental upload needs to be completed. Retry with the PDF below. ":"")+rentalError(error));if(saved){setRevision(v=>v+1);onChanged();}}
    finally{setBusy(false);}
  }

  if(status.phase==="pending")return <section className="portal-panel application-status" aria-labelledby="application-pending"><span className="application-badge">Application submitted</span><h2 id="application-pending">Pending approval</h2><p>Your information has been submitted. The HOA will review your property ownership. You do not need to fill out the form again.</p>
    {status.requests.filter(r=>r.status==="pending").map(r=><p key={r.id}><strong>Lot {r.lot_number} — {r.street_address}</strong><br/>Submitted {new Date(r.submitted_at).toLocaleDateString()}</p>)}
    <p>After approval, the member menu and update forms will appear automatically. You can also check the status below.</p><button disabled={busy} onClick={onChanged}>Check approval status</button>{isAdmin&&<p>As system administrator, you can review your own application in <Link href="/admin/">HOA administration → Property verification reviews</Link>.</p>}
  </section>;
  return <section className="portal-panel"><span className="application-badge">{status.phase==="needs_changes"?"Application needs attention":"First-time account setup"}</span><h2>Complete your membership application</h2><p>Fill out this form once, then submit it for approval. Your contact information, home, household and any required lease are submitted together.</p>
    {status.phase==="needs_changes"&&status.requests.map(r=><p key={r.id} className="portal-notice">Lot {r.lot_number}: {r.status} — {r.review_note||"Contact the HOA before submitting an updated application."}</p>)}
    {message&&<p role="status" className="portal-notice">{message}</p>}
    {incomplete.length>0&&<div className="portal-notice"><p>Remove incomplete lease uploads before retrying your submission.</p>{incomplete.map(file=><div key={file.id}><p>{file.original_filename}</p><button disabled={busy} onClick={async()=>{setBusy(true);try{await removeRentalAgreement(client,file);setRevision(v=>v+1);setMessage("Incomplete upload removed. Submit the application again with your PDF.");}catch(error){setMessage(rentalError(error));}finally{setBusy(false);}}}>Remove incomplete rental upload</button></div>)}</div>}
    {!ready?<><p>Loading your application…</p>{message&&<button onClick={()=>setRevision(v=>v+1)}>Retry loading application</button>}</>:<form className="portal-form membership-application" onSubmit={submit}>
      <fieldset className="application-step" disabled={busy}><legend>Your contact information</legend><MemberContactFields details={profile?.details??null} profile={profile} email={email} initial/></fieldset>
      <fieldset className="application-step" disabled={busy}><legend>Your home</legend><label>HOA property<select required value={propertyId} disabled={Boolean(pending)} onChange={e=>{setPropertyId(e.target.value);setChoice(null);}}><option value="">Select your lot and address</option>{properties.map(p=><option key={p.id} value={p.id}>Lot {p.lot_number} — {p.street_address}{p.is_rental?" (rental)":""}</option>)}</select></label>
        <label>Your relationship<select name="relationship" defaultValue={pending?.relationship??"owner"}><option value="owner">Owner</option><option value="co_owner">Co-owner</option></select></label>
        <OccupancyChoice value={choice} onChange={setChoice} disabled={busy}/>
        <label>Information for the reviewer<textarea name="note" maxLength={1000} defaultValue={pending?.request_note??""} placeholder="For example, when you purchased the property. Do not include identity documents or financial details."/></label>
        {rental&&<><p>A rental agreement PDF and current lease dates are required for this rental home.</p><div className="portal-form-row"><label>Current lease start date<input name="lease_start" type="date" required/></label><label>Current lease end date<input name="lease_end" type="date" required/></label></div><label>Current rental agreement PDF (maximum 2 MB)<input name="lease_pdf" type="file" accept="application/pdf,.pdf" required/></label></>}
      </fieldset>
      <ApplicationHouseholdFields value={household} onChange={setHousehold} disabled={busy}/>
      <p>Submitting asks the HOA to verify ownership; a signup code or historical contact record does not establish ownership.</p>
      <button disabled={busy||incomplete.length>0} type="submit">{busy?"Submitting…":"Submit membership application"}</button>
    </form>}
  </section>;
}
