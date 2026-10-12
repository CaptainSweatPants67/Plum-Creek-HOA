"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const portal = /^\/(portal|members|admin|leadership|member-documents)(\/|$)/.test(pathname);
  return portal ? <div className="portal-shell"><header className="portal-topbar"><Link href="/portal/" className="portal-brand">Plum Creek <span>Member portal</span></Link><Link href="/">Public website ↗</Link></header>{children}<div className="portal-bottom">Plum Creek HOA · Private member workspace</div></div> : <><SiteHeader />{children}<SiteFooter /></>;
}
