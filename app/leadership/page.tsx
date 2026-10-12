import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
export const metadata: Metadata = { title: "Officer & Director Workspace | Plum Creek", robots: { index: false, follow: false } };
export default function LeadershipPage() {
  return <main className="portal-app"><section className="portal-page-heading"><p className="section-kicker">Private leadership workspace</p><h1>Officer &amp; Director workspace</h1><p>Keep service contacts and contracts organized, and publish minutes and announcements for members.</p></section><Portal view="leadership" /></main>;
}
