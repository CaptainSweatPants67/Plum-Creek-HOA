import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";

type BoardMember = {
  year: number;
  name: string;
  position: string;
};

const currentBoard = [
  {
    name: "Laura McKinney",
    position: "President",
    term: "Seat 2024–2026",
  },
  {
    name: "Michael Bruna",
    position: "Vice President",
    term: "Seat 2025–2027",
  },
  {
    name: "Lori Whitson",
    position: "Secretary",
    term: "Seat 2025–2027",
  },
  {
    name: "Charity Coker",
    position: "Treasurer",
    term: "Seat 2025–2027",
  },
  {
    name: "Vacant",
    position: "Member",
    term: "Seat Open 2026",
    vacant: true,
  },
];

export const metadata: Metadata = {
  title: "HOA Board | Plum Creek",
  description:
    "Current Plum Creek HOA board members and historical board roster.",
};

function getBoardMembers(): BoardMember[] {
  const source = readFileSync(
    path.join(process.cwd(), "Info", "Board.txt"),
    "utf8",
  );

  return source
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split("\t").map((value) => value.trim()))
    .filter(([year, name, position]) => year && name && position)
    .map(([year, name, position]) => ({
      year: Number(year),
      name,
      position,
    }))
    .filter((member) => Number.isFinite(member.year));
}

export default function BoardPage() {
  const members = getBoardMembers();
  const history = [...members].sort((a, b) => b.year - a.year);

  return (
    <main className="inner-page">
      <section className="inner-hero">
        <p className="section-kicker">Association leadership</p>
        <h1>HOA board</h1>
        <p>
          Meet the latest board roster on file and review Plum Creek&apos;s
          leadership history.
        </p>
      </section>

      <section className="board-section">
        <div className="section-heading board-heading">
          <div>
            <p className="section-kicker">Current board</p>
            <h2>2025–2026 roster</h2>
          </div>
          <p>For board questions, email pchoa66030@gmail.com.</p>
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

        <div className="board-grid">
          {currentBoard.map((member) => (
            <article
              className={`board-card${member.vacant ? " board-card-vacant" : ""}`}
              key={`${member.name}-${member.position}`}
            >
              <span>{member.position}</span>
              <small>Officer</small>
              <h3>{member.name}</h3>
              <p className="board-term">{member.term}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="history-section">
        <div className="section-heading history-heading">
          <div>
            <p className="section-kicker">Association record</p>
            <h2>Board history</h2>
          </div>
          <p>Historical roster entries are shown as recorded in the HOA file.</p>
        </div>
        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Officer</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {history.map((member, index) => (
                <tr key={`${member.year}-${member.name}-${member.position}-${index}`}>
                  <td>{member.year}</td>
                  <td>{member.name}</td>
                  <td>{member.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
