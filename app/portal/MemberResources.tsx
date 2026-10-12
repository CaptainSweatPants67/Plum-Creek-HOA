"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadershipRoster } from "../../lib/leadership-types";
import { WorkspaceSection } from "./WorkspaceSection";

export function MemberResources({ client }: { client: SupabaseClient }) {
  const [history, setHistory] = useState<LeadershipRoster | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState("all");
  const [kind, setKind] = useState("board");
  const [search, setSearch] = useState("");
  const [loadHistory, setLoadHistory] = useState(false);
  useEffect(() => {
    if (!loadHistory) return;
    let active = true;
    void client.rpc("get_member_leadership_history").then(({ data, error }) => {
      if (!active) return;
      if (error || !data || !Array.isArray(data.board) || !Array.isArray(data.officers)) setMessage("Leadership history could not be loaded. Please refresh and try again.");
      else setHistory(data as LeadershipRoster);
    });
    return () => { active = false; };
  }, [client, loadHistory]);
  async function downloadBylaws() {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await client.storage.from("hoa-member-governance").download("plum-creek-bylaws.pdf");
      if (error || !data) throw new Error();
      const url = URL.createObjectURL(data);
      const link = document.createElement("a"); link.href = url; link.download = "plum-creek-bylaws.pdf";
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMessage("The bylaws could not be downloaded. Please check that you are signed in and try again."); }
    finally { setBusy(false); }
  }
  const records = history ? kind === "board" ? history.board : history.officers : [];
  const years = [...new Set(records.map(row => row.year))].sort((a, b) => b - a);
  const visible = records.filter(row => (year === "all" || row.year === Number(year)) && `${row.name} ${row.position}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    {message && <p role="status" className="portal-notice">{message}</p>}
    <WorkspaceSection title="Association bylaws" description="Member-only governing document" defaultOpen><div className="portal-heading"><p>Rules for how Plum Creek HOA is organized and governed. PDF · approximately 3.6 MB.</p><button disabled={busy} onClick={downloadBylaws}>{busy ? "Downloading…" : "Download bylaws PDF"}</button></div></WorkspaceSection>
    <WorkspaceSection title="Board & Officer history" description="Search past service by year and name"><button onClick={() => setLoadHistory(true)} disabled={loadHistory}>Load leadership history</button>
      {loadHistory && !history && !message && <p role="status">Loading leadership history…</p>}
      {history && <><p>Historical entries retain their recorded titles. These reference records do not grant login privileges.</p><div className="library-filters"><label>Service<select value={kind} onChange={event => { setKind(event.target.value); setYear("all"); }}><option value="board">Board</option><option value="officers">Officers</option></select></label><label>Year<select value={year} onChange={event => setYear(event.target.value)}><option value="all">All years</option>{years.map(value => <option key={value}>{value}</option>)}</select></label><label>Search name or position<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
        <p>{visible.length} records</p><div className="history-table-wrap"><table><thead><tr><th>Year</th><th>Person</th><th>Position</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td>{row.year}</td><td>{row.name}</td><td>{row.position}</td></tr>)}</tbody></table></div></>}
    </WorkspaceSection>
  </>;
}
