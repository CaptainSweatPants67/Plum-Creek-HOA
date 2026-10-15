/* The local neighborhood image is intentionally served as a static asset. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

const destinations = [
  {
    title: "Pay Your Dues",
    description:
      "Payment amounts, mailing instructions, Venmo details, and deadlines.",
    href: "/dues/",
    linkLabel: "View payment instructions",
    featured: true,
  },
  {
    title: "Neighborhood Map & HOA Tracts",
    description:
      "Explore the neighborhood map, shared ponds, and eight HOA tracts.",
    href: "/neighborhood-map/",
    linkLabel: "Explore the neighborhood",
  },
  {
    title: "HOA Documents",
    description:
      "Download restrictions, declarations, and neighborhood plat maps.",
    href: "/documents/",
    linkLabel: "View HOA documents",
  },
  {
    title: "Board of Directors",
    description:
      "Meet the current Plum Creek Board of Directors and HOA officers.",
    href: "/board/",
    linkLabel: "Meet the Board",
  },
  {
    title: "HOA Committees",
    description:
      "Committee responsibilities, current members, and ways to help.",
    href: "/committees/",
    linkLabel: "Explore committees",
  },
  {
    title: "Community Events",
    description:
      "Upcoming HOA meetings, neighborhood gatherings, and locations.",
    href: "/events/",
    linkLabel: "View upcoming events",
  },
  {
    title: "Volunteer",
    description:
      "Share your interests and availability for neighborhood projects.",
    href: "/committee-volunteer/",
    linkLabel: "Volunteer with Plum Creek",
  },
  {
    title: "Homes Within the HOA",
    description:
      "Search the 119 property addresses within Plum Creek HOA boundaries.",
    href: "/homes/",
    linkLabel: "Search HOA property addresses",
  },
];

export default function Home() {
  return (
    <main>
      <section className="home-banner" id="top">
        <div className="home-banner-photo"><img className="home-banner-image" src="/og.png" alt="Plum Creek Homeowners Association lettering beside the neighborhood's stone entrance at sunset" fetchPriority="high" width={1731} height={908} /></div>
        <div className="home-banner-copy">
          <div className="home-banner-intro">
            <h1 className="home-banner-title">Plum Creek HOA</h1>
            <p className="section-kicker">Our neighborhood · Gardner, Kansas</p>
            <p>Neighborhood information, HOA resources, and your homeowner account.</p>
          </div>
          <div className="hero-actions"><Link className="primary-button" href="/portal/">Homeowner login <span aria-hidden="true">→</span></Link><Link className="outline-button" href="/architectural-request/">Architectural approval</Link></div>
        </div>
      </section>

      <section className="home-destinations">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Find what you need</p>
            <h2>Explore Plum Creek</h2>
          </div>
        </div>

        <div className="destination-grid">
          {destinations.map((destination) => (
            <Link
              className={`destination-card${destination.featured ? " destination-card-featured" : ""}`}
              href={destination.href}
              key={destination.href}
            >
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
