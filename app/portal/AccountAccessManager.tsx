"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceSection } from "./WorkspaceSection";
import { rentalError } from "../../lib/rental-agreements";

type Account = {user_id:string;email:string;display_name:string;is_admin:boolean;administration:boolean;leadership_tools:boolean;application_status:string};
export function AccountAccessManager({client,onChanged}:{client:SupabaseClient;onChanged:()=>void}){
  const [accounts,setAccounts]=useState<Account[]|null>(null);const [search,setSearch]=useState("");const [message,setMessage]=useState("");const [revision,setRevision]=useState(0);const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;void client.rpc("get_account_access_workspace").then(({data,error})=>{if(!active)return;if(error){setMessage(rentalError(error));setAccounts(null);}else setAccounts(data.accounts as Account[]);});return()=>{active=false;};},[client,revision]);
  async function save(event:FormEvent<HTMLFormElement>,account:Account){
    event.preventDefault();if(busy)return;setBusy(true);setMessage("");const fields=new FormData(event.currentTarget);
    try{const {error}=await client.rpc("set_account_workspace_access",{p_user_id:account.user_id,p_administration:fields.has("administration"),p_leadership_tools:fields.has("leadership_tools")});if(error)throw error;setMessage(`Workspace access saved for ${account.display_name}.`);setRevision(v=>v+1);onChanged();}
    catch(error){setMessage(rentalError(error));}finally{setBusy(false);}
  }
  return <WorkspaceSection title="Member accounts & workspace access" description="See registered accounts and grant or revoke private tools" defaultOpen>
    <p>All confirmed registered accounts appear here, including people who saved contact details without submitting an application. Only submitted property requests appear in the review queue above.</p>
    <p>Check the workspaces a person may use, then save. Access requires an authenticator verification. These settings do not appoint a public Director or Officer or approve property ownership.</p>
    <p>HOA administration covers membership, property/rental reviews and meetings. Officer &amp; Director tools cover contacts, contracts, minutes and announcements. System administrator settings and the password safe remain restricted.</p>
    {message&&<p role="status" className="portal-notice">{message}</p>}
    <div className="portal-actions"><label className="portal-search">Find a registered member<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><button type="button" onClick={()=>setRevision(v=>v+1)}>Refresh accounts</button></div>
    {!accounts?<p>Loading registered accounts…</p>:<><p>{accounts.length} confirmed accounts</p>{accounts.filter(a=>(a.display_name+" "+a.email).toLowerCase().includes(search.toLowerCase())).map(account=><article className="portal-review-card" key={account.user_id}>
      <h3>{account.display_name}</h3><p>{account.email} · {account.is_admin?"System administrator":"Registered member"}</p><p>Membership application: <strong>{account.application_status.replaceAll("_"," ")}</strong></p>
      <form key={`${account.user_id}-${account.administration}-${account.leadership_tools}`} className="portal-form workspace-access-form" onSubmit={event=>save(event,account)}><label className="portal-checkbox"><input type="checkbox" name="leadership_tools" defaultChecked={account.leadership_tools} disabled={busy||account.is_admin}/>Officer &amp; Director tools</label><label className="portal-checkbox"><input type="checkbox" name="administration" defaultChecked={account.administration} disabled={busy||account.is_admin}/>HOA administration</label>
        {account.is_admin?<p>System administrators retain both workspaces.</p>:<button disabled={busy}>Save workspace access</button>}
      </form></article>)}</>}
  </WorkspaceSection>;
}
