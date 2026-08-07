"use client";

import type { MouseEvent } from "react";

const hoaEmail = "pchoa66030@gmail.com";

export function WebmasterContactLink() {
  function openWebsiteIssueEmail(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const date = new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(new Date());
    const subject = `Webmaster Site Issue - ${date}`;

    window.location.href = `mailto:${hoaEmail}?subject=${encodeURIComponent(subject)}`;
  }

  return (
    <div className="footer-webmaster">
      <a
        className="footer-webmaster-button"
        href={`mailto:${hoaEmail}?subject=${encodeURIComponent("Webmaster Site Issue")}`}
        onClick={openWebsiteIssueEmail}
      >
        Contact Michael Bruna with website issues
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
