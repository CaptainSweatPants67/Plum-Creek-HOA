import type { Metadata } from "next";
import Link from "next/link";
import { CommitteeDirectory } from "../components/CommitteeDirectory";

export const metadata: Metadata = { title: "HOA Committees | Plum Creek", description: "Plum Creek HOA committees and opportunities to participate." };
export default function CommitteesPage() {
  return <main className="inner-page"><section className="inner-hero committees-hero"><p className="section-kicker">Neighbors working together</p><h1>HOA committees</h1><p>Plum Creek committees help the Board serve the neighborhood, review community needs, and welcome homeowner participation.</p></section>
    <section className="committees-section"><div className="committee-appointment-note"><span>Annual appointments</span><p>Committees serve under the direction of the Board of Directors. Committee members are appointed or reviewed by the Board and renewed each year. The recorded restrictions assign the Architectural Control Committee directly to the current Board of Directors.</p></div>
      <CommitteeDirectory />
      <div className="committee-contact-band"><div><p className="section-kicker">Get involved</p><h2>Interested in helping?</h2></div><p>Contact the Board about committee openings or share an idea for the neighborhood.</p><Link href="/committee-volunteer/">Volunteer for a committee</Link></div>
    </section></main>;
}
