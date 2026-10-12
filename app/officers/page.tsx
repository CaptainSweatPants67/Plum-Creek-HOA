import type { Metadata } from "next";
import Link from "next/link";
import { LeadershipRoster } from "../components/LeadershipRoster";
import { getSavedLeadershipRoster } from "../../lib/leadership-source";

export const metadata: Metadata = { title: "HOA Officers | Plum Creek", description: "Current Plum Creek HOA officer appointments." };

export default function OfficersPage() {
  return <main className="inner-page">
    <section className="inner-hero"><p className="section-kicker">Association leadership</p><h1>HOA officers</h1>
      <p>The Board appoints the President, Vice President, Secretary, and Treasurer each year. Officer appointments are recorded separately from elected Director service.</p>
      <Link href="/board/">View the Board of Directors →</Link></section>
    <LeadershipRoster savedRoster={getSavedLeadershipRoster()} mode="officers" />
  </main>;
}
