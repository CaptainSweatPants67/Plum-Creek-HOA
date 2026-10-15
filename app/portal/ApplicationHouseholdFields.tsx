"use client";

import type { Household, RelatedMember } from "../../lib/member-profile";

export function ApplicationHouseholdFields({ value, onChange, disabled }: { value: Household; onChange: (value: Household) => void; disabled: boolean }) {
  const members = value.additional_members ?? [];
  const change = (name: keyof Household, next: string | boolean) => onChange({ ...value, [name]: next });
  const memberChange = (index: number, name: keyof RelatedMember, next: string) => onChange({ ...value, additional_members: members.map((member, i) => i === index ? { ...member, [name]: next } : member) });
  return <fieldset className="application-step" disabled={disabled}><legend>Household &amp; ownership</legend>
    <p>Add a spouse or joint owner if applicable. Each person needs their own approved account to sign in.</p>
    {members.map((member,index) => <fieldset key={index} className="household-member"><legend>Additional member {index + 1}</legend>
      <div className="portal-form-row"><label>Additional member first name<input required maxLength={80} value={member.first_name} onChange={e => memberChange(index,"first_name",e.target.value)} /></label><label>Additional member last name<input required maxLength={80} value={member.last_name} onChange={e => memberChange(index,"last_name",e.target.value)} /></label></div>
      <label>Relationship<select value={member.relationship} onChange={e => memberChange(index,"relationship",e.target.value)}><option value="spouse">Spouse</option><option value="co_owner">Joint owner</option><option value="other">Other household member</option></select></label>
      <label>Additional member email<input type="email" maxLength={254} value={member.email} onChange={e => memberChange(index,"email",e.target.value)} /></label><label>Additional member phone<input type="tel" maxLength={50} value={member.phone} onChange={e => memberChange(index,"phone",e.target.value)} /></label>
      <button type="button" onClick={() => onChange({ ...value, additional_members: members.filter((_,i) => i !== index) })}>Remove additional member</button>
    </fieldset>)}
    <button type="button" disabled={members.length >= 10} onClick={() => onChange({ ...value, additional_members: [...members,{first_name:"",last_name:"",relationship:"spouse",email:"",phone:""}] })}>Add household member or joint owner</button>
    <label className="portal-checkbox"><input type="checkbox" checked={Boolean(value.is_trust)} onChange={e => change("is_trust",e.target.checked)} />This home is owned by a trust</label>
    {value.is_trust && <><label>Trust name<input required maxLength={200} value={value.trust_name ?? ""} onChange={e => change("trust_name",e.target.value)} /></label><div className="portal-form-row"><label>Trust decision maker first name<input required maxLength={80} value={value.decision_first_name ?? ""} onChange={e => change("decision_first_name",e.target.value)} /></label><label>Trust decision maker last name<input required maxLength={80} value={value.decision_last_name ?? ""} onChange={e => change("decision_last_name",e.target.value)} /></label></div><label>Trust decision maker email<input type="email" maxLength={254} value={value.decision_email ?? ""} onChange={e => change("decision_email",e.target.value)} /></label><label>Trust decision maker phone<input type="tel" maxLength={50} value={value.decision_phone ?? ""} onChange={e => change("decision_phone",e.target.value)} /></label></>}
  </fieldset>;
}
