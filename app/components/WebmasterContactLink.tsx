"use client";

import type { MouseEvent } from "react";
import { EmailCopyButton } from "./EmailActions";
import { desktopEmailUrl, gmailComposeUrl } from "./emailLinks";

export function WebmasterContactLink() {
  function subjectWithCurrentDate() {
    const date = new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(new Date());

    return `Webmaster Site Issue - ${date}`;
  }

  function updateGmailEmail(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = gmailComposeUrl(subjectWithCurrentDate());
  }

  function updateDesktopEmail(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = desktopEmailUrl(subjectWithCurrentDate());
  }

  return (
    <div className="footer-webmaster">
      <a
        className="footer-webmaster-button"
        href={desktopEmailUrl("Webmaster Site Issue")}
        onClick={updateDesktopEmail}
      >
        Contact Michael Bruna with website issues
        <span aria-hidden="true">↗</span>
      </a>
      <div className="footer-webmaster-fallbacks">
        <span>If that does not work:</span>
        <a
          className="footer-webmaster-gmail"
          href={gmailComposeUrl("Webmaster Site Issue")}
          target="_blank"
          rel="noreferrer"
          onClick={updateGmailEmail}
        >
          Open in Gmail
        </a>
        <EmailCopyButton className="footer-webmaster-copy" label="Copy HOA email" />
      </div>
    </div>
  );
}
