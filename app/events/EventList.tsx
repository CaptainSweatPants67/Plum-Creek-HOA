"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { eventDate, eventTime, type HoaEvent } from "../../lib/hoa-events";

export function EventList({ fallback = [], client, member = false }: { fallback?: HoaEvent[]; client?: SupabaseClient; member?: boolean }) {
  const [events, setEvents] = useState(fallback);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(member);
  useEffect(() => {
    let active = true;
    const source = client ?? getSupabaseBrowserClient();
    if (!source) return;
    const load = () => { void source.rpc(member ? "get_member_events" : "get_public_events").then(({ data, error }) => {
      if (!active) return;
      setLoading(false); setFailed(Boolean(error));
      if (!error && Array.isArray(data)) setEvents(data as HoaEvent[]);
      else if (member) setEvents([]);
    }); };
    load(); window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [client, member]);
  if (loading) return <p role="status">Loading meetings and events…</p>;
  return <>
    {failed && <p role="status">The current calendar could not be loaded. Please refresh to check for updates.</p>}
    {events.length ? <div className="event-list">{events.map(event => <article className={member ? "portal-review-card" : "event-card"} key={event.id}>
      <time dateTime={event.event_date}>{eventDate(event.event_date)}</time><div><h3>{event.title}{event.cancelled ? " — Cancelled" : ""}</h3>
        <p className="event-meta">{[event.start_time ? `${eventTime(event.start_time)}${event.end_time ? ` – ${eventTime(event.end_time)}` : ""} (Central time)` : "Time to be announced",event.location,member && event.visibility === "members" ? "Members only" : ""].filter(Boolean).join(" · ")}</p>
        {event.address && <div className="event-address"><address>{event.address}</address><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a></div>}
        {event.address && !member && <iframe className="event-map" src={`https://www.google.com/maps?q=${encodeURIComponent(event.address)}&output=embed`} title={`Map showing ${event.address}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
        {event.details && <p className="library-body">{event.details}</p>}
      </div></article>)}</div> : <div className={member ? "" : "empty-state"}><h3>No upcoming dates are scheduled yet.</h3><p>New HOA meetings and neighborhood events will appear here when published.</p>{!member && <Link href="/contact/">Contact the HOA</Link>}</div>}
  </>;
}
