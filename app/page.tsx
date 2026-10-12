/* The local neighborhood image is intentionally served as a static asset. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

const destinations = [
  {
    number: "01",
    title: "Pay Your Dues",
    description:
      "Review the 2026 dues amount, check mailing address, Venmo total, and payment deadline.",
    href: "/dues/",
    linkLabel: "View payment instructions",
    featured: true,
  },
  {
    number: "02",
    title: "Neighborhood Map & HOA Tracts",
    description:
      "Explore the neighborhood map and learn about the eight shared tracts owned and maintained by the HOA.",
    href: "/neighborhood-map/",
    linkLabel: "Explore the neighborhood",
  },
  {
    number: "03",
    title: "HOA Documents",
    description:
      "Download the recorded restrictions, ratifying declarations, and neighborhood plat maps.",
    href: "/documents/",
    linkLabel: "View HOA documents",
  },
  {
    number: "04",
    title: "Board of Directors",
    description:
      "Meet the current Plum Creek Board of Directors and HOA officers.",
    href: "/board/",
    linkLabel: "Meet the Board",
  },
  {
    number: "05",
    title: "HOA Committees",
    description:
      "See each committee's purpose, responsibilities, current members, and ways homeowners can help.",
    href: "/committees/",
    linkLabel: "Explore committees",
  },
  {
    number: "06",
    title: "Community Events",
    description:
      "Find upcoming HOA meetings, neighborhood gatherings, locations, and important dates.",
    href: "/events/",
    linkLabel: "View upcoming events",
  },
  {
    number: "07",
    title: "Volunteer",
    description:
      "Share your interests and availability with the Board to help with a committee or neighborhood project.",
    href: "/committee-volunteer/",
    linkLabel: "Volunteer with Plum Creek",
  },
  {
    number: "08",
    title: "Homes Within the HOA",
    description:
      "Search the 119 Gardner property addresses currently located within Plum Creek HOA boundaries.",
    href: "/homes/",
    linkLabel: "Search HOA property addresses",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero hero-social" id="top">
        <img
          className="hero-image"
          src="/og.png"
          alt="Plum Creek Homeowners Association entrance"
        />
        <div className="hero-quickbar home-hero-quickbar">
          <p>
            Official neighborhood information, member resources, and ways to
            connect with the Plum Creek HOA.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/architectural-request/">
              Request architectural approval
            </Link>
            <Link className="outline-button" href="/contact/">
              Contact the HOA
            </Link>
          </div>
        </div>
      </section>

      <section className="home-destinations">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Find what you need</p>
            <h2>Explore Plum Creek</h2>
          </div>
          <p>
            Visit a section below for neighborhood information, HOA resources,
            and opportunities to participate.
          </p>
        </div>

        <div className="destination-grid">
          {destinations.map((destination) => (
            <Link
              className={`destination-card${destination.featured ? " destination-card-featured" : ""}`}
              href={destination.href}
              key={destination.href}
            >
              <span className="destination-number">{destination.number}</span>
              <h3>{destination.title}</h3>
              <p>{destination.description}</p>
              <strong>
                {destination.linkLabel} <span aria-hidden="true">→</span>
              </strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-priority-actions">
        <div className="priority-action priority-action-architectural">
          <p className="section-kicker">Planning an exterior project?</p>
          <h2>Request Architectural Control Committee approval.</h2>
          <p>
            Prepare a complete request with your project type, plans,
            materials, colors, dimensions, and property location before covered
            work begins.
          </p>
          <Link href="/architectural-request/">
            Start an approval request <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="priority-action priority-action-contact">
          <p className="section-kicker">Neighborhood issue or concern?</p>
          <h2>Report it to the HOA.</h2>
          <p>
            Prepare a report for a general concern, possible covenants
            violation, or another issue that the Board should review.
          </p>
          <Link href="/report-concern/">
            Report an issue or concern <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
