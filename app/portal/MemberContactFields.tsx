"use client";

import { NOTICE_CONSENT, type MemberDetails, type MemberProfile } from "../../lib/member-profile";

export function MemberContactFields({ details, profile, email, initial = false }: { details: MemberDetails | null; profile: MemberProfile | null; email: string; initial?: boolean }) {
  return <>
    {details?.display_name && !details.first_name && <p>Previously saved name: {details.display_name}. Please enter your first and last names below.</p>}
    <div className="portal-form-row"><label>First name<input name="first_name" autoComplete="given-name" maxLength={80} defaultValue={details?.first_name ?? ""} required /></label><label>Last name<input name="last_name" autoComplete="family-name" maxLength={80} defaultValue={details?.last_name ?? ""} required /></label></div>
    <label>Login email (username)<input value={profile?.email || email} readOnly type="email" autoComplete="username" /></label>
    {!initial && <p>To change your username, use the Login email section below and confirm the change through both inboxes.</p>}
    <label>Email for HOA notifications<input name="notification_email" type="email" autoComplete="email" maxLength={254} defaultValue={details?.notification_email || profile?.email || email} required /></label>
    <p>This can differ from your login email. Updating it does not change your username.</p>
    <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={50} defaultValue={details?.phone ?? ""} /></label>
    {details?.mailing_address && !details.mailing_street && <p>Previously saved address: {details.mailing_address}. Enter its separate fields below.</p>}
    <label>Mailing street address<input name="mailing_street" autoComplete="address-line1" maxLength={180} defaultValue={details?.mailing_street ?? ""} required={initial} /></label>
    <label>Apartment / unit (optional)<input name="mailing_unit" autoComplete="address-line2" maxLength={60} defaultValue={details?.mailing_unit ?? ""} /></label>
    <div className="portal-form-row"><label>City<input name="mailing_city" autoComplete="address-level2" maxLength={100} defaultValue={details?.mailing_city ?? ""} required={initial} /></label><label>State / province<input name="mailing_state" autoComplete="address-level1" maxLength={80} defaultValue={details?.mailing_state ?? ""} required={initial} /></label><label>ZIP / postal code<input name="mailing_postal_code" autoComplete="postal-code" maxLength={20} defaultValue={details?.mailing_postal_code ?? ""} required={initial} /></label></div>
    <label>Country<input name="mailing_country" autoComplete="country-name" maxLength={80} defaultValue={details?.mailing_country || "US"} /></label>
    <label className="portal-checkbox notice-consent"><input type="checkbox" name="notice_consent" defaultChecked={profile?.notice_consent ?? false} />{NOTICE_CONSENT}</label>
    <p>Optional. Uncheck and save to withdraw email-notice consent.</p>
  </>;
}

export function contactFields(data: FormData) {
  return Object.fromEntries(["first_name", "last_name", "notification_email", "phone", "mailing_street", "mailing_unit", "mailing_city", "mailing_state", "mailing_postal_code", "mailing_country"].map(name => [name, String(data.get(name) ?? "").trim()]));
}
