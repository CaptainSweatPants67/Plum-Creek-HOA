import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Plum Creek HOA home">
        <span className="brand-mark" aria-hidden="true">
          PC
        </span>
        <span>
          <strong>Plum Creek</strong>
          <small>Homeowners Association</small>
          <small className="brand-location">Gardner, Kansas 66030</small>
        </span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/">Home</Link>
        <Link href="/board/">Board</Link>
        <Link href="/committees/">Committees</Link>
        <Link href="/events/">Events</Link>
        <Link href="/neighborhood-map/">Map</Link>
        <Link href="/documents/">Documents</Link>
        <a className="nav-button" href="mailto:pchoa66030@gmail.com">
          Contact
        </a>
      </nav>
    </header>
  );
}
