"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Person = { id: string; display_name: string };
type Service = { id: string; person_id: string | null; service_year: number; published: boolean; privileges_enabled: boolean; starts_on: string | null; ends_on: string | null; seat_label?: string; record_kind?: string; position_code?: string };

export function LeadershipManager({ client }: { client: SupabaseClient }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [board, setBoard] = useState<Service[]>([]);
  const [officers, setOfficers] = useState<Service[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ kind: "board" | "officer"; row: Service } | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      client.from("leadership_people").select("id,display_name").order("display_name"),
      client.from("board_member_years").select("*").order("service_year", { ascending: false }),
      client.from("officer_member_years").select("*").order("service_year", { ascending: false }),
    ]).then((results) => {
      if (!active) return;
      if (results.some((r) => r.error)) { setMessage("Leadership records could not be loaded."); return; }
      setPeople(results[0].data as Person[]); setBoard(results[1].data as Service[]); setOfficers(results[2].data as Service[]);
    });
    return () => { active = false; };
  }, [client, revision]);

  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true);
    const { error } = await client.from("leadership_people").insert({ display_name: String(new FormData(form).get("name")).trim() });
    setBusy(false); setMessage(error ? error.message : "Person added. No login privileges have been granted.");
    if (!error) { form.reset(); setRevision((v) => v + 1); }
  }
  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const kind = String(data.get("kind"));
    const person = String(data.get("person_id")) || null;
    const approved = data.get("privileges_enabled") === "on";
    const common = { person_id: person, service_year: Number(data.get("year")), starts_on: String(data.get("starts_on")) || null,
      ends_on: String(data.get("ends_on")) || null, published: data.get("published") === "on", privileges_enabled: approved };
    if (approved && (!person || !common.starts_on || !common.ends_on)) { setMessage("A named person and both service dates are required to enable privileges."); return; }
    const table = kind === "board" ? "board_member_years" : "officer_member_years";
    if (editing && (editing.kind === "board") !== (kind === "board")) { setMessage("Cancel editing and add a separate appointment to change between Director and Officer service."); return; }
    const values: Record<string, string | number | boolean | null> = kind === "board" ? { ...common, seat_label: String(data.get("seat_label")) || "Director", recorded_position: person ? "Director" : "Member", record_kind: person ? "director" : "vacant" }
      : { ...common, position_code: kind };
    setBusy(true);
    const result = editing ? await client.from(table).update(values).eq("id", editing.row.id).select("id").single() : await client.from(table).insert(values).select("id").single();
    setBusy(false); setMessage(result.error ? result.error.message : "Service record saved. Privileges require a separately linked confirmed account.");
    if (!result.error) { setEditing(null); form.reset(); setRevision((v) => v + 1); }
  }
  async function linkAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setBusy(true);
    const { error } = await client.rpc("link_leadership_account", { p_person_id: data.get("person_id"), p_email: data.get("email") });
    setBusy(false); setMessage(error ? error.message : "Confirmed account linked. Approved service dates control Director and Officer privileges.");
  }
  function edit(kind: "board" | "officer", row: Service) { setEditing({ kind, row }); setMessage(""); }

  return <div className="portal-panel"><h2>Leadership people and service years</h2>
    <p>Roster publication and login privileges are separate. Historical entries keep their recorded titles and grant no privileges.</p>
    {message && <p className="portal-notice" role="status">{message}</p>}
    <form className="portal-form" onSubmit={addPerson}><h3>Add a person</h3><label>Public display name<input name="name" maxLength={160} required /></label><button disabled={busy}>Add person</button></form>
    <form className="portal-form" key={editing?.row.id ?? "new"} onSubmit={saveService}><h3>{editing ? "Edit service record" : "Add a Director or Officer appointment"}</h3>
      <label>Person<select name="person_id" defaultValue={editing?.row.person_id ?? ""}><option value="">Vacant position</option>{people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
      <label>Service<select name="kind" defaultValue={editing?.kind === "board" ? "board" : editing?.row.position_code ?? "board"}><option value="board">Director</option><option value="president">President</option><option value="vice_president">Vice President</option><option value="secretary">Secretary</option><option value="treasurer">Treasurer</option></select></label>
      <label>Year<input name="year" type="number" min={2000} max={2200} defaultValue={editing?.row.service_year ?? new Date().getFullYear()} required /></label>
      <label>Director seat / term label<input name="seat_label" defaultValue={editing?.row.seat_label ?? "Director"} /></label>
      <label>Service begins<input name="starts_on" type="date" defaultValue={editing?.row.starts_on ?? ""} /></label><label>Service ends<input name="ends_on" type="date" defaultValue={editing?.row.ends_on ?? ""} /></label>
      <label className="portal-checkbox"><input type="checkbox" name="published" defaultChecked={editing?.row.published ?? true} />Publish on the public website</label>
      <label className="portal-checkbox"><input type="checkbox" name="privileges_enabled" defaultChecked={editing?.row.privileges_enabled ?? false} />Approve login privileges for these service dates</label>
      <p>Approved service dates must fall within the selected year. A public historical listing is not an approval.</p>
      <div className="portal-actions"><button disabled={busy}>Save service record</button>{editing && <button type="button" onClick={() => setEditing(null)}>Cancel edit</button>}</div>
    </form>
    <form className="portal-form" onSubmit={linkAccount}><h3>Link a confirmed login</h3><label>Person<select name="person_id" required><option value="">Select a person</option>{people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
      <label>Confirmed current email<input name="email" type="email" required /></label><button disabled={busy}>Link registered account</button></form>
    <div className="history-table-wrap"><table><thead><tr><th>Year</th><th>Person</th><th>Service</th><th>Published</th><th>Privileges approved</th><th>Edit</th></tr></thead><tbody>
      {[...board.map((row) => ({ row, kind: "board" as const })), ...officers.map((row) => ({ row, kind: "officer" as const }))].sort((a,b) => b.row.service_year-a.row.service_year).map(({ row, kind }) => <tr key={row.id}>
        <td>{row.service_year}</td><td>{people.find((p) => p.id === row.person_id)?.display_name ?? "Vacant"}</td><td>{kind === "board" ? row.record_kind : row.position_code}</td><td>{row.published ? "Yes" : "No"}</td><td>{row.privileges_enabled ? `${row.starts_on} – ${row.ends_on}` : "No"}</td><td>{kind === "board" && row.record_kind === "historical" ? "Historical reference" : <button onClick={() => edit(kind, row)}>Edit</button>}</td>
      </tr>)}
    </tbody></table></div>
  </div>;
}
