import type { Metadata } from "next";
import Link from "next/link";
import { BoardCandidateForm } from "./BoardCandidateForm";

export const metadata: Metadata = {
  title: "Run for the Board | Plum Creek",
  description:
    "Share your interest in running for a Plum Creek HOA Board seat and serving the neighborhood.",
};

export default function RunForBoardPage() {
  return (
    <main className="inner-page">
      <section className="inner-hero board-candidate-hero">
        <p className="section-kicker">Serve your neighborhood</p>
        <h1>Run for the Board</h1>
        <p>
          Share your interest in serving Plum Creek homeowners as one of five
          elected Board members.
        </p>
      </section>

      <section className="request-section">
        <div className="request-guidance">
          <div>
            <p className="section-kicker">Board elections</p>
            <h2>Bring your perspective to the table.</h2>
          </div>
          <div className="request-guidance-copy">
            <p>
              Board members serve staggered two-year terms. Two or three seats
              are voted on each year at the annual meeting of members.
            </p>
            <ul>
              <li>The Plum Creek Board has five elected members</li>
              <li>Board seats are elected by members at the annual meeting</li>
              <li>Officer positions are appointed annually by the Board</li>
              <li>The HOA will follow up about election timing and next steps</li>
            </ul>
            <p className="request-reminder">
              Selecting an officer position below expresses your interest only.
              Election is to a Board seat; officer assignments are decided by
              the Board each year.
            </p>
            <div className="request-resource-links">
              <Link href="/events/">
                View the annual meeting date <span aria-hidden="true">→</span>
              </Link>
              <Link href="/board/">
                Return to the Board page <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        <BoardCandidateForm />
      </section>
    </main>
  );
}
