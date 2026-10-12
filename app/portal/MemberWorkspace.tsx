"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePdf } from "../../lib/hoa-library";
import { RENTAL_MAX_BYTES, rentalError, uploadRentalAgreement } from "../../lib/rental-agreements";
import { RentalWorkspace } from "./RentalWorkspace";
import { WorkspaceSection } from "./WorkspaceSection";

type Property = { id: string; lot_number: number; street_address: string; occupancy_status?: string; relationship?: string; is_rental?: boolean };
type Request = { id: string; lot_number: number; street_address: string; status: string; relationship: string; review_note: string };
type Details = { display_name: string; phone: string; mailing_address: string };
type Workspace = { properties: Property[]; requests: Request[] };

export function MemberWorkspace({ client, userId, email }: { client: SupabaseClient; userId: string; email: string }) {
  const [details,setDetails]=useState<Details|null>(null);
  const [workspace,setWorkspace]=useState<Workspace>({properties:[],requests:[]});
  const [choices,setChoices]=useState<Property[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const [propertyId,setPropertyId]=useState("");
  const [declaredRental,setDeclaredRental]=useState(false);
  const selectedRental=Boolean(choices.find(p=>p.id===propertyId)?.is_rental);
  const rental=declaredRental||selectedRental;
  useEffect(()=>{
    let active=true;
    void Promise.all([client.from("portal_account_details").select("display_name,phone,mailing_address").eq("user_id",userId).maybeSingle(),client.rpc("get_member_workspace"),client.rpc("get_property_choices")]).then(([profile,member,properties])=>{
      if(!active)return;
      if(profile.error || member.error || properties.error) {setMessage("Member information could not be loaded. Confirm your email and try again.");return;}
      setDetails(profile.data as Details|null);setWorkspace(member.data as Workspace);setChoices(properties.data as Property[]);setLoaded(true);
    });
    return()=>{active=false;};
  },[client,userId,revision]);
  async function saveDetails(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
    const result=await client.from("portal_account_details").upsert({user_id:userId,display_name:String(data.get("display_name")).trim(),phone:String(data.get("phone")).trim(),mailing_address:String(data.get("mailing_address")).trim()}).select("user_id").single();
    setBusy(false);setMessage(result.error?result.error.message:"Current contact information saved. Property ownership still requires separate approval.");
    if(!result.error)setRevision((v)=>v+1);
  }
  async function submitRequest(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setBusy(true);setMessage("");let saved=false;
    try {
      const file=data.get("lease_pdf") as File;
      const start=String(data.get("lease_start")??"");const end=String(data.get("lease_end")??"");
      if(rental){await validatePdf(file,RENTAL_MAX_BYTES);if(!start||!end||end<start)throw new Error("Enter both lease dates with the end date on or after the start date.");}
      const result=await client.rpc("request_property_verification",{p_property_id:propertyId,p_relationship:data.get("relationship"),p_note:String(data.get("note")),p_is_rental:rental});
      if(result.error)throw new Error(result.error.code==="23505"?"A pending or approved request already exists for this property. Use its rental form below.":result.error.message);
      saved=true;
      if(rental)await uploadRentalAgreement(client,result.data as string,file,start,end);
      form.reset();setPropertyId("");setDeclaredRental(false);setMessage("Your request is pending ownership review by an authorized Director or Officer."+(rental?" Rental paperwork saved; its dates must cover today to access member information.":""));
    }catch(error){setMessage((saved?"Property request saved. Complete its rental paperwork below. ":"")+rentalError(error));}
    finally{setBusy(false);if(saved)setRevision(v=>v+1);}
  }
  return <>
    {message&&<p className="portal-notice" role="status">{message}</p>}
    <WorkspaceSection title="Your current contact information" description="Keep your name, phone, and mailing address current" defaultOpen><p>Use your individual information. Historical household records are not used to verify your account.</p>
      {!loaded?<p>Loading member information…</p>:<form key={JSON.stringify(details)} onSubmit={saveDetails} className="portal-form">
        <label>Full name<input name="display_name" autoComplete="name" maxLength={160} defaultValue={details?.display_name??""} required/></label>
        <label>Confirmed login email<input value={email} readOnly type="email"/></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={50} defaultValue={details?.phone??""}/></label>
        <label>Mailing address<textarea name="mailing_address" autoComplete="street-address" maxLength={500} defaultValue={details?.mailing_address??""}/></label>
        <button disabled={busy}>Save contact information</button>
      </form>}
    </WorkspaceSection>
    <WorkspaceSection title="Your approved properties" description="Verified property details" defaultOpen>
      {workspace.properties.length===0?<p>No property details are available. Ownership approval and current paperwork for rental homes are required. Check your requests and rental forms below.</p>:workspace.properties.map((property)=><article className="rental-property" key={property.id}><span>Lot {property.lot_number}</span><h3>{property.street_address}</h3><p>{property.relationship?.replaceAll("_"," ")} · {property.occupancy_status?.replaceAll("_"," ")}</p></article>)}
      <p>Approval provides access to your property information. Formal voting eligibility is handled separately.</p>
    </WorkspaceSection>
    <WorkspaceSection title="Request property verification" description="Add a property and track ownership review" defaultOpen><p>A Director or Officer will check ownership independently. Names or emails in an old contact list are not proof of ownership.</p>
      <form className="portal-form" onSubmit={submitRequest}><label>HOA property<select name="property_id" required value={propertyId} onChange={event=>{setPropertyId(event.target.value);setDeclaredRental(false);}}><option value="">Select your lot and address</option>{choices.map((property)=><option key={property.id} value={property.id}>Lot {property.lot_number} — {property.street_address}{property.is_rental?" (rental)":""}</option>)}</select></label>
        <label>Your relationship<select name="relationship"><option value="owner">Owner</option><option value="co_owner">Co-owner</option></select></label>
        <label>Information for the reviewer<textarea name="note" maxLength={1000} placeholder="For example, when you purchased the property. Do not include identity documents or financial details."/></label>
        <label className="rental-toggle"><input type="checkbox" checked={rental} disabled={selectedRental} onChange={event=>setDeclaredRental(event.target.checked)}/>I rent this home</label>
        {selectedRental&&<p>The HOA has marked this property as a rental. Lease paperwork is required.</p>}
        {rental&&<><div className="portal-form-row"><label>Current lease start date<input name="lease_start" type="date" required/></label><label>Current lease end date<input name="lease_end" type="date" required/></label></div><label>Current rental agreement PDF (maximum 2 MB)<input name="lease_pdf" type="file" accept="application/pdf,.pdf" required/></label><p>A completed PDF with dates covering today is required for member information.</p></>}
        <button disabled={busy||!details}>Submit verification request</button>{!details&&<p>Save your current contact information first.</p>}
      </form>
      <h3>Your requests</h3>{workspace.requests.length===0?<p>No requests submitted.</p>:<div className="history-table-wrap"><table><thead><tr><th>Property</th><th>Status</th><th>Reviewer response</th></tr></thead><tbody>{workspace.requests.map((request)=><tr key={request.id}><td>Lot {request.lot_number}<br/>{request.street_address}</td><td>{request.status}</td><td>{request.review_note||"Awaiting review"}</td></tr>)}</tbody></table></div>}
    </WorkspaceSection>
    <RentalWorkspace client={client} revision={revision} onChanged={()=>setRevision(v=>v+1)}/>
  </>;
}
