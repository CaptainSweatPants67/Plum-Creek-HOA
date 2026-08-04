import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";

type CommunityEvent = {
  date: string;
  time: string;
  title: string;
  location: string;
  address: string;
  details: string;
};

export const metadata: Metadata = {
  title: "Community Events | Plum Creek",
  description: "Upcoming Plum Creek HOA meetings and community event dates.",
};

function getUpcomingEvents(): CommunityEvent[] {
  const source = readFileSync(
    path.join(process.cwd(), "Info", "Events.txt"),
    "utf8",
  );
  const today = new Date().toISOString().slice(0, 10);

  return source
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => line.split("\t").map((value) => value.trim()))
    .filter(([date, , title]) => date && title && date >= today)
    .map(([date, time, title, location, address, details]) => ({
      date,
      time,
      title,
      location,
      address,
      details,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function EventsPage() {
  const events = getUpcomingEvents();

  return (
    <main className="inner-page">
      <section className="inner-hero events-hero">
        <p className="section-kicker">Save the date</p>
        <h1>Community events</h1>
        <p>
          Future HOA meetings, neighborhood gatherings, and important community
          dates will be posted here.
        </p>
      </section>

      <section className="events-section">
        <div className="section-heading events-heading">
          <div>
            <p className="section-kicker">Coming up</p>
            <h2>Upcoming dates</h2>
          </div>
          <p>Check back for newly scheduled Plum Creek events.</p>
        </div>

        {events.length > 0 ? (
          <div className="event-list">
            {events.map((event) => (
              <article className="event-card" key={`${event.date}-${event.title}`}>
                <time dateTime={event.date}>{formatDate(event.date)}</time>
                <div>
                  <h3>{event.title}</h3>
                  {(event.time || event.location) && (
                    <p className="event-meta">
                      {[event.time, event.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {event.address && (
                    <div className="event-address">
                      <div className="event-address-heading">
                        <div>
                          <span>Event address</span>
                          <address>{event.address}</address>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Google Maps <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                      <iframe
                        className="event-map"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(event.address)}&output=embed`}
                        title={`Map showing ${event.address}`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  )}
                  {event.details && <p>{event.details}</p>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">PC</span>
            <h3>No upcoming dates are scheduled yet.</h3>
            <p>
              New HOA and neighborhood event dates will appear here as soon as
              they are confirmed.
            </p>
            <a href="mailto:pchoa66030@gmail.com">Contact the HOA</a>
          </div>
        )}
      </section>
    </main>
  );
}
