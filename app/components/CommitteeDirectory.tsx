"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { DirectoryCommittee } from "../../lib/committees";

export function CommitteeDirectory({ members = false, client: providedClient }: { members?: boolean; client?: SupabaseClient }) {
  const [committees, setCommittees] = useState<DirectoryCommittee[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const client = providedClient ?? getSupabaseBrowserClient();
    let active = true;
    const load = async () => {
      if (!client) { setError("Committee information is temporarily unavailable."); return; }
      const { data, error } = await client.rpc(members ? "get_member_committees" : "get_public_committees");
      if (!active) return;
      if (error || !Array.isArray(data)) { setCommittees(null); setError("Committee information could not be loaded. Please try again."); }
      else { setCommittees(data as DirectoryCommittee[]); setError(""); }
    };
    void load(); window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [providedClient, members, revision]);
  if (error) return <div className="committee-directory-status"><p role="status">{error}</p><button onClick={() => setRevision(v => v + 1)}>Retry committee directory</button></div>;
  if (!committees) return <p role="status">Loading committee directory…</p>;
  if (!committees.length) return <p>No committees are currently listed{members ? "." : " publicly. Sign in to the member portal for member information."}</p>;
  return <div className="committee-grid">{committees.map((committee, index) => <article className={`committee-card${committee.board_membership ? " committee-card-featured" : ""}`} key={committee.id}>
    <span className="committee-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
    <h2>{committee.name}</h2>{members && <span className="committee-visibility">{committee.show_public ? "Public committee" : "Members only"}</span>}
    {committee.description && <p>{committee.description}</p>}
    {committee.responsibilities.length > 0 && <div className="committee-responsibilities"><h3>What this committee does</h3><ul>{committee.responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
    <div className="committee-members"><h3>Current membership</h3>{committee.board_membership ? <p>Current Board of Directors · <Link href="/board/">View board</Link></p> : committee.members.length ? <ul>{committee.members.map(m => <li key={m.id}><strong>{m.name}</strong><span>{m.role}{members && !m.show_public ? " · Members only" : ""}</span></li>)}</ul> : <p className="committee-open">{members ? "No current appointments listed." : "No public member names listed."}</p>}</div>
    {committee.board_membership && <Link className="committee-action" href="/architectural-request/">Submit an approval request →</Link>}
  </article>)}</div>;
}
