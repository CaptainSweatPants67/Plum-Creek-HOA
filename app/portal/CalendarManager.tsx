"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eventDate, eventTime, type HoaEvent } from "../../lib/hoa-events";
import { loadLibraryRows } from "../../lib/hoa-library";
import { rentalError } from "../../lib/rental-agreements";
import { WorkspaceSection } from "./WorkspaceSection";

export function CalendarManager({ client, defaultOpen = true }: { client: SupabaseClient; defaultOpen?: boolean }) {
  const [events, setEvents] = useState<HoaEvent[] | null>(null);
  const [editing, setEditing] = useState<HoaEvent | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState("upcoming");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  useEffect(() => { let active = true; void loadLibraryRows<HoaEvent>(client, "hoa_events", "event_date", false).then(({ data, error }) => { if (!active) return; if (error) setMessage(rentalError(error)); else setEvents(data); }); return () => { active = false; }; }, [client, revision]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setMessage("");
    const fields = { kind: String(values.get("kind")), title: String(values.get("title")).trim(), event_date: String(values.get("event_date")), start_time: values.get("start_time") || null, end_time: values.get("end_time") || null, location: String(values.get("location") ?? "").trim(), address: String(values.get("address") ?? "").trim(), details: String(values.get("details") ?? "").trim(), visibility: String(values.get("visibility")), published: values.has("published"), cancelled: values.has("cancelled") };
    try {
      if (fields.end_time && (!fields.start_time || String(fields.end_time) < String(fields.start_time))) throw new Error("The end time must be on or after the start time on the same day.");
      const result = editing && editing !== "new" ? await client.from("hoa_events").update(fields).eq("id", editing.id).select("id").single() : await client.from("hoa_events").insert(fields).select("id").single();
      if (result.error) throw result.error; setEditing(null); setRevision(v => v + 1);
      setMessage(fields.published ? fields.visibility === "public" ? "Published to the public events page and member calendar." : "Published to the member calendar only." : "Event draft saved. It is visible only to leadership.");
    } catch (error) { setMessage(rentalError(error)); } finally { setBusy(false); }
  }
  const current = editing && editing !== "new" ? editing : null;
  const visible = events?.filter(e => filter === "all" || (filter === "drafts" ? !e.published : filter === "past" ? e.event_date < today : e.event_date >= today)) ?? [];
  return <WorkspaceSection title="Meetings & events" description="Schedule, publish, cancel, or update calendar entries" defaultOpen={defaultOpen}>
    <div className="portal-heading"><p>Dates and times use Central time. Choose who can see each event.</p><button disabled={busy || Boolean(editing)} onClick={() => setEditing("new")}>New meeting or event</button></div>
    <p>Publishing updates the calendar immediately. It does not send email notices.</p>
    {message && <p className="portal-notice" role="status">{message}</p>}
    {editing && <form className="portal-form calendar-editor" key={current?.id || "new"} onSubmit={save}><h3>{current ? "Edit calendar entry" : "Create calendar entry"}</h3>
      <label>Calendar entry type<select name="kind" defaultValue={current?.kind || "meeting"}><option value="meeting">HOA meeting</option><option value="event">Community event</option></select></label>
      <label>Event title<input name="title" maxLength={180} defaultValue={current?.title} required /></label>
      <div className="portal-form-row"><label>Event date<input name="event_date" type="date" defaultValue={current?.event_date} required /></label><label>Start time (Central)<input name="start_time" type="time" defaultValue={current?.start_time?.slice(0, 5)} /></label><label>End time (optional)<input name="end_time" type="time" defaultValue={current?.end_time?.slice(0, 5)} /></label></div>
      <label>Location<input name="location" maxLength={160} defaultValue={current?.location} /></label><label>Event street address<input name="address" maxLength={500} defaultValue={current?.address} /></label>
      <label>Event details<textarea name="details" maxLength={5000} defaultValue={current?.details} /></label>
      <label>Event visibility<select name="visibility" defaultValue={current?.visibility || "public"}><option value="public">Public website and member calendar</option><option value="members">Members only</option></select></label>
      <label className="portal-checkbox"><input type="checkbox" name="published" defaultChecked={current?.published ?? true} />Publish this event</label><label className="portal-checkbox"><input type="checkbox" name="cancelled" defaultChecked={current?.cancelled ?? false} />Mark as cancelled (keeps a cancellation notice visible)</label>
      <div className="portal-actions"><button disabled={busy}>Save calendar entry</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel editing</button></div>
    </form>}
    <label className="portal-search">Show calendar entries<select value={filter} onChange={e => setFilter(e.target.value)}><option value="upcoming">Upcoming dates</option><option value="drafts">Drafts</option><option value="past">Past dates</option><option value="all">All entries</option></select></label>
    {!events ? <p>Loading calendar…</p> : !visible.length ? <p>No entries in this view.</p> : visible.map(event => <article className="portal-review-card" key={event.id}><div className="portal-heading"><h3>{event.title}</h3><button disabled={busy || Boolean(editing)} onClick={() => setEditing(event)}>Edit calendar entry</button></div><p>{eventDate(event.event_date)} · {eventTime(event.start_time) || "Time to be announced"} · {event.published ? event.visibility === "public" ? "Public" : "Members only" : "Draft"}{event.cancelled ? " · Cancelled" : ""}</p><p>{event.location}{event.address && ` · ${event.address}`}</p>{event.details && <p className="library-body">{event.details}</p>}</article>)}
  </WorkspaceSection>;
}
