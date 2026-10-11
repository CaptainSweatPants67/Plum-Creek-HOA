"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { LeadershipRoster as Roster } from "../../lib/leadership-types";

export function LeadershipRoster({ savedRoster, mode }: { savedRoster: Roster; mode: "board" | "officers" }) {
  const [roster, setRoster] = useState(savedRoster);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    void client.rpc("get_public_leadership_roster").then(({ data, error }) => {
      if (!active) return;
      if (error || !data || !Array.isArray(data.board) || !Array.isArray(data.officers)) {
        setNotice("Showing the saved public roster. Live roster updates are temporarily unavailable.");
      } else {
        setRoster(data as Roster);
      }
    });
    return () => { active = false; };
  }, []);
  const records = mode === "board" ? roster.board : roster.officers;
  const calendarYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric" }).format(new Date()));
  const year = Math.max(...records.filter((row) => row.year <= calendarYear).map((row) => row.year), 2026);
  const current = records.filter((row) => row.year === year);
  const history = [...records].filter((row) => row.year <= calendarYear).sort((a, b) => b.year - a.year);

  return <>
    {notice && <p role="status" className="portal-notice">{notice}</p>}
    <section className="board-section">
      <div className="section-heading board-heading"><div><p className="section-kicker">Current {mode === "board" ? "directors" : "officers"}</p><h2>{year} roster on file</h2></div></div>
      <div className="board-grid">
        {current.map((member) => {
          const officer = roster.officers.find((row) => row.person_id && row.person_id === member.person_id && row.year === member.year);
          const vacant = member.person_id === null;
          return <article className={`board-card${vacant ? " board-card-vacant" : ""}`} key={member.id}>
            <span>{mode === "board" ? officer?.position ?? member.position : member.position}</span>
            <small>{vacant ? "Vacant position" : mode === "officers" ? "Officer" : officer ? "Director · Officer" : "Director"}</small>
            <h3>{member.name}</h3>
            <p className="board-term">{"term" in member ? member.term : `${member.year} officer appointment`}</p>
          </article>;
        })}
      </div>
    </section>
    <section className="history-section">
      <div className="section-heading history-heading"><div><p className="section-kicker">Association record</p><h2>{`${mode === "board" ? "Board" : "Officer"} history`}</h2></div>
        <p>Historical roster entries are shown as recorded. Public listings do not grant portal privileges.</p></div>
      <div className="history-table-wrap"><table><thead><tr><th>Year</th><th>Person</th><th>Position</th></tr></thead><tbody>
        {history.map((member) => <tr key={member.id}><td>{member.year}</td><td>{member.name}</td><td>{member.position}</td></tr>)}
      </tbody></table></div>
    </section>
  </>;
}
