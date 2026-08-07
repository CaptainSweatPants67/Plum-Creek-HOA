"use client";

import { useState } from "react";
import { desktopEmailUrl, gmailComposeUrl, hoaEmail } from "./emailLinks";

type EmailCopyButtonProps = {
  className?: string;
  label?: string;
};

export function EmailCopyButton({
  className,
  label = "Copy email address",
}: EmailCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(hoaEmail);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = hoaEmail;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button className={className} type="button" onClick={copyEmail}>
      {copied ? "Email address copied" : label}
    </button>
  );
}

type EmailActionsProps = {
  subject?: string;
  body?: string;
};

export function EmailActions({ subject, body }: EmailActionsProps) {
  return (
    <div className="email-actions">
      <a
        className="email-action-primary"
        href={gmailComposeUrl(subject, body)}
        target="_blank"
        rel="noreferrer"
      >
        Open in Gmail <span aria-hidden="true">↗</span>
      </a>
      <EmailCopyButton className="email-action-copy" />
      <a className="email-action-desktop" href={desktopEmailUrl(subject, body)}>
        Use desktop email app
      </a>
    </div>
  );
}
