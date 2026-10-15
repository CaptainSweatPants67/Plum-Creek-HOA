"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceSection } from "./WorkspaceSection";

type Person = { id: string; display_name: string };
type Service = { id: string; person_id: string | null; service_year: number; published: boolean; privileges_enabled: boolean; starts_on: string | null; ends_on: string | null; seat_label?: string; record_kind?: string; position_code?: string };
const serviceNames: Record<string, string> = { president: "President", vice_president: "Vice President", secretary: "Secretary", treasurer: "Treasurer" };

export function LeadershipManager({ client }: { client: SupabaseClient }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [board, setBoard] = useState<Service[]>([]);
  const [officers, setOfficers] = useState<Service[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<{ kind: "board" | "officer"; row: Service } | null>(null);
  const [revision, setRevision] = useState(0);
  const calendarYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric" }).format(new Date()));
  const [year, setYear] = useState(calendarYear);
  const [search, setSearch] = useState("");
  const [personId, setPersonId] = useState("");
  const [draftPersonId, setDraftPersonId] = useState("");
  const editorAnchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([
      client.from("leadership_people").select("id,display_name").order("display_name"),
      client.from("board_member_years").select("*").order("service_year", { ascending: false }),
      client.from("officer_member_years").select("*").order("service_year", { ascending: false }),
    ]).then(results => {
      if (!active) return;
      if (results.some(result => result.error)) { setMessage("Leadership records could not be loaded. Please refresh and try again."); return; }
      setPeople(results[0].data as Person[]); setBoard(results[1].data as Service[]); setOfficers(results[2].data as Service[]); setLoaded(true);
    });
    return () => { active = false; };
  }, [client, revision]);
  function openEditor() {
    const section = editorAnchor.current?.closest("details");
    if (section) { section.open = true; section.scrollIntoView({ block: "nearest" }); }
  }
  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setMessage("");
    const values = { display_name: String(data.get("name") ?? "").trim() };
    const result = personId ? await client.from("leadership_people").update(values).eq("id", personId).select("id").single() : await client.from("leadership_people").insert(values).select("id").single();
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    setRevision(value => value + 1);
    if (personId) setMessage("Name updated. Published appointments now use this name on the public roster.");
    else { setDraftPersonId(result.data.id); setEditing(null); setMessage("Person added. Choose an appointment below to publish them on the roster."); openEditor(); }
  }
  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const kind = String(data.get("kind")); const person = String(data.get("person_id")) || null;
    const approved = data.has("privileges_enabled");
    const common = { person_id: person, service_year: Number(data.get("year")), starts_on: String(data.get("starts_on")) || null,
      ends_on: String(data.get("ends_on")) || null, published: data.has("published"), privileges_enabled: approved };
    if (approved && (!person || !common.starts_on || !common.ends_on)) { setMessage("A named person and both service dates are required to enable privileges."); return; }
    const table = kind === "board" ? "board_member_years" : "officer_member_years";
    if (editing && (editing.kind === "board") !== (kind === "board")) { setMessage("Add a separate appointment to change between Director and Officer service."); return; }
    const values: Record<string, string | number | boolean | null> = kind === "board" ? { ...common, seat_label: String(data.get("seat_label")) || "Director", recorded_position: person ? "Director" : "Member", record_kind: person ? "director" : "vacant" } : { ...common, position_code: kind };
    setBusy(true); setMessage("");
    const result = editing ? await client.from(table).update(values).eq("id", editing.row.id).select("id").single() : await client.from(table).insert(values).select("id").single();
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    setYear(common.service_year); setEditing(null); setDraftPersonId(""); setRevision(value => value + 1);
    setMessage(common.published ? common.service_year > calendarYear ? "Appointment saved for a future year. It becomes eligible for the public roster in that year." : "Published appointment saved. The public Board and Officers pages load the latest published roster directly." : "Appointment saved privately. It is hidden from the public roster.");
  }
  async function linkAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true);
    const { error } = await client.rpc("link_leadership_account", { p_person_id: data.get("person_id"), p_email: data.get("email") });
    setBusy(false); setMessage(error ? error.message : "Confirmed account linked. Service dates supply default workspace access; Member accounts & workspace access can override it.");
  }
  function edit(kind: "board" | "officer", row: Service) { setDraftPersonId(""); setEditing({ kind, row }); setMessage(""); openEditor(); }
  const rows = [...board.map(row => ({ row, kind: "board" as const })), ...officers.map(row => ({ row, kind: "officer" as const }))];
  const years = [...new Set([calendarYear, ...rows.map(({ row }) => row.service_year)])].sort((a, b) => b - a);
  const name = (id: string | null) => people.find(person => person.id === id)?.display_name ?? "Vacant";
  const publicYear = (kind: "board" | "officer") => Math.max(0, ...rows.filter(item => item.kind === kind && item.row.published && item.row.record_kind !== "historical" && item.row.service_year <= calendarYear).map(item => item.row.service_year));
  const visible = rows.filter(({ row }) => row.service_year === year && `${name(row.person_id)} ${row.position_code ?? row.seat_label}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    {message && <p className="portal-notice" role="status">{message}</p>}
    <WorkspaceSection title="Board & Officer membership" description="Maintain appointments and publish the current public roster" defaultOpen>
      <div className="portal-heading"><p>Edit an existing seat to replace its member. Published appointments for the latest service year appear on the public pages.</p><div className="portal-actions"><Link href="/board/" target="_blank">View public Board ↗</Link><Link href="/officers/" target="_blank">View public Officers ↗</Link></div></div>
      <div className="library-filters"><label>Roster year<select value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(value => <option key={value}>{value}</option>)}</select></label><label>Find person or position<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      <div className="portal-heading"><p>{loaded ? `${visible.length} appointments in ${year}` : "Loading leadership records…"}</p><button disabled={busy} onClick={() => { setEditing(null); setDraftPersonId(""); openEditor(); }}>Add appointment</button></div>
      <div className="history-table-wrap"><table><thead><tr><th>Person</th><th>Service</th><th>Publication</th><th>Appointment access dates</th><th>Action</th></tr></thead><tbody>{visible.map(({ row, kind }) => <tr key={row.id}><td>{name(row.person_id)}</td><td>{kind === "board" ? row.seat_label : serviceNames[row.position_code ?? ""]}</td><td>{row.published ? row.record_kind === "historical" ? "Member history" : year > calendarYear ? "Future year" : year === publicYear(kind) ? "Public roster" : "Member history" : "Private draft"}</td><td>{row.privileges_enabled ? `${row.starts_on} — ${row.ends_on}` : "Not enabled"}</td><td>{row.record_kind === "historical" ? "Reference record" : <button disabled={busy} onClick={() => edit(kind, row)}>Edit appointment</button>}</td></tr>)}</tbody></table></div>
      {loaded && visible.length === 0 && <p>No appointments match this year and search.</p>}
    </WorkspaceSection>
    <WorkspaceSection title="Appointment editor" description={editing ? `Editing ${name(editing.row.person_id)}` : "Add or update a Director or Officer appointment"}>
      <div ref={editorAnchor}><form className="portal-form portal-form-grid" key={editing?.row.id ?? `new-${draftPersonId}-${revision}`} onSubmit={saveService}>
        <label>Person<select name="person_id" defaultValue={editing ? editing.row.person_id ?? "" : draftPersonId}><option value="">Vacant position</option>{people.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
        <label>Service<select name="kind" defaultValue={editing?.kind === "board" ? "board" : editing?.row.position_code ?? "board"}><option value="board">Director</option>{Object.entries(serviceNames).map(([code, title]) => <option key={code} value={code}>{title}</option>)}</select></label>
        <label>Year<input name="year" type="number" min={2000} max={2200} defaultValue={editing?.row.service_year ?? year} required /></label>
        <label>Director seat / term label<input name="seat_label" defaultValue={editing?.row.seat_label ?? "Director"} maxLength={100} /></label>
        <label>Service begins<input name="starts_on" type="date" defaultValue={editing?.row.starts_on ?? ""} /></label><label>Service ends<input name="ends_on" type="date" defaultValue={editing?.row.ends_on ?? ""} /></label>
        <label className="portal-checkbox form-wide"><input type="checkbox" name="published" defaultChecked={editing?.row.published ?? true} />Publish appointment (latest service year on public roster; past service in member history)</label>
        <label className="portal-checkbox form-wide"><input type="checkbox" name="privileges_enabled" defaultChecked={editing?.row.privileges_enabled ?? false} />Enable appointment-based workspace access for these service dates</label>
        <p className="form-wide">Requires a linked, confirmed account and service dates within the selected year. Explicit grants or revocations under Member accounts &amp; workspace access override this default.</p>
        <div className="portal-actions form-wide"><button disabled={busy}>Save appointment</button><button type="button" disabled={busy} onClick={() => { setEditing(null); setDraftPersonId(""); }}>Clear editor</button></div>
      </form></div>
    </WorkspaceSection>
    <WorkspaceSection title="People & display names" description="Add a new person or correct an existing roster name"><form className="portal-form" onSubmit={savePerson}>
      <label>Person to update<select value={personId} onChange={event => setPersonId(event.target.value)}><option value="">Add a new person</option>{people.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
      <label>Public display name<input name="name" key={`${personId}-${revision}`} defaultValue={personId ? name(personId) : ""} maxLength={160} required /></label><button disabled={busy}>{personId ? "Save display name" : "Add person"}</button>
    </form></WorkspaceSection>
    <WorkspaceSection title="Link leadership login" description="Connect a confirmed account to an approved appointment"><form className="portal-form" onSubmit={linkAccount}>
      <label>Person<select name="person_id" required><option value="">Select a person</option>{people.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><label>Confirmed current email<input name="email" type="email" required /></label><button disabled={busy}>Link registered account</button>
    </form></WorkspaceSection>
  </>;
}

