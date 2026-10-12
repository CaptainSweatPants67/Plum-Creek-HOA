import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
export const metadata: Metadata = { title: "Member Library | Plum Creek", robots: { index: false, follow: false } };
export default function MemberDocumentsPage() {
  return <main className="portal-app"><section className="portal-page-heading"><p className="section-kicker">For signed-in members</p><h1>Member library</h1><p>Bylaws, leadership history, meeting minutes, and announcements.</p></section><Portal view="documents" /></main>;
}
