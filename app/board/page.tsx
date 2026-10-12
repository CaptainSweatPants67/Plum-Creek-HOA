import type { Metadata } from "next";
import Link from "next/link";
import { LeadershipRoster } from "../components/LeadershipRoster";
import { getSavedLeadershipRoster } from "../../lib/leadership-source";

export const metadata: Metadata = {
  title: "HOA Board | Plum Creek",
  description:
    "Current Plum Creek HOA Board of Directors.",
};

export default function BoardPage() {
  const roster = getSavedLeadershipRoster();

  return (
    <main className="inner-page">
      <section className="inner-hero">
        <p className="section-kicker">Association leadership</p>
        <h1>HOA board</h1>
        <p>
          Meet the current Plum Creek Board of Directors.
        </p>
      </section>

      <section className="board-section">
        <div className="section-heading board-heading">
          <div>
            <p className="section-kicker">Current board</p>
            <h2>Board of Directors</h2>
          </div>
          <p>
            For Board questions, <Link href="/contact/">contact the HOA</Link>.
            {" "}<Link href="/officers/">See annual Officer appointments</Link>.
          </p>
        </div>

        <div className="board-structure-note">
          <div>
            <span>Five elected seats</span>
            <p>
              Plum Creek is governed by five Board members serving staggered
              two-year terms. Two or three seats are voted on each year at the
              annual meeting of members.
            </p>
          </div>
          <div>
            <span>Annual officer appointments</span>
            <p>
              After Board seats are filled, the Board appoints the President,
              Vice President, Secretary, and Treasurer positions each year.
            </p>
          </div>
          <div className="board-structure-actions">
            <Link href="/events/">
              See the annual meeting date <span aria-hidden="true">→</span>
            </Link>
            <Link className="board-run-button" href="/run-for-board/">
              Run for the Board <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

      </section>
      <LeadershipRoster savedRoster={roster} mode="board" />
    </main>
  );
}
