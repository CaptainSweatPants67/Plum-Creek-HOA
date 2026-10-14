import type { Metadata } from "next";
import Link from "next/link";

const governingDocuments = [
  {
    title: "Declaration of Restrictions",
    description:
      "The recorded covenants and restrictions that guide property use within Plum Creek.",
    href: "/documents/declaration-of-restrictions.pdf",
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

export const metadata: Metadata = {
  title: "HOA Documents | Plum Creek",
  description:
    "Download Plum Creek HOA declarations, restrictions, and recorded plat maps.",
};

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

export default function DocumentsPage() {
  return (
    <main className="inner-page">
      <section className="inner-hero documents-hero">
        <p className="section-kicker">Member resources</p>
        <h1>HOA documents</h1>
        <p>
          Download Plum Creek&apos;s governing documents, declarations,
          restrictions, and recorded neighborhood plats.
        </p>
      </section>

      <section className="documents-section documents-page-section">
        <p className="portal-notice">Association bylaws and leadership history are available in the <Link href="/member-documents/">member library</Link> after signing in.</p>
        <p className="document-intro">Select any document below to save a PDF copy to your device.</p>

        <div className="document-group">
          <div className="group-heading">
            <span>01</span>
            <h2>Governing documents</h2>
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
            <h2>Plat maps</h2>
          </div>
          <div className="document-grid">
            {platMaps.map((document) => (
              <DownloadCard key={document.href} document={document} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
