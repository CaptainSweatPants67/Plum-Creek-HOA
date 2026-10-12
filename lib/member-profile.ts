export type MemberDetails = { display_name: string; first_name: string; last_name: string; notification_email: string; phone: string; mailing_street: string; mailing_unit: string; mailing_city: string; mailing_state: string; mailing_postal_code: string; mailing_country: string; mailing_address: string };
export type MemberProfile = { details: MemberDetails | null; email: string; pending_email: string | null; notice_consent: boolean; consented_at: string | null };
export type RelatedMember = { first_name: string; last_name: string; relationship: "spouse" | "co_owner" | "other"; email: string; phone: string };
export type Household = { additional_members?: RelatedMember[]; is_trust?: boolean; trust_name?: string; decision_first_name?: string; decision_last_name?: string; decision_email?: string; decision_phone?: string };
export type HouseholdProperty = { request_id: string; lot_number: number; street_address: string; display_name: string | null; status: string; household: Household };
export const NOTICE_CONSENT = "I consent to emailed notices in lieu of mailed notices to my property. I agree to keep my email address up to date.";
