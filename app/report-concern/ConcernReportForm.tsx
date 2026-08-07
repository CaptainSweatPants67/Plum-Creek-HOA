"use client";

import type { FormEvent } from "react";
import { EmailCopyButton } from "../components/EmailActions";
import {
  desktopEmailUrl,
  gmailComposeUrl,
  hoaEmail,
} from "../components/emailLinks";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export function ConcernReportForm() {
  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const category = value(formData, "category");
    const location = value(formData, "issueLocation");
    const subject = `${category} — ${location || "Plum Creek HOA"}`;
    const body = [
      "PLUM CREEK ISSUE OR CONCERN REPORT",
      "",
      `Category: ${category}`,
      `Resident name: ${value(formData, "resident")}`,
      `Resident property address: ${value(formData, "propertyAddress")}`,
      `Email: ${value(formData, "email")}`,
      `Phone: ${value(formData, "phone") || "Not provided"}`,
      `Preferred response: ${value(formData, "responsePreference")}`,
      "",
      `Issue location or address: ${location || "Not provided"}`,
      `Date observed: ${value(formData, "dateObserved") || "Not provided"}`,
      `Is the concern ongoing?: ${value(formData, "ongoing")}`,
      "",
      "DETAILS",
      value(formData, "details"),
      "",
      "The resident understands that preparing this email does not guarantee a specific response or enforcement action. Supporting photographs or documents may be attached before sending when helpful.",
    ].join("\n");

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;

    if (submitter?.value === "gmail") {
      const gmailUrl = gmailComposeUrl(subject, body);
      const gmailWindow = window.open(gmailUrl, "_blank");

      if (gmailWindow) gmailWindow.opener = null;
      else window.location.href = gmailUrl;
      return;
    }

    window.location.href = desktopEmailUrl(subject, body);
  }

  return (
    <form className="architectural-form" onSubmit={prepareEmail}>
      <div className="form-section-heading">
        <span>01</span>
        <div>
          <h2>About you</h2>
          <p>Provide contact information so the Board can follow up.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Resident name *</span>
          <input name="resident" autoComplete="name" required />
        </label>
        <label className="form-field">
          <span>Your Plum Creek property address *</span>
          <input name="propertyAddress" autoComplete="street-address" required />
        </label>
        <label className="form-field">
          <span>Email *</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="form-field">
          <span>Phone</span>
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
        <label className="form-field">
          <span>Preferred response *</span>
          <select name="responsePreference" defaultValue="Email" required>
            <option>Email</option>
            <option>Phone</option>
            <option>Either email or phone</option>
          </select>
        </label>
      </div>

      <div className="form-section-heading form-section-spaced">
        <span>02</span>
        <div>
          <h2>Issue or concern</h2>
          <p>Share factual details that will help the Board understand it.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Type of report *</span>
          <select name="category" defaultValue="" required>
            <option value="" disabled>
              Select one
            </option>
            <option>General concern</option>
            <option>Possible covenants violation</option>
            <option>Other issue</option>
          </select>
        </label>
        <label className="form-field">
          <span>Issue location or address</span>
          <input name="issueLocation" placeholder="Where did this occur?" />
        </label>
        <label className="form-field">
          <span>Date observed</span>
          <input name="dateObserved" type="date" />
        </label>
        <label className="form-field">
          <span>Is the concern ongoing? *</span>
          <select name="ongoing" defaultValue="Yes" required>
            <option>Yes</option>
            <option>No</option>
            <option>Not sure</option>
          </select>
        </label>
        <label className="form-field form-field-full">
          <span>Describe the issue or concern *</span>
          <textarea
            name="details"
            rows={8}
            placeholder="Describe what you observed, when it happened, and any helpful context."
            required
          />
        </label>
      </div>

      <label className="form-confirmation">
        <input name="confirmation" type="checkbox" required />
        <span>
          I have provided information that is accurate to the best of my
          knowledge. I understand this form prepares an email and does not
          guarantee a specific response or enforcement action. *
        </span>
      </label>

      <div className="form-submit-row">
        <div className="form-submit-actions">
          <button type="submit">Prepare concern email</button>
          <div className="form-email-fallbacks">
            <span>If that does not work:</span>
            <button className="form-email-gmail" type="submit" value="gmail">
              Open in Gmail
            </button>
            <EmailCopyButton className="form-copy-email" label="Copy HOA email" />
          </div>
        </div>
        <p>
          Your phone or computer&apos;s email app opens with this report addressed
          to {hoaEmail}. Review it, add helpful photos or documents, and select
          Send.
        </p>
      </div>
    </form>
  );
}
