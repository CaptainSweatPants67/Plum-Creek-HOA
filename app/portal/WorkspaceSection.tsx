"use client";

import { useRef, type ReactNode } from "react";

export function WorkspaceSection({ title, description, children, defaultOpen = false, className = "", sectionId }: { title: string; description?: string; children: ReactNode; defaultOpen?: boolean; className?: string; sectionId?: string }) {
  return <details id={sectionId} className={`portal-panel workspace-section ${className}`} open={defaultOpen}><summary><h2>{title}</h2>{description && <span>{description}</span>}</summary><div className="workspace-section-body">{children}</div></details>;
}

export function SectionControls() {
  const reference = useRef<HTMLDivElement>(null);
  function setOpen(open: boolean) {
    reference.current?.closest(".portal-section")?.querySelectorAll<HTMLDetailsElement>("details.workspace-section").forEach(section => { section.open = open; });
  }
  return <div ref={reference} className="section-controls"><span>Workspace sections</span><button type="button" onClick={() => setOpen(false)}>Collapse all</button><button type="button" onClick={() => setOpen(true)}>Expand all</button></div>;
}
