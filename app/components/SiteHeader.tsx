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
        <Link href="/officers/">Officers</Link>
        <Link href="/committees/">Committees</Link>
        <Link href="/events/">Events</Link>
        <Link href="/neighborhood-map/">Map</Link>
        <Link href="/documents/">Documents</Link>
        <Link href="/dues/">Dues</Link>
        <Link href="/portal/">Homeowner login</Link>
        <Link href="/members/">Members</Link>
        <Link className="nav-button" href="/contact/">
          Contact
        </Link>
      </nav>
    </header>
  );
}
