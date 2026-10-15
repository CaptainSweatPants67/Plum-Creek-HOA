"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceSection } from "./WorkspaceSection";

type Appointment = { id: string; display_name: string; role: string; show_public: boolean; active: boolean; starts_on: string | null; ends_on: string | null; notes: string; updated_at: string };
type Committee = { id: string; name: string; description: string; responsibilities: string[]; show_public: boolean; active: boolean; board_membership: boolean; sort_order: number; updated_at: string; members: Appointment[] };
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

export function CommitteeManager({ client }: { client: SupabaseClient }) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const committee = committees.find(c => c.id === selected);
  const appointment = committee?.members.find(m => m.id === editing);
  useEffect(() => {
    let active = true;
    void client.rpc("get_committee_workspace").then(({ data, error }) => {
      if (!active) return;
      if (error || !Array.isArray(data)) { setLoaded(false); setMessage(error?.message ?? "Committees could not be loaded."); }
      else { setCommittees(data as Committee[]); setLoaded(true); }
    });
    return () => { active = false; };
  }, [client, revision]);
  async function save(event: FormEvent<HTMLFormElement>, member: boolean) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const details = member ? { name: field(form, "name"), role: field(form, "role"), show_public: form.has("show_public"), active: form.has("active"), starts_on: field(form, "starts_on"), ends_on: field(form, "ends_on"), notes: field(form, "notes") }
        : { name: field(form, "name"), description: field(form, "description"), responsibilities: field(form, "responsibilities").split(/\r?\n/).map(r => r.trim()).filter(Boolean), show_public: form.has("show_public"), active: form.has("active"), sort_order: Number(field(form, "sort_order")) };
      if (details.responsibilities && (details.responsibilities.length > 12 || details.responsibilities.some(r => r.length > 300))) throw new Error("Use up to 12 responsibilities, with at most 300 characters per line.");
      const { data, error } = await client.rpc(member ? "save_hoa_committee_member" : "save_hoa_committee", member ? { p_id: appointment?.id ?? null, p_committee: selected, p_details: details, p_expected: appointment?.updated_at ?? null } : { p_id: committee?.id ?? null, p_details: details, p_expected: committee?.updated_at ?? null });
      if (error) throw error;
      if (!member) setSelected(data as string);
      setEditing(null); setRevision(v => v + 1);
      setMessage(member ? "Committee member saved. Visibility and appointment dates control where the name appears." : "Committee saved. The public and member directories will use these settings.");
    } catch (error) { setMessage(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Save failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="portal-panel"><div className="portal-heading"><div><h2>Committee management</h2><p>Manage committee listings and appointed members. Appointments do not create accounts or grant administrative access.</p></div><button disabled={busy} onClick={() => { setEditing(null); setRevision(v => v + 1); }}>Refresh committees</button></div>
      {message && <p className="portal-notice" role="status">{message}</p>}
      {loaded ? <label className="committee-selector">Choose a committee<select value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setEditing(null); }}><option value="">+ Add a new committee</option>{committees.map(c => <option key={c.id} value={c.id}>{c.name}{!c.active ? " (inactive)" : !c.show_public ? " (members only)" : ""}</option>)}</select></label> : <p role="status">Committee editor unavailable until records load.</p>}
    </div>
    {loaded && <WorkspaceSection title={committee ? "Committee details & visibility" : "Add a committee"} defaultOpen>
      <form key={`${selected}-${committee?.updated_at ?? revision}`} className="portal-form" onSubmit={e => save(e, false)}><fieldset disabled={busy} className="committee-fields">
        <label>Committee name<input name="name" required maxLength={120} defaultValue={committee?.name ?? ""} /></label>
        <label>Description<textarea name="description" maxLength={2000} rows={3} defaultValue={committee?.description ?? ""} /></label>
        <label>Responsibilities — one per line (up to 12)<textarea name="responsibilities" rows={4} defaultValue={committee?.responsibilities.join("\n") ?? ""} /></label>
        <label>Display order<input name="sort_order" type="number" min={0} max={1000} required defaultValue={committee?.sort_order ?? 50} /></label>
        <label className="portal-check"><input name="active" type="checkbox" defaultChecked={committee?.active ?? true} />Active committee — uncheck to archive</label>
        <label className="portal-check"><input name="show_public" type="checkbox" defaultChecked={committee?.show_public ?? false} />Show this committee on the public website</label>
        <p>Active committees appear in the member directory. A public committee only shows names that are also checked for public display.</p>
        <button type="submit">{committee ? "Save committee" : "Create committee"}</button>
      </fieldset></form>
    </WorkspaceSection>}
    {loaded && committee && <WorkspaceSection title="Committee members" description="Add, update or archive appointments and choose where each name appears." defaultOpen>
      {!committee.active && <p className="portal-notice">This committee is archived. Its members are hidden from both directories.</p>}
      {committee.board_membership ? <p>The current Board of Directors serves this committee. <Link href="/admin/">Manage Board appointments in HOA administration.</Link></p> : <>
        <button disabled={busy} onClick={() => setEditing("")}>Add committee member</button>
        {editing !== null && <form key={appointment?.updated_at ?? `new-${selected}`} className="portal-form committee-member-editor" onSubmit={e => save(e, true)}><h3>{appointment ? "Edit committee member" : "New committee member"}</h3><fieldset disabled={busy} className="committee-fields">
          <label>Member name<input name="name" maxLength={160} required defaultValue={appointment?.display_name ?? ""} /></label>
          <label>Committee role<input name="role" maxLength={80} required defaultValue={appointment?.role ?? "Member"} /></label>
          <div className="portal-grid"><label>Appointment start (optional)<input name="starts_on" type="date" defaultValue={appointment?.starts_on ?? ""} /></label><label>Appointment end (optional)<input name="ends_on" type="date" defaultValue={appointment?.ends_on ?? ""} /></label></div>
          <label>Internal appointment notes<textarea name="notes" maxLength={1000} rows={2} defaultValue={appointment?.notes ?? ""} /></label>
          <label className="portal-check"><input name="active" type="checkbox" defaultChecked={appointment?.active ?? true} />Active appointment — uncheck to archive</label>
          <label className="portal-check"><input name="show_public" type="checkbox" defaultChecked={appointment?.show_public ?? false} />Show this member’s name on the public website</label>
          <p>Unchecked names are visible only to approved members. Names are listed during their active appointment dates. Internal notes stay in administration.</p>
          <div className="portal-actions"><button type="submit">Save committee member</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div>
        </fieldset></form>}
        <div className="committee-admin-roster">{committee.members.length ? committee.members.map(m => <article key={m.id}><div><h3>{m.display_name}</h3><p>{m.role} · {!m.active ? "Archived" : m.starts_on && m.starts_on > new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) ? "Upcoming appointment" : m.ends_on && m.ends_on < new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) ? "Expired appointment" : "Active"} · {m.show_public && committee.show_public ? "Public name" : "Members only"}</p>{(m.starts_on || m.ends_on) && <small>{m.starts_on ?? "No start date"} through {m.ends_on ?? "No end date"}</small>}</div><button disabled={busy} onClick={() => setEditing(m.id)}>Edit {m.display_name}</button></article>) : <p>No appointments yet. Add a member to get started.</p>}</div>
      </>}
    </WorkspaceSection>}
  </>;
}
