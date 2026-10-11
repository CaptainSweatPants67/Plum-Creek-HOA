import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
export const metadata: Metadata = { title: "Member Information | Plum Creek", description: "Your current contact information and approved HOA properties.", robots: { index: false, follow: false } };
export default function MembersPage() {
  return <main className="inner-page"><section className="inner-hero"><p className="section-kicker">Private member information</p><h1>My information and properties</h1><p>Maintain your current contact information, request property verification, and see approved property access.</p></section><Portal view="members" /></main>;
}
