import type { Metadata } from "next";
import { Portal } from "../portal/Portal";
export const metadata: Metadata = { title: "HOA Administration | Plum Creek", description: "Authorized leadership tools for membership and property management.", robots: { index: false, follow: false } };
export default function AdminPage() {
  return <main className="portal-app"><section className="portal-page-heading"><p className="section-kicker">Private leadership workspace</p><h1>HOA administration</h1><p>Review membership, rental and trust information, maintain leadership appointments, and schedule meetings and events.</p></section><Portal view="admin" /></main>;
}
