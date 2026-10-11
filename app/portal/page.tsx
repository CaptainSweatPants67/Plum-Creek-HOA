import type { Metadata } from "next";
import { Portal } from "./Portal";

export const metadata: Metadata = { title: "Homeowner Portal | Plum Creek", description: "Homeowner sign-in and authorized Plum Creek HOA leadership tools.", robots: { index: false, follow: false } };

export default function PortalPage() {
  return <main className="inner-page"><section className="inner-hero"><p className="section-kicker">Private homeowner portal</p><h1>Homeowner sign-in</h1>
    <p>Create an account with your current email and the HOA signup passcode. Property ownership must be approved separately.</p></section><Portal /></main>;
}
