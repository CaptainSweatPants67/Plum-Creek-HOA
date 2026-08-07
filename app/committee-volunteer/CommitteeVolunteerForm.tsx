"use client";

import type { FormEvent } from "react";

const hoaEmail = "pchoa66030@gmail.com";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export function CommitteeVolunteerForm() {
  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const resident = value(formData, "resident");
    const committee = value(formData, "committee");
    const subject = `Committee volunteer interest — ${committee}`;
    const body = [
      "PLUM CREEK COMMITTEE VOLUNTEER INTEREST",
      "",
      `Resident: ${resident}`,
      `Property address: ${value(formData, "propertyAddress")}`,
      `Email: ${value(formData, "email")}`,
      `Phone: ${value(formData, "phone") || "Not provided"}`,
      "",
      `Committee preference: ${committee}`,
      `Other committee interest: ${value(formData, "otherCommittee") || "Not applicable"}`,
      `Preferred way to help: ${value(formData, "participation")}`,
      `Availability: ${value(formData, "availability") || "Not provided"}`,
      "",
      "INTEREST AND EXPERIENCE",
      value(formData, "interest"),
      "",
      "ADDITIONAL INFORMATION",
      value(formData, "additionalInformation") || "None",
      "",
      "The resident understands that committee appointments are made or reviewed by the Board of Directors and renewed annually, and that submitting this interest form does not guarantee an appointment.",
    ].join("\n");

    window.location.href = `mailto:${hoaEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="architectural-form" onSubmit={prepareEmail}>
      <div className="form-section-heading">
        <span>01</span>
        <div>
          <h2>About you</h2>
          <p>Provide your contact information so the Board can follow up.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Resident name *</span>
          <input name="resident" autoComplete="name" required />
        </label>
        <label className="form-field">
          <span>Plum Creek property address *</span>
          <input name="propertyAddress" autoComplete="street-address" required />
        </label>
        <label className="form-field">
          <span>Email address *</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="form-field">
          <span>Phone number</span>
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
      </div>

      <div className="form-section-heading">
        <span>02</span>
        <div>
          <h2>How you would like to help</h2>
          <p>Tell the Board where your interests and availability fit best.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Committee preference *</span>
          <select name="committee" defaultValue="" required>
            <option value="" disabled>
              Select a committee
            </option>
            <option>Covenants Review Committee</option>
            <option>Beautification Committee</option>
            <option>Welcoming Committee</option>
            <option>Open to any committee</option>
            <option>Another committee or project</option>
          </select>
        </label>
        <label className="form-field">
          <span>Other committee or project</span>
          <input
            name="otherCommittee"
            placeholder="Optional suggestion or area of interest"
          />
        </label>
        <label className="form-field">
          <span>Preferred way to help *</span>
          <select name="participation" defaultValue="" required>
            <option value="" disabled>
              Select one
            </option>
            <option>Regular committee member</option>
            <option>Help with individual projects</option>
            <option>Volunteer at neighborhood events</option>
            <option>Share professional knowledge or advice</option>
            <option>Not sure yet</option>
          </select>
        </label>
        <label className="form-field">
          <span>General availability</span>
          <input
            name="availability"
            placeholder="Example: weekday evenings or occasional weekends"
          />
        </label>
        <label className="form-field form-field-full">
          <span>Why are you interested in volunteering? *</span>
          <textarea
            name="interest"
            rows={5}
            maxLength={1400}
            placeholder="Share your interests, relevant experience, or ideas for Plum Creek."
            required
          />
        </label>
        <label className="form-field form-field-full">
          <span>Anything else the Board should know?</span>
          <textarea
            name="additionalInformation"
            rows={3}
            maxLength={800}
          />
        </label>
      </div>

      <label className="form-confirmation">
        <input name="confirmation" type="checkbox" required />
        <span>
          I understand that committee appointments are made or reviewed by the
          Board of Directors and renewed annually, and that submitting this form
          does not guarantee an appointment. *
        </span>
      </label>

      <div className="form-submit-row">
        <button type="submit">Prepare volunteer email</button>
        <p>
          Your email application will open with these answers addressed to {hoaEmail}.
          Review the message and select Send.
        </p>
      </div>
    </form>
  );
}
