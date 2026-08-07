import type { Metadata } from "next";
import Link from "next/link";
import { EmailCopyButton } from "../components/EmailActions";

export const metadata: Metadata = {
  title: "Pay Your Dues | Plum Creek HOA",
  description:
    "2026 Plum Creek HOA dues amounts, mailing instructions, Venmo payment information, and due-date details.",
};

export default function DuesPage() {
  return (
    <main className="inner-page">
      <section className="inner-hero dues-hero">
        <p className="section-kicker">2026 homeowner information</p>
        <h1>Pay your HOA dues</h1>
        <p>
          Choose a personal check or Venmo and include enough information for
          the HOA to apply your payment to the correct property.
        </p>
      </section>

      <section className="dues-page-section">
        <div className="dues-summary" aria-label="2026 dues summary">
          <div>
            <span>2026 dues</span>
            <strong>$260.00</strong>
            <p>When paying by personal check</p>
          </div>
          <div>
            <span>Venmo total</span>
            <strong>$265.14</strong>
            <p>Includes the Venmo processing fee</p>
          </div>
          <div>
            <span>Late date</span>
            <strong>May 1</strong>
            <p>Add the $30 late fee to payments made after this date</p>
          </div>
        </div>

        <section className="dues-support-section">
          <div className="dues-support-heading">
            <div>
              <p className="section-kicker">What your dues support</p>
              <h2>Maintaining Plum Creek&apos;s shared responsibilities.</h2>
            </div>
            <div>
              <p>
                Annual dues help cover the association&apos;s shared property,
                maintenance, insurance, and operating expenses.
              </p>
              <Link href="/neighborhood-map/">
                Explore the HOA-owned land, ponds, and green spaces
              </Link>
            </div>
          </div>

          <div className="dues-support-grid">
            <article>
              <span>01</span>
              <h3>Land &amp; green spaces</h3>
              <p>
                Mowing and routine upkeep for HOA-owned land and neighborhood
                green spaces.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Pond maintenance</h3>
              <p>
                Ongoing care and maintenance for the three HOA-owned ponds.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Insurance</h3>
              <p>Association insurance costs for Plum Creek HOA.</p>
            </article>
            <article>
              <span>04</span>
              <h3>Administration</h3>
              <p>
                Administrative fees and the routine operating costs of the
                association.
              </p>
            </article>
          </div>
        </section>

        <div className="dues-payment-grid">
          <article className="dues-payment-card">
            <p className="section-kicker">Option one</p>
            <h2>Pay by personal check</h2>
            <p>
              Make your check payable to <strong>Plum Creek HOA</strong> and
              mail it to:
            </p>
            <address>
              Plum Creek Homeowners Association
              <br />
              P.O. Box 14
              <br />
              Gardner, KS 66030
            </address>
            <p className="dues-card-note">
              The 2026 amount due by personal check is <strong>$260.00</strong>.
              If paying after May 1, 2026, include the $30 late fee for a total
              of <strong>$290.00</strong>.
            </p>
          </article>

          <article className="dues-payment-card dues-payment-card-venmo">
            <p className="section-kicker">Option two</p>
            <h2>Pay with Venmo</h2>
            <p>
              In Venmo, search for the Plum Creek HOA using the email address
              <strong> pchoa66030@gmail.com</strong>.
            </p>
            <EmailCopyButton
              className="dues-copy-email"
              label="Copy Venmo search email"
            />
            <div className="dues-important-note">
              <strong>Include your name and property address</strong>
              <p>
                Put both in the Venmo comment line so the HOA can apply the
                payment to the correct account.
              </p>
            </div>
            <p className="dues-card-note">
              Submit <strong>$265.14</strong> through Venmo. This total includes
              the processing fee for the $260.00 dues amount. If paying after
              May 1, 2026, add the $30 late fee and contact the HOA to confirm
              the correct Venmo total including its processing fee.
            </p>
          </article>
        </div>

        <div className="dues-deadline-note">
          <div>
            <p className="section-kicker">Payment timing</p>
            <h2>Payments after May 1, 2026 include a $30 late fee.</h2>
          </div>
          <p>
            Accounts that remain unpaid as of May 1, 2026 will be considered
            late, and formal notices will be mailed. The amount due after May 1
            is <strong>$290.00</strong> before any Venmo processing fee. If you
            have already sent your payment, please disregard this reminder.
          </p>
        </div>

        <div className="dues-future-note">
          <p className="section-kicker">Looking ahead</p>
          <h2>2027 HOA dues</h2>
          <p>
            The next year&apos;s dues are set by the Board each year following the
            Annual Meeting of Members. The 2027 dues amount will be posted on
            this website by <strong>January 1, 2027</strong>.
          </p>
          <Link href="/events/">View the Annual Meeting date</Link>
        </div>

        <p className="dues-question-link">
          Have a payment question? <Link href="/contact/">Contact the HOA</Link>.
        </p>
      </section>
    </main>
  );
}
