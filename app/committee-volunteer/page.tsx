import type { Metadata } from "next";
import Link from "next/link";
import { CommitteeVolunteerForm } from "./CommitteeVolunteerForm";

export const metadata: Metadata = {
  title: "Volunteer for a Committee | Plum Creek",
  description:
    "Share your interest in volunteering for a Plum Creek HOA committee or neighborhood project.",
};

export default function CommitteeVolunteerPage() {
  return (
    <main className="inner-page">
      <section className="inner-hero volunteer-hero">
        <p className="section-kicker">Share your time and talents</p>
        <h1>Volunteer for a committee</h1>
        <p>
          Tell the Board how you would like to help strengthen the Plum Creek
          community.
        </p>
      </section>

      <section className="request-section">
        <div className="request-guidance">
          <div>
            <p className="section-kicker">Get involved</p>
            <h2>Neighbors make a difference.</h2>
          </div>
          <div className="request-guidance-copy">
            <p>
              Committee volunteers help review neighborhood needs, support
              community projects, and welcome residents. You do not need prior
              HOA experience to express interest.
            </p>
            <ul>
              <li>Choose a committee or indicate that you are open to any need</li>
              <li>Share relevant interests, experience, or project ideas</li>
              <li>Tell the Board what type of participation works for you</li>
              <li>Submit your interest for consideration during appointments</li>
            </ul>
            <p className="request-reminder">
              The Board makes or reviews committee appointments and renews them
              each year. Submitting this form expresses interest but does not
              guarantee an appointment.
            </p>
            <div className="request-resource-links">
              <Link href="/committees/">
                Explore the committees <span aria-hidden="true">→</span>
              </Link>
              <a href="mailto:pchoa66030@gmail.com">
                Email the HOA directly <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>

        <CommitteeVolunteerForm />
      </section>
    </main>
  );
}
