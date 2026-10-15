import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
import { MemberPageHeading } from "../components/MemberPageHeading";
export const metadata: Metadata = { title: "Member Information | Plum Creek", description: "Your current contact information and approved HOA properties.", robots: { index: false, follow: false } };
export default function MembersPage() {
  return <main className="portal-app"><MemberPageHeading title="My information and properties" description="Your home, your details, your neighborhood. Complete your application or keep your approved account up to date." /><Portal view="members" /></main>;
}
