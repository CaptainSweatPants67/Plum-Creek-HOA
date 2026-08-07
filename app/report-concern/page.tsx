import type { Metadata } from "next";
import Link from "next/link";
import { ConcernReportForm } from "./ConcernReportForm";

export const metadata: Metadata = {
  title: "Report an Issue or Concern | Plum Creek HOA",
  description:
    "Prepare an email to the Plum Creek HOA Board about a general concern, possible covenants violation, or other neighborhood issue.",
};

export default function ReportConcernPage() {
  return (
    <main className="inner-page">
      <section className="inner-hero architectural-hero">
        <p className="section-kicker">Contact the Board</p>
        <h1>Report an issue or concern</h1>
        <p>
          Share a general concern, possible covenants violation, or another
          neighborhood issue with the Plum Creek HOA Board.
        </p>
      </section>

      <section className="request-section">
        <div className="request-guidance">
          <div>
            <p className="section-kicker">Before you begin</p>
            <h2>Helpful details make follow-up easier.</h2>
          </div>
          <div>
            <p>
              Include the location, date, factual observations, and any helpful
              context. You can attach photographs or documents after your email
              app opens.
            </p>
            <p>
              For emergencies or immediate threats, contact the appropriate
              emergency service instead of using this form. You can review the
              neighborhood rules on the{" "}
              <Link href="/documents/">HOA Documents page</Link>.
            </p>
          </div>
        </div>

        <ConcernReportForm />
      </section>
    </main>
  );
}
