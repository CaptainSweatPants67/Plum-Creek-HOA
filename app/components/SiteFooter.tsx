import Link from "next/link";
import { WebmasterContactLink } from "./WebmasterContactLink";

export function SiteFooter() {
  return (
    <footer>
      <Link className="brand footer-brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          PC
        </span>
        <span>
          <strong>Plum Creek</strong>
          <small>Homeowners Association</small>
        </span>
      </Link>
      <p>
        Questions? <Link href="/contact/">pchoa66030@gmail.com</Link>
      </p>
      <div className="footer-links">
        <Link href="/board/">Board</Link>
        <Link href="/committees/">Committees</Link>
        <Link href="/committee-volunteer/">Volunteer</Link>
        <Link href="/events/">Events</Link>
        <Link href="/neighborhood-map/">Map &amp; tracts</Link>
        <Link href="/documents/">Documents</Link>
        <Link href="/dues/">Pay dues</Link>
        <Link href="/architectural-request/">Architectural request</Link>
      </div>
      <WebmasterContactLink />
    </footer>
  );
}
