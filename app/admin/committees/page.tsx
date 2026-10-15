import type { Metadata } from "next";
import { Portal } from "../../portal/Portal";
export const metadata: Metadata = { title: "Committee Administration | Plum Creek", robots: { index: false, follow: false } };
export default function CommitteeAdminPage() { return <main className="portal-app"><section className="portal-page-heading"><p className="section-kicker">Private leadership workspace</p><h1>Committees &amp; members</h1><p>Manage committee appointments and public or member-only visibility.</p></section><Portal view="committee-admin" /></main>; }
