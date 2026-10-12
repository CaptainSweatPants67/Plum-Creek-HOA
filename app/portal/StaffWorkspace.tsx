"use client";

import { useEffect,useState,type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceSection } from "./WorkspaceSection";
type Request={id:string;user_id:string;display_name:string;email:string;phone:string;mailing_address:string;lot_number:number;street_address:string;status:string;relationship:string;request_note:string;review_note:string;notification_email?:string;occupancy_choice?:string|null;email_notice_consent?:boolean;email_notice_consented_at?:string};
type Property={id:string;lot_number:number;street_address:string;occupancy_status:string;verified_contacts:{display_name:string;relationship:string}[];historical_contacts:{display_name:string;verification:string}[]};
type Workspace={requests:Request[];properties:Property[]};

export function StaffWorkspace({client,userId,onChanged}:{client:SupabaseClient;userId:string;onChanged?:()=>void}){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [revision,setRevision]=useState(0);const [search,setSearch]=useState("");
  const [requestStatus,setRequestStatus]=useState("pending");
  useEffect(()=>{let active=true;void client.rpc("get_staff_workspace").then(({data,error})=>{if(!active)return;if(error){setWorkspace(null);setMessage("Serving Director or Officer authorization with MFA is required.");}else setWorkspace(data as Workspace);});return()=>{active=false;};},[client,revision]);
  async function review(event:FormEvent<HTMLFormElement>,requestId:string){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
    const result=await client.rpc("review_property_access_request",{p_request_id:requestId,p_decision:data.get("decision"),p_note:String(data.get("review_note")).trim()});
    setBusy(false);setMessage(result.error?result.error.message:"Request reviewed. Property access has been updated.");if(!result.error){setRevision((v)=>v+1);onChanged?.();}
  }
  async function occupancy(event:FormEvent<HTMLFormElement>,propertyId:string){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
    const result=await client.rpc("update_property_occupancy",{p_property_id:propertyId,p_status:data.get("status"),p_note:String(data.get("note"))});
    setBusy(false);setMessage(result.error?result.error.message:"Occupancy saved. Changes are recorded in property history.");if(!result.error){setRevision((v)=>v+1);onChanged?.();}
  }
  const visibleRequests=workspace?.requests.filter(request=>requestStatus==="all"||request.status===requestStatus)??[];
  return <>
    {message&&<p className="portal-notice" role="status">{message}</p>}
    <WorkspaceSection title="Property verification reviews" description={workspace ? `${workspace.requests.filter(request=>request.status==='pending').length} pending requests` : "Loading requests"} defaultOpen><p>Check current ownership independently and record the evidence source. A signup passcode or historical contact match is not verification. You cannot review your own request.</p>
      <label className="portal-search">Review status<select value={requestStatus} onChange={event=>setRequestStatus(event.target.value)}><option value="pending">Pending requests</option><option value="approved">Approved access</option><option value="rejected">Rejected requests</option><option value="revoked">Revoked access</option><option value="all">All requests</option></select></label>
      {!workspace?<p>Loading staff information…</p>:visibleRequests.length===0?<p>No requests with this status.</p>:visibleRequests.map((request)=><article className="portal-review-card" key={request.id}>
        <h3>{request.display_name} — Lot {request.lot_number}</h3><p>{request.street_address}<br/>Login email: {request.email}<br/>HOA notifications: {request.notification_email||request.email}<br/>{request.phone||"No phone provided"}<br/>{request.mailing_address||"No mailing address provided"}</p>
        <p>Member&apos;s occupancy answer: {request.occupancy_choice==="rental"?"Rents out or leases the home":request.occupancy_choice==="owner_occupied"?"Currently lives in the home":"Not yet selected"}</p>
        <p>Email-notice consent: <strong>{request.email_notice_consent?"Consented":"No consent recorded"}</strong>{request.email_notice_consent&&request.email_notice_consented_at?` · ${new Date(request.email_notice_consented_at).toLocaleString()}`:""}</p>
        <p>Requested as {request.relationship.replaceAll("_"," ")} · <strong>{request.status}</strong></p><p>{request.request_note}</p>{request.review_note&&<p>Previous review: {request.review_note}</p>}
        {request.user_id!==userId && ["pending","approved"].includes(request.status)?<form className="portal-form" onSubmit={(event)=>review(event,request.id)}>
          <label>Decision<select name="decision">{request.status==="pending"?<><option value="approved">Approve ownership</option><option value="rejected">Reject request</option></>:<option value="revoked">Revoke property access</option>}</select></label>
          <label>Verification source or decision reason<textarea name="review_note" maxLength={1000} required placeholder="Record the current ownership evidence checked, or the reason for rejection or revocation."/></label><button disabled={busy}>Save review decision</button>
        </form>:request.user_id===userId&&<p>Another authorized reviewer must handle your request.</p>}
      </article>)}
    </WorkspaceSection>
    <WorkspaceSection title="Property management" description="Search lots, contacts, and occupancy"><p>Search all HOA lots. Imported household contacts remain visibly marked historical and unverified.</p>
      <label className="portal-search">Search lot, address, or contact<input type="search" value={search} onChange={(event)=>setSearch(event.target.value)}/></label>
      {workspace&&<p>{workspace.properties.length} HOA properties</p>}
      <div className="history-table-wrap"><table><thead><tr><th>Lot / property</th><th>Verified contacts</th><th>Historical contacts</th><th>Occupancy</th></tr></thead><tbody>
        {workspace?.properties.filter((property)=>[property.lot_number,property.street_address,...property.verified_contacts.map((c)=>c.display_name),...property.historical_contacts.map((c)=>c.display_name)].join(" ").toLowerCase().includes(search.toLowerCase())).map((property)=><tr key={property.id}>
          <td>Lot {property.lot_number}<br/>{property.street_address}</td><td>{property.verified_contacts.length?property.verified_contacts.map((contact,i)=><p key={i}>{contact.display_name} ({contact.relationship.replaceAll("_"," ")})</p>):"None approved"}</td>
          <td>{property.historical_contacts.map((contact,i)=><p key={i}>{contact.display_name}<br/><small>Historical / unverified</small></p>)}</td>
          <td><form className="portal-form portal-occupancy" key={property.occupancy_status} onSubmit={(event)=>occupancy(event,property.id)}><label>Status<select name="status" defaultValue={property.occupancy_status}><option value="unknown">Unknown</option><option value="owner_occupied">Owner occupied</option><option value="rental">Rental</option><option value="vacant">Vacant</option></select></label><label>Update note<input name="note" maxLength={1000}/></label><button disabled={busy}>Save occupancy</button></form></td>
        </tr>)}
      </tbody></table></div>
    </WorkspaceSection>
  </>;
}
