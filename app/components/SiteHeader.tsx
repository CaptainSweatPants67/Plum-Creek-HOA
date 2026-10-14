"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const primaryLinks = [
  ["/", "Home"], ["/dues/", "Dues"], ["/documents/", "Documents"],
  ["/events/", "Events"], ["/neighborhood-map/", "Map"], ["/contact/", "Contact"],
];
const communityLinks = [
  ["/board/", "Board of Directors"], ["/officers/", "Officers"],
  ["/committees/", "Committees"], ["/homes/", "Homes in the HOA"],
  ["/committee-volunteer/", "Volunteer"], ["/run-for-board/", "Run for the Board"],
  ["/architectural-request/", "Architectural approval"], ["/report-concern/", "Report a concern"],
  ["/members/", "Member information"],
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const more = useRef<HTMLDetailsElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const active = (href: string) => pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
  function closeMenus() { setMenuOpen(false); if (more.current) more.current.open = false; }

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!header.current?.contains(event.target as Node)) {
        setMenuOpen(false); if (more.current) more.current.open = false;
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (more.current?.open) { more.current.open = false; more.current.querySelector("summary")?.focus(); }
      if (menuButton.current?.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false); menuButton.current.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  return (
    <header ref={header} className="site-header">
      <Link className="brand" href="/" aria-label="Plum Creek HOA home" onClick={closeMenus}>
        <span className="brand-mark" aria-hidden="true">
          PC
        </span>
        <span>
          <strong>Plum Creek</strong>
          <small>Homeowners Association</small>
          <small className="brand-location">Gardner, Kansas 66030</small>
        </span>
      </Link>
      <button ref={menuButton} className="site-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => { setMenuOpen(!menuOpen); if (more.current) more.current.open = false; }}>Menu <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span></button>
      <nav id="site-navigation" className="primary-navigation" data-open={menuOpen} aria-label="Primary navigation">
        {primaryLinks.map(([href,label]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} onClick={closeMenus}>{label}</Link>)}
        <details className="site-more" ref={more} data-active={communityLinks.some(([href]) => active(href))}>
          <summary>More <span aria-hidden="true">⌄</span></summary>
          <div className="site-more-links">
            <span className="site-menu-label">Around the neighborhood</span>
            {communityLinks.map(([href,label]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} onClick={closeMenus}>{label}</Link>)}
          </div>
        </details>
        <Link className="nav-button" href="/portal/" onClick={closeMenus}>Member portal <span aria-hidden="true">→</span></Link>
      </nav>
    </header>
  );
}
