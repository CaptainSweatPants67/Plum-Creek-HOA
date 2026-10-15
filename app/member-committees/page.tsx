import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
import { MemberPageHeading } from "../components/MemberPageHeading";
export const metadata: Metadata = { title: "Member Committee Directory | Plum Creek", robots: { index: false, follow: false } };
export default function MemberCommitteesPage() { return <main className="portal-app"><MemberPageHeading title="Our committees" description="Meet the neighbors helping our community, including appointments shared only with members." /><Portal view="committees" /></main>; }
