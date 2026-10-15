"use client";

import { useEffect,useState,type FormEvent } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceSection } from "./WorkspaceSection";
type Request={id:string;user_id:string;display_name:string;email:string;phone:string;mailing_address:string;lot_number:number;street_address:string;status:string;relationship:string;request_note:string;review_note:string;notification_email?:string;occupancy_choice?:string|null;email_notice_consent?:boolean;email_notice_consented_at?:string};
type Property={id:string;lot_number:number;street_address:string;occupancy_status:string;verified_contacts:{display_name:string;relationship:string}[];historical_contacts:{display_name:string;verification:string}[]};
type Workspace={requests:Request[];properties:Property[]};

export function StaffWorkspace({client,userId,isAdmin=false,onChanged}:{client:SupabaseClient;userId:string;isAdmin?:boolean;onChanged?:()=>void}){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [revision,setRevision]=useState(0);
  const [requestStatus,setRequestStatus]=useState("pending");
  const [loadError,setLoadError]=useState("");
  useEffect(()=>{let active=true;const load=()=>{void client.rpc("get_staff_workspace").then(({data,error})=>{if(!active)return;if(error){setWorkspace(null);setLoadError(`Requests could not be loaded: ${error.message}`);}else{setWorkspace(data as Workspace);setLoadError("");}});};load();window.addEventListener("focus",load);return()=>{active=false;window.removeEventListener("focus",load);};},[client,revision]);
  async function review(event:FormEvent<HTMLFormElement>,requestId:string){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
    const result=await client.rpc("review_property_access_request",{p_request_id:requestId,p_decision:data.get("decision"),p_note:String(data.get("review_note")).trim()});
    setBusy(false);setMessage(result.error?result.error.message:"Request reviewed. Property access has been updated.");if(!result.error){setRevision((v)=>v+1);onChanged?.();}
  }
  const visibleRequests=workspace?.requests.filter(request=>requestStatus==="all"||request.status===requestStatus)??[];
  return <>
    {message&&<p className="portal-notice" role="status">{message}</p>}
    <WorkspaceSection title="Property verification reviews" description={workspace ? `${workspace.requests.filter(request=>request.status==='pending').length} pending requests` : "Loading requests"} defaultOpen><p>Check current ownership and record the evidence source. A signup passcode or historical contact match is not verification. {isAdmin?"System administrators may review their own request; the decision and evidence are recorded.":"Another reviewer must handle your own request."}</p>
      <button type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh requests</button>
      {loadError&&<p role="status" className="portal-notice">{loadError}</p>}
      <label className="portal-search">Review status<select value={requestStatus} onChange={event=>setRequestStatus(event.target.value)}><option value="pending">Pending requests</option><option value="approved">Approved access</option><option value="rejected">Rejected requests</option><option value="revoked">Revoked access</option><option value="all">All requests</option></select></label>
      {!workspace?<p>{loadError?"Use Refresh requests to try again. Verify your authenticator if requested.":"Loading staff information…"}</p>:visibleRequests.length===0?<p>No submitted requests with this status. Accounts that have not submitted an application are listed under Member accounts &amp; workspace access.</p>:visibleRequests.map((request)=><article className="portal-review-card" key={request.id}>
        <h3>{request.display_name} — Lot {request.lot_number}</h3><p>{request.street_address}<br/>Login email: {request.email}<br/>HOA notifications: {request.notification_email||request.email}<br/>{request.phone||"No phone provided"}<br/>{request.mailing_address||"No mailing address provided"}</p>
        <p>Member&apos;s occupancy answer: {request.occupancy_choice==="rental"?"Rents out or leases the home":request.occupancy_choice==="owner_occupied"?"Currently lives in the home":"Not yet selected"}</p>
        <p>Email-notice consent: <strong>{request.email_notice_consent?"Consented":"No consent recorded"}</strong>{request.email_notice_consent&&request.email_notice_consented_at?` · ${new Date(request.email_notice_consented_at).toLocaleString()}`:""}</p>
        <p>Requested as {request.relationship.replaceAll("_"," ")} · <strong>{request.status}</strong></p><p>{request.request_note}</p>{request.review_note&&<p>Previous review: {request.review_note}</p>}
        {(request.user_id!==userId||isAdmin) && ["pending","approved"].includes(request.status)?<form className="portal-form" onSubmit={(event)=>review(event,request.id)}>
          {request.user_id===userId&&<p className="portal-notice">Administrator self-review: record the current ownership evidence you checked.</p>}
          <label>Decision<select name="decision">{request.status==="pending"?<><option value="approved">Approve ownership</option><option value="rejected">Reject request</option></>:<option value="revoked">Revoke property access</option>}</select></label>
          <label>Verification source or decision reason<textarea name="review_note" maxLength={1000} required placeholder="Record the current ownership evidence checked, or the reason for rejection or revocation."/></label><button disabled={busy}>Save review decision</button>
        </form>:request.user_id===userId&&<p>Another authorized reviewer must handle your request.</p>}
      </article>)}
    </WorkspaceSection>
    <p className="portal-notice">Lot records, historical contacts, occupancy and email notices are now on <Link href="/admin/properties/">Property management</Link>. Financial records are on <Link href="/admin/treasury/">Treasury</Link>.</p>
  </>;
}
