import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
export const metadata: Metadata = { title: "Member Minutes & Announcements | Plum Creek", robots: { index: false, follow: false } };
export default function MemberDocumentsPage() {
  return <main className="inner-page"><section className="inner-hero"><p className="section-kicker">For signed-in members</p><h1>Minutes &amp; announcements</h1><p>Read HOA updates and download published meeting minutes.</p></section><Portal view="documents" /></main>;
}
