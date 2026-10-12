"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HouseholdProperty, RelatedMember } from "../../lib/member-profile";
import { rentalError } from "../../lib/rental-agreements";
import { WorkspaceSection } from "./WorkspaceSection";

function HouseholdForm({ client, property }: { client: SupabaseClient; property: HouseholdProperty }) {
  const [members, setMembers] = useState<RelatedMember[]>(property.household.additional_members ?? []);
  const [trust, setTrust] = useState(Boolean(property.household.is_trust));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function changeMember(index: number, field: keyof RelatedMember, value: string) { setMembers(rows => rows.map((row, i) => i === index ? { ...row, [field]: value } : row)); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try {
      const result = await client.rpc("save_property_household", { p_request_id: property.request_id, p_details: { additional_members: members, is_trust: trust,
        trust_name: String(values.get("trust_name") ?? ""), decision_first_name: String(values.get("decision_first_name") ?? ""), decision_last_name: String(values.get("decision_last_name") ?? ""), decision_email: String(values.get("decision_email") ?? ""), decision_phone: String(values.get("decision_phone") ?? "") } });
      if (result.error) throw result.error; setMessage("Household and trust information saved. These entries do not grant account access or verify ownership.");
    } catch (error) { setMessage(rentalError(error)); } finally { setBusy(false); }
  }
  return <form className="portal-form" onSubmit={save}>
    {message && <p role="status" className="portal-notice">{message}</p>}
    <h4>Other household members or joint owners</h4>
    {members.map((member, index) => <fieldset className="household-member" key={index}><legend>Additional member {index + 1}</legend><div className="portal-form-row"><label>First name<input required maxLength={80} value={member.first_name} onChange={e => changeMember(index, "first_name", e.target.value)} /></label><label>Last name<input required maxLength={80} value={member.last_name} onChange={e => changeMember(index, "last_name", e.target.value)} /></label></div>
      <label>Relationship<select value={member.relationship} onChange={e => changeMember(index, "relationship", e.target.value)}><option value="spouse">Spouse</option><option value="co_owner">Joint owner</option><option value="other">Other household member</option></select></label>
      <div className="portal-form-row"><label>Email (optional)<input type="email" maxLength={254} value={member.email} onChange={e => changeMember(index, "email", e.target.value)} /></label><label>Phone (optional)<input type="tel" maxLength={50} value={member.phone} onChange={e => changeMember(index, "phone", e.target.value)} /></label></div><button type="button" disabled={busy} onClick={() => setMembers(rows => rows.filter((_, i) => i !== index))}>Remove additional member</button>
    </fieldset>)}
    <button type="button" disabled={busy || members.length >= 10} onClick={() => setMembers(rows => [...rows, { first_name: "", last_name: "", relationship: "spouse", email: "", phone: "" }])}>Add household member or joint owner</button>
    <label className="portal-checkbox"><input type="checkbox" checked={trust} onChange={e => setTrust(e.target.checked)} />This home is owned by a trust</label>
    <div hidden={!trust}><label>Trust name<input name="trust_name" maxLength={200} defaultValue={property.household.trust_name} required={trust} disabled={!trust} /></label><div className="portal-form-row"><label>Trust decision maker first name<input name="decision_first_name" maxLength={80} defaultValue={property.household.decision_first_name} required={trust} disabled={!trust} /></label><label>Trust decision maker last name<input name="decision_last_name" maxLength={80} defaultValue={property.household.decision_last_name} required={trust} disabled={!trust} /></label></div><div className="portal-form-row"><label>Trust decision maker email<input name="decision_email" type="email" maxLength={254} defaultValue={property.household.decision_email} disabled={!trust} /></label><label>Trust decision maker phone<input name="decision_phone" type="tel" maxLength={50} defaultValue={property.household.decision_phone} disabled={!trust} /></label></div></div>
    <button disabled={busy}>{busy ? "Please wait…" : "Save household & trust information"}</button>
  </form>;
}
export function PropertyHouseholds({ client, staff = false, revision = 0 }: { client: SupabaseClient; staff?: boolean; revision?: number }) {
  const [properties, setProperties] = useState<HouseholdProperty[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void client.rpc(staff ? "get_staff_property_households" : "get_property_households").then(({ data, error }) => { if (!active) return; if (error) setError(rentalError(error)); else { setProperties(data.properties as HouseholdProperty[]); setError(""); } }); return () => { active = false; }; }, [client, staff, revision]);
  return <WorkspaceSection title={staff ? "Households & trusts" : "Household members & trusts"} description={staff ? "Read submitted joint ownership and trust details" : "Add a spouse, joint owners, or trust decision maker"} defaultOpen={!staff}>
    <p>{staff ? "Member-submitted details support your independent ownership and trust-authority review. They do not prove ownership." : "Keep these details with each home. Each person who needs portal access must register with their own email and obtain separate ownership approval. Adding a name here does not send an invitation or grant access."}</p>
    {error && <p role="status">{error}</p>}
    {!properties ? <p>Loading household information…</p> : properties.length === 0 ? <p>No active property requests. Submit a property request to add household or trust details.</p> : properties.map(property => <details className="household-property" key={property.request_id}><summary>Lot {property.lot_number} — {property.street_address}{staff ? ` · ${property.display_name || "Member"}` : ""}{property.household.is_trust ? " · Trust" : ""}</summary>
      {staff ? <div><p>Ownership request: {property.status}</p>{property.household.is_trust && <p><strong>{property.household.trust_name}</strong><br />Decision maker: {property.household.decision_first_name} {property.household.decision_last_name}<br />{property.household.decision_email} · {property.household.decision_phone}</p>}<ul>{property.household.additional_members?.map((member, i) => <li key={i}>{member.first_name} {member.last_name} — {member.relationship.replaceAll("_", " ")}<br />{member.email} · {member.phone}</li>)}</ul>{!property.household.is_trust && !property.household.additional_members?.length && <p>No additional household or trust details submitted.</p>}</div> : <HouseholdForm client={client} property={property} />}
    </details>)}
  </WorkspaceSection>;
}
