import Link from "next/link";

const email = "pchoa66030@gmail.com";

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
        Questions? <a href={`mailto:${email}`}>{email}</a>
      </p>
      <div className="footer-links">
        <Link href="/board/">Board</Link>
        <Link href="/events/">Events</Link>
        <Link href="/#documents">Documents</Link>
      </div>
    </footer>
  );
}
