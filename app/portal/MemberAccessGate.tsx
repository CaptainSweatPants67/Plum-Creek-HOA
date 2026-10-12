"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Access = { allowed: boolean; rental_requirements: { request_id: string; lot_number: number; street_address: string }[] };
export function MemberAccessGate({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => { void client.rpc("get_member_access").then(({ data, error }) => { if (active) { setFailed(Boolean(error)); setAccess(error ? null : data as Access); } }); };
    load(); window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [client]);
  if (failed) return <div className="portal-panel"><p role="status">Member access could not be checked. Refresh to try again.</p></div>;
  if (!access) return <p role="status">Checking member access…</p>;
  if (access.allowed) return children;
  return <div className="portal-panel"><h2>Current rental paperwork required</h2><p>Add a rental agreement PDF and both lease dates for each rental home before opening member information. Your contact and rental forms remain available.</p><ul>{access.rental_requirements.map(p => <li key={p.request_id}>Lot {p.lot_number} — {p.street_address}</li>)}</ul><Link href="/members/">Update rental agreements &amp; lease dates →</Link></div>;
}
