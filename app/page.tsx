/* The local neighborhood images are intentionally served as static assets. */
/* eslint-disable @next/next/no-img-element */

import { readFileSync } from "node:fs";
import path from "node:path";

const email = "pchoa66030@gmail.com";

const governingDocuments = [
  {
    title: "Declaration of Restrictions",
    description:
      "The recorded covenants and restrictions that guide property use within Plum Creek.",
    href: "/documents/declaration-of-restrictions.pdf",
    size: "3.6 MB",
  },
  {
    title: "Association By-Laws",
    description:
      "The rules that establish how the homeowners association is organized and governed.",
    href: "/documents/plum-creek-bylaws.pdf",
    size: "3.6 MB",
  },
  {
    title: "Supplemental & Ratifying Declarations",
    description:
      "Supplemental recorded provisions and the ratification of the community declarations.",
    href: "/documents/supplemental-ratifying-declarations.pdf",
    size: "4.1 MB",
  },
];

const platMaps = [
  {
    title: "Plum Creek Plat Map 1",
    description: "Recorded neighborhood plat image, section one.",
    href: "/documents/plat-map-1.pdf",
    size: "1.0 MB",
  },
  {
    title: "Plum Creek Plat Map 2",
    description: "Recorded neighborhood plat image, section two.",
    href: "/documents/plat-map-2.pdf",
    size: "719 KB",
  },
  {
    title: "Plum Creek Plat Map 3",
    description: "Recorded neighborhood plat image, section three.",
    href: "/documents/plat-map-3.pdf",
    size: "1.1 MB",
  },
];

type DocumentItem = (typeof governingDocuments)[number];

function getMapLink() {
  return readFileSync(
    path.join(process.cwd(), "Info", "MapLink.txt"),
    "utf8",
  ).trim();
}

function DownloadCard({ document }: { document: DocumentItem }) {
  return (
    <article className="document-card">
      <div className="document-type" aria-hidden="true">
        PDF
      </div>
      <div className="document-copy">
        <h3>{document.title}</h3>
        <p>{document.description}</p>
        <span>{document.size} &middot; PDF</span>
      </div>
      <a className="download-link" href={document.href} download>
        <span>Download</span>
        <span aria-hidden="true">&darr;</span>
      </a>
    </article>
  );
}

export default function Home() {
  const mapLink = getMapLink();

  return (
    <main>
      <section className="hero hero-social" id="top">
        <img
          className="hero-image"
          src="/og.png"
          alt="Plum Creek Homeowners Association entrance"
        />
        <div className="hero-quickbar">
          <p>
            Official neighborhood information, community dates, and member
            resources in one convenient place.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#documents">
              View documents
            </a>
            <a className="outline-button" href="/events/">
              Upcoming events
            </a>
          </div>
        </div>
      </section>

      <section className="intro" id="about">
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
            <a href="/board/">
              <strong>2025</strong>
              <span>Latest board roster</span>
            </a>
            <a href="#documents">
              <strong>6</strong>
              <span>Community documents</span>
            </a>
            <a href="/events/">
              <strong>Dates</strong>
              <span>Community events</span>
            </a>
          </div>
        </div>
      </section>

      <section className="documents-section" id="documents">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Member resources</p>
            <h2>HOA documents</h2>
          </div>
          <p>Select any document below to save a PDF copy to your device.</p>
        </div>

        <div className="document-group">
          <div className="group-heading">
            <span>01</span>
            <h3>Governing documents</h3>
          </div>
          <div className="document-grid">
            {governingDocuments.map((document) => (
              <DownloadCard key={document.href} document={document} />
            ))}
          </div>
        </div>

        <div className="document-group">
          <div className="group-heading">
            <span>02</span>
            <h3>Plat maps</h3>
          </div>
          <div className="document-grid">
            {platMaps.map((document) => (
              <DownloadCard key={document.href} document={document} />
            ))}
          </div>
        </div>
      </section>

      <section className="community-section" id="community">
        <div className="community-image-wrap">
          <img
            src="/plum-creek-map.jpg"
            alt="Map showing the Plum Creek neighborhood area"
          />
        </div>
        <div className="community-copy">
          <p className="section-kicker">Neighborhood map</p>
          <h2>Know your community.</h2>
          <p>
            View the interactive neighborhood map or visit the board and events
            pages for current association information.
          </p>
          <div className="community-links">
            <a
              href={mapLink}
              className="inline-link"
              target="_blank"
              rel="noreferrer"
            >
              Open interactive map <span aria-hidden="true">&nearr;</span>
            </a>
            <a href="/board/" className="inline-link">
              Meet the board <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div>
          <p className="section-kicker">Contact the HOA</p>
          <h2>How can we help?</h2>
        </div>
        <div className="contact-card">
          <p>
            Questions about Plum Creek, the association, or community records
            can be sent directly to the HOA board.
          </p>
          <a href={`mailto:${email}`}>{email}</a>
        </div>
      </section>
    </main>
  );
}
