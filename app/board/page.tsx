import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";

type BoardMember = {
  year: number;
  name: string;
  position: string;
};

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
  const latestYear = Math.max(...members.map((member) => member.year));
  const currentBoard = members.filter((member) => member.year === latestYear);
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
            <h2>{latestYear} roster</h2>
          </div>
          <p>For board questions, email pchoa66030@gmail.com.</p>
        </div>
        <div className="board-grid">
          {currentBoard.map((member) => (
            <article className="board-card" key={`${member.name}-${member.position}`}>
              <span>{member.position}</span>
              <h3>{member.name}</h3>
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
