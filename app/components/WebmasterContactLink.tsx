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

  function openGmail(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const gmailWindow = window.open(
      gmailComposeUrl(subjectWithCurrentDate()),
      "_blank",
    );

    if (gmailWindow) gmailWindow.opener = null;
    else window.location.href = gmailComposeUrl(subjectWithCurrentDate());
  }

  function updateDesktopEmail(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = desktopEmailUrl(subjectWithCurrentDate());
  }

  return (
    <div className="footer-webmaster">
      <a
        className="footer-webmaster-button"
        href={gmailComposeUrl("Webmaster Site Issue")}
        target="_blank"
        rel="noreferrer"
        onClick={openGmail}
      >
        Contact Michael Bruna with website issues
        <span aria-hidden="true">↗</span>
      </a>
      <EmailCopyButton className="footer-webmaster-copy" label="Copy HOA email" />
      <a
        className="footer-webmaster-desktop"
        href={desktopEmailUrl("Webmaster Site Issue")}
        onClick={updateDesktopEmail}
      >
        Use email app
      </a>
    </div>
  );
}
