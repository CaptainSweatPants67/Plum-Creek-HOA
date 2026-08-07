"use client";

import type { FormEvent } from "react";

const hoaEmail = "pchoa66030@gmail.com";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export function BoardCandidateForm() {
  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const resident = value(formData, "resident");
    const position = value(formData, "position");
    const subject = `Board candidate interest — ${resident}`;
    const body = [
      "PLUM CREEK BOARD CANDIDATE INTEREST",
      "",
      `Resident: ${resident}`,
      `Property address: ${value(formData, "propertyAddress")}`,
      `Email: ${value(formData, "email")}`,
      `Phone: ${value(formData, "phone") || "Not provided"}`,
      "",
      `Officer position of interest: ${position}`,
      `Availability: ${value(formData, "availability") || "Not provided"}`,
      "",
      "WHY I WOULD LIKE TO SERVE",
      value(formData, "interest"),
      "",
      "EXPERIENCE, SKILLS, OR COMMUNITY INVOLVEMENT",
      value(formData, "experience") || "Not provided",
      "",
      "PRIORITIES OR IDEAS FOR PLUM CREEK",
      value(formData, "priorities") || "Not provided",
      "",
      "The resident understands that homeowners elect members to Board seats at the annual meeting and that officer positions are appointed each year by the Board. Submitting this form does not place a name on the ballot or guarantee election or appointment.",
    ].join("\n");

    window.location.href = `mailto:${hoaEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="architectural-form" onSubmit={prepareEmail}>
      <div className="form-section-heading">
        <span>01</span>
        <div>
          <h2>Candidate information</h2>
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
          <h2>Interest in Board service</h2>
          <p>
            Homeowners elect Board members; the Board appoints officer
            positions annually.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Officer position of interest *</span>
          <select name="position" defaultValue="" required>
            <option value="" disabled>
              Select a position
            </option>
            <option>President</option>
            <option>Vice President</option>
            <option>Secretary</option>
            <option>Treasurer</option>
            <option>Member</option>
          </select>
        </label>
        <label className="form-field">
          <span>General availability</span>
          <input
            name="availability"
            placeholder="Example: weekday evenings and annual meetings"
          />
        </label>
        <label className="form-field form-field-full">
          <span>Why would you like to serve on the Board? *</span>
          <textarea
            name="interest"
            rows={5}
            maxLength={1400}
            placeholder="Share what interests you about serving Plum Creek homeowners."
            required
          />
        </label>
        <label className="form-field form-field-full">
          <span>Relevant experience, skills, or community involvement</span>
          <textarea name="experience" rows={4} maxLength={1200} />
        </label>
        <label className="form-field form-field-full">
          <span>Priorities or ideas for Plum Creek</span>
          <textarea name="priorities" rows={4} maxLength={1200} />
        </label>
      </div>

      <label className="form-confirmation">
        <input name="confirmation" type="checkbox" required />
        <span>
          I understand that homeowners elect members to Board seats at the
          annual meeting and the Board appoints officer positions each year.
          Submitting this form does not place my name on the ballot or guarantee
          election or appointment. *
        </span>
      </label>

      <div className="form-submit-row">
        <button type="submit">Prepare Board interest email</button>
        <p>
          Your email application will open with these answers addressed to {hoaEmail}.
          Review the message and select Send.
        </p>
      </div>
    </form>
  );
}
