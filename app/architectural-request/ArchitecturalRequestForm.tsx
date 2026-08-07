"use client";

import type { FormEvent } from "react";

const hoaEmail = "pchoa66030@gmail.com";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export function ArchitecturalRequestForm() {
  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const homeowner = value(formData, "homeowner");
    const propertyAddress = value(formData, "propertyAddress");
    const projectType = value(formData, "projectType");
    const subject = `Architectural approval request — ${propertyAddress}`;
    const body = [
      "PLUM CREEK ARCHITECTURAL APPROVAL REQUEST",
      "",
      `Homeowner: ${homeowner}`,
      `Property address: ${propertyAddress}`,
      `Email: ${value(formData, "email")}`,
      `Phone: ${value(formData, "phone") || "Not provided"}`,
      "",
      `Project type: ${projectType}`,
      `Planned start date: ${value(formData, "startDate") || "Not provided"}`,
      `Contractor: ${value(formData, "contractor") || "Not provided"}`,
      "",
      "PROJECT DESCRIPTION",
      value(formData, "description"),
      "",
      "MATERIALS AND EXTERIOR COLORS",
      value(formData, "materials") || "Not provided",
      "",
      "DIMENSIONS AND LOCATION ON PROPERTY",
      value(formData, "placement") || "Not provided",
      "",
      "SUPPORTING DOCUMENTS",
      value(formData, "supportingDocuments") || "Not provided",
      "",
      "The homeowner understands that preparing this email does not constitute approval and that supporting plans, drawings, specifications, or photographs should be attached before sending when applicable.",
    ].join("\n");

    window.location.href = `mailto:${hoaEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="architectural-form" onSubmit={prepareEmail}>
      <div className="form-section-heading">
        <span>01</span>
        <div>
          <h2>Homeowner information</h2>
          <p>Tell the committee where the proposed work will take place.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Homeowner name *</span>
          <input name="homeowner" autoComplete="name" required />
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
          <h2>Proposed project</h2>
          <p>Provide enough detail for the committee to understand the request.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Project type *</span>
          <select name="projectType" defaultValue="" required>
            <option value="" disabled>
              Select a project type
            </option>
            <option>Fence</option>
            <option>Exterior paint or color change</option>
            <option>Roof</option>
            <option>Deck, patio, or addition</option>
            <option>Detached storage building or structure</option>
            <option>Swimming pool or tennis court</option>
            <option>Solar panels or collectors</option>
            <option>Basketball goal</option>
            <option>Satellite dish or exterior antenna</option>
            <option>Landscaping or grading change</option>
            <option>Other exterior improvement</option>
          </select>
        </label>
        <label className="form-field">
          <span>Planned start date</span>
          <input name="startDate" type="date" />
        </label>
        <label className="form-field form-field-full">
          <span>Project description *</span>
          <textarea
            name="description"
            rows={6}
            maxLength={1800}
            placeholder="Describe the work you plan to complete and the reason for the change."
            required
          />
        </label>
        <label className="form-field form-field-full">
          <span>Materials and exterior colors</span>
          <textarea
            name="materials"
            rows={3}
            maxLength={800}
            placeholder="List siding, roofing, fencing, paint colors, finishes, or other visible materials."
          />
        </label>
        <label className="form-field form-field-full">
          <span>Dimensions and location on the property</span>
          <textarea
            name="placement"
            rows={3}
            maxLength={800}
            placeholder="Include approximate dimensions, setbacks, and where the project will be placed."
          />
        </label>
        <label className="form-field">
          <span>Contractor or installer</span>
          <input name="contractor" placeholder="Company name, if applicable" />
        </label>
        <label className="form-field">
          <span>Supporting documents ready</span>
          <input
            name="supportingDocuments"
            placeholder="Example: site plan, color sample, two photos"
          />
        </label>
      </div>

      <label className="form-confirmation">
        <input name="confirmation" type="checkbox" required />
        <span>
          I understand that this form prepares an email request and does not
          grant approval. I will attach applicable plans, specifications,
          drawings, material samples, or photographs before sending. *
        </span>
      </label>

      <div className="form-submit-row">
        <button type="submit">Prepare email to the HOA</button>
        <p>
          Your email application will open with these answers addressed to {hoaEmail}.
          Review the message, add attachments, and select Send.
        </p>
      </div>
    </form>
  );
}
