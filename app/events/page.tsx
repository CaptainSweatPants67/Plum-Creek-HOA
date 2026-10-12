import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { HoaEvent } from "../../lib/hoa-events";
import { EventList } from "./EventList";

export const metadata: Metadata = { title: "Community Events | Plum Creek", description: "Upcoming Plum Creek HOA meetings and community event dates." };
function savedEvents(): HoaEvent[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  return readFileSync(path.join(process.cwd(), "Info", "Events.txt"), "utf8").split(/\r?\n/).slice(1)
    .filter(line => line.trim() && !line.trim().startsWith("#")).map(line => line.split("\t").map(value => value.trim()))
    .filter(([date, , title]) => date && title && date >= today)
    .map(([date, time, title, location, address, details]) => {
      const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
      const start = match ? `${String(Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0)).padStart(2,"0")}:${match[2]}:00` : null;
      return { id: `saved-${date}-${title}`, kind: "event", title, event_date: date, start_time: start, end_time: null, location: location || "", address: address || "", details: details || "", visibility: "public", cancelled: false } as HoaEvent;
    }).sort((a,b) => a.event_date.localeCompare(b.event_date));
}
export default function EventsPage() {
  return <main className="inner-page"><section className="inner-hero events-hero"><p className="section-kicker">Save the date</p><h1>Community events</h1><p>Upcoming HOA meetings, neighborhood gatherings, and important community dates.</p></section>
    <section className="events-section"><div className="section-heading events-heading"><div><p className="section-kicker">Coming up</p><h2>Upcoming dates</h2></div><p>Check back for newly scheduled Plum Creek events. Members-only dates are in the member library.</p></div><EventList fallback={savedEvents()}/></section>
  </main>;
}
