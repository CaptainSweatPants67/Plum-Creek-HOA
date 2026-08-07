/* The local neighborhood image is intentionally served as a static asset. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

const destinations = [
  {
    number: "01",
    title: "Neighborhood Map & HOA Tracts",
    description:
      "Explore the neighborhood map and learn about the eight shared tracts owned and maintained by the HOA.",
    href: "/neighborhood-map/",
    linkLabel: "Explore the neighborhood",
  },
  {
    number: "02",
    title: "HOA Documents",
    description:
      "Download the recorded restrictions, association bylaws, ratifying declarations, and neighborhood plat maps.",
    href: "/documents/",
    linkLabel: "View HOA documents",
  },
  {
    number: "03",
    title: "Board of Directors",
    description:
      "Meet the current HOA officers and review Plum Creek's history of Board service.",
    href: "/board/",
    linkLabel: "Meet the Board",
  },
  {
    number: "04",
    title: "HOA Committees",
    description:
      "See each committee's purpose, responsibilities, current members, and ways homeowners can help.",
    href: "/committees/",
    linkLabel: "Explore committees",
  },
  {
    number: "05",
    title: "Community Events",
    description:
      "Find upcoming HOA meetings, neighborhood gatherings, locations, and important dates.",
    href: "/events/",
    linkLabel: "View upcoming events",
  },
  {
    number: "06",
    title: "Volunteer",
    description:
      "Share your interests and availability with the Board to help with a committee or neighborhood project.",
    href: "/committee-volunteer/",
    linkLabel: "Volunteer with Plum Creek",
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
            <a className="outline-button" href="mailto:pchoa66030@gmail.com">
              Contact the HOA
            </a>
          </div>
        </div>
      </section>

      <section className="intro home-intro" id="about">
        <div>
          <p className="section-kicker">Our neighborhood</p>
          <h1>Rooted in community.</h1>
        </div>
        <div className="intro-copy">
          <p>
            The Plum Creek Homeowners Association supports the shared interests
            of homeowners and keeps important neighborhood information easy to
            find.
          </p>
          <div className="feature-row">
            <Link href="/neighborhood-map/">
              <strong>8</strong>
              <span>HOA-owned tracts</span>
            </Link>
            <Link href="/documents/">
              <strong>6</strong>
              <span>Community documents</span>
            </Link>
            <Link href="/events/">
              <strong>Dates</strong>
              <span>Community events</span>
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
              className="destination-card"
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
          <p className="section-kicker">Contact the HOA</p>
          <h2>Questions for the Board?</h2>
          <p>
            Send questions about Plum Creek, association business, community
            records, committees, or neighborhood concerns directly to the HOA.
          </p>
          <a href="mailto:pchoa66030@gmail.com">
            Email pchoa66030@gmail.com <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </main>
  );
}
