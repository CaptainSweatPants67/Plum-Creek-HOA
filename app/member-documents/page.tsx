import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
import { MemberPageHeading } from "../components/MemberPageHeading";
export const metadata: Metadata = { title: "Member Library | Plum Creek", robots: { index: false, follow: false } };
export default function MemberDocumentsPage() {
  return <main className="portal-app"><MemberPageHeading title="Member library" description="Community documents in one place: bylaws, leadership history, meeting minutes, and announcements." /><Portal view="documents" /></main>;
}
