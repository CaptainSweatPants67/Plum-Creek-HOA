import type { Metadata } from "next";
import Link from "next/link";
import { ArchitecturalRequestForm } from "./ArchitecturalRequestForm";

export const metadata: Metadata = {
  title: "Architectural Approval Request | Plum Creek",
  description:
    "Prepare and email an architectural approval request to the Plum Creek HOA Architectural Control Committee.",
};

export default function ArchitecturalRequestPage() {
  return (
    <main className="inner-page">
      <section className="inner-hero architectural-hero">
        <p className="section-kicker">Before exterior work begins</p>
        <h1>Architectural approval request</h1>
        <p>
          Share your proposed exterior improvement with the Architectural
          Control Committee for review before starting covered work.
        </p>
      </section>

      <section className="request-section">
        <div className="request-guidance">
          <div>
            <p className="section-kicker">Prepare your request</p>
            <h2>What to include</h2>
          </div>
          <div className="request-guidance-copy">
            <p>
              Plum Creek&apos;s recorded restrictions call for prior review of
              covered exterior projects. Complete the form below and include
              enough information for the committee to evaluate the proposal.
            </p>
            <ul>
              <li>Construction plans or a clear drawing of the proposed work</li>
              <li>A site or property plan showing the project location</li>
              <li>Dimensions, materials, finishes, and exterior colors</li>
              <li>Relevant photographs, brochures, or product specifications</li>
            </ul>
            <p className="request-reminder">
              Do not begin work until you receive approval from the committee.
              City permits or requirements may also apply and are separate from
              HOA approval.
            </p>
            <div className="request-resource-links">
              <a href="/documents/declaration-of-restrictions.pdf" target="_blank">
                Read the restrictions <span aria-hidden="true">↗</span>
              </a>
              <Link href="/committees/">
                About the committee <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        <ArchitecturalRequestForm />
      </section>
    </main>
  );
}
