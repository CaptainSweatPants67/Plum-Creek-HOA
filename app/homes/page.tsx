import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HomesDirectory } from "./HomesDirectory";

export const metadata: Metadata = {
  title: "Homes Within Plum Creek HOA | Gardner, Kansas",
  description:
    "Search the 119 Gardner, Kansas 66030 property addresses within Plum Creek HOA and view an approximate Zillow value snapshot.",
};

function getHoaHomeAddresses() {
  return readFileSync(
    path.join(process.cwd(), "Info", "HOA Homes.txt"),
    "utf8",
  )
    .trim()
    .split(/\r?\n/)
    .map((address) => address.trim())
    .filter(Boolean);
}

export default function HomesPage() {
  const addresses = getHoaHomeAddresses();

  return (
    <main className="inner-page">
      <section className="inner-hero homes-hero">
        <p className="section-kicker">Official HOA boundary reference</p>
        <h1>Homes within Plum Creek HOA</h1>
        <p>
          The following property addresses are currently within the boundaries
          of Plum Creek HOA in Gardner, Kansas 66030.
        </p>
      </section>

      <section className="homes-page-section">
        <div className="homes-page-intro">
          <div className="homes-count-card">
            <strong>{addresses.length}</strong>
            <span>HOA property addresses</span>
          </div>
          <div>
            <p className="section-kicker">Property reference</p>
            <h2>Search by house number or street.</h2>
            <p>
              This public reference is provided for homeowners, prospective
              buyers, real estate professionals, lenders, and title companies.
              The list was updated in August 2026.
            </p>
          </div>
        </div>

        <section
          className="homes-value-snapshot"
          aria-labelledby="homes-value-heading"
        >
          <div className="homes-value-primary">
            <p className="section-kicker">Zillow value snapshot</p>
            <strong>$403,680</strong>
            <span>Average available Zestimate</span>
          </div>
          <div className="homes-value-details">
            <h2 id="homes-value-heading">
              An approximate neighborhood value reference.
            </h2>
            <div className="homes-value-stats">
              <div>
                <strong>106 of 119</strong>
                <span>Homes with an available Zillow value</span>
              </div>
              <div>
                <strong>$402,700</strong>
                <span>Median available Zestimate</span>
              </div>
            </div>
            <p>
              Calculated from Zillow-indexed Zestimates available during an
              August 2026 review. Thirteen homes did not return a usable
              Zestimate and were excluded from the calculation. A Zestimate is
              an automated market estimate, not an appraisal.
            </p>
            <p>
              This information is provided for general reference and is not
              used by the HOA to set dues or determine property values.
            </p>
            <a
              href="https://www.zillow.com/zestimate/"
              target="_blank"
              rel="noreferrer"
            >
              Learn how Zillow calculates Zestimates
            </a>
          </div>
        </section>

        <HomesDirectory addresses={addresses} />

        <div className="homes-verification-note">
          <div>
            <p className="section-kicker">Need HOA verification?</p>
            <h2>Questions about a property or closing?</h2>
          </div>
          <p>
            Contact the Plum Creek HOA for questions about association records,
            dues, or property status. You can also review the{" "}
            <Link href="/neighborhood-map/">neighborhood map and HOA tracts</Link>.
          </p>
          <Link href="/contact/">Contact the HOA</Link>
        </div>
      </section>
    </main>
  );
}
