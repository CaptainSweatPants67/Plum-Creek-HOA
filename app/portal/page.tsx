import type { Metadata } from "next";
import { Portal } from "./Portal";

export const metadata: Metadata = { title: "Homeowner Portal | Plum Creek", description: "Homeowner sign-in and authorized Plum Creek HOA leadership tools.", robots: { index: false, follow: false } };

export default function PortalPage() {
  return <main className="portal-app"><section className="portal-page-heading"><p className="section-kicker">Private homeowner portal</p><h1>Homeowner portal</h1>
    <p>Sign in or create an account. After confirming your email, submit your membership application for ownership approval.</p></section><Portal /></main>;
}
