import type { Metadata } from "next";
import { EmailActions } from "../components/EmailActions";
import { hoaEmail } from "../components/emailLinks";

export const metadata: Metadata = {
  title: "Contact the HOA | Plum Creek",
  description:
    "Contact the Plum Creek Homeowners Association in Gardner, Kansas.",
};

export default function ContactPage() {
  return (
    <main className="inner-page">
      <section className="inner-hero contact-page-hero">
        <p className="section-kicker">We&apos;re here to help</p>
        <h1>Contact the HOA</h1>
        <p>
          Send questions about Plum Creek, association business, community
          records, committees, events, or neighborhood concerns.
        </p>
      </section>

      <section className="contact-page-section">
        <div className="contact-page-copy">
          <p className="section-kicker">Plum Creek HOA email</p>
          <h2>{hoaEmail}</h2>
          <p>
            Gmail opens directly in your browser and does not require Windows
            to have a default email application. You can also copy the address
            or try your installed desktop email app.
          </p>
        </div>

        <div className="contact-options-card">
          <span>Choose how to contact us</span>
          <EmailActions subject="Plum Creek HOA Question" />
          <p>
            The website does not collect or store your message. You review and
            send it from your own email account.
          </p>
        </div>
      </section>
    </main>
  );
}
