"use client";

import { useEffect,useState,type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
type Request={id:string;user_id:string;display_name:string;email:string;phone:string;mailing_address:string;lot_number:number;street_address:string;status:string;relationship:string;request_note:string;review_note:string};
type Property={id:string;lot_number:number;street_address:string;occupancy_status:string;verified_contacts:{display_name:string;relationship:string}[];historical_contacts:{display_name:string;verification:string}[]};
type Workspace={requests:Request[];properties:Property[]};

export function StaffWorkspace({client,userId}:{client:SupabaseClient;userId:string}){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [revision,setRevision]=useState(0);const [search,setSearch]=useState("");
  useEffect(()=>{let active=true;void client.rpc("get_staff_workspace").then(({data,error})=>{if(!active)return;if(error){setWorkspace(null);setMessage("Serving Director or Officer authorization with MFA is required.");}else setWorkspace(data as Workspace);});return()=>{active=false;};},[client,revision]);
  async function review(event:FormEvent<HTMLFormElement>,requestId:string){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
    const result=await client.rpc("review_property_access_request",{p_request_id:requestId,p_decision:data.get("decision"),p_note:String(data.get("review_note")).trim()});
    setBusy(false);setMessage(result.error?result.error.message:"Request reviewed. Property access has been updated.");if(!result.error)setRevision((v)=>v+1);
  }
  async function occupancy(event:FormEvent<HTMLFormElement>,propertyId:string){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
    const result=await client.rpc("update_property_occupancy",{p_property_id:propertyId,p_status:data.get("status"),p_note:String(data.get("note"))});
    setBusy(false);setMessage(result.error?result.error.message:"Occupancy saved. Changes are recorded in property history.");if(!result.error)setRevision((v)=>v+1);
  }
  return <>
    {message&&<p className="portal-notice" role="status">{message}</p>}
    <div className="portal-panel"><h2>Property verification reviews</h2><p>Check current ownership independently and record the evidence source. A signup passcode or historical contact match is not verification. You cannot review your own request.</p>
      {!workspace?<p>Loading staff information…</p>:workspace.requests.length===0?<p>No verification requests yet.</p>:workspace.requests.map((request)=><article className="portal-review-card" key={request.id}>
        <h3>{request.display_name} — Lot {request.lot_number}</h3><p>{request.street_address}<br/>{request.email} · {request.phone||"No phone provided"}<br/>{request.mailing_address||"No mailing address provided"}</p>
        <p>Requested as {request.relationship.replaceAll("_"," ")} · <strong>{request.status}</strong></p><p>{request.request_note}</p>{request.review_note&&<p>Previous review: {request.review_note}</p>}
        {request.user_id!==userId && ["pending","approved"].includes(request.status)?<form className="portal-form" onSubmit={(event)=>review(event,request.id)}>
          <label>Decision<select name="decision">{request.status==="pending"?<><option value="approved">Approve ownership</option><option value="rejected">Reject request</option></>:<option value="revoked">Revoke property access</option>}</select></label>
          <label>Verification source or decision reason<textarea name="review_note" maxLength={1000} required placeholder="Record the current ownership evidence checked, or the reason for rejection or revocation."/></label><button disabled={busy}>Save review decision</button>
        </form>:request.user_id===userId&&<p>Another authorized reviewer must handle your request.</p>}
      </article>)}
    </div>
    <div className="portal-panel"><h2>Property management</h2><p>Search all HOA lots. Imported household contacts remain visibly marked historical and unverified.</p>
      <label className="portal-search">Search lot, address, or contact<input type="search" value={search} onChange={(event)=>setSearch(event.target.value)}/></label>
      {workspace&&<p>{workspace.properties.length} HOA properties</p>}
      <div className="history-table-wrap"><table><thead><tr><th>Lot / property</th><th>Verified contacts</th><th>Historical contacts</th><th>Occupancy</th></tr></thead><tbody>
        {workspace?.properties.filter((property)=>[property.lot_number,property.street_address,...property.verified_contacts.map((c)=>c.display_name),...property.historical_contacts.map((c)=>c.display_name)].join(" ").toLowerCase().includes(search.toLowerCase())).map((property)=><tr key={property.id}>
          <td>Lot {property.lot_number}<br/>{property.street_address}</td><td>{property.verified_contacts.length?property.verified_contacts.map((contact,i)=><p key={i}>{contact.display_name} ({contact.relationship.replaceAll("_"," ")})</p>):"None approved"}</td>
          <td>{property.historical_contacts.map((contact,i)=><p key={i}>{contact.display_name}<br/><small>Historical / unverified</small></p>)}</td>
          <td><form className="portal-form portal-occupancy" key={property.occupancy_status} onSubmit={(event)=>occupancy(event,property.id)}><label>Status<select name="status" defaultValue={property.occupancy_status}><option value="unknown">Unknown</option><option value="owner_occupied">Owner occupied</option><option value="rental">Rental</option><option value="vacant">Vacant</option></select></label><label>Update note<input name="note" maxLength={1000}/></label><button disabled={busy}>Save occupancy</button></form></td>
        </tr>)}
      </tbody></table></div>
    </div>
  </>;
}
