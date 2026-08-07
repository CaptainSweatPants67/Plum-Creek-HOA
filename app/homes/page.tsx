import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HomesDirectory } from "./HomesDirectory";

export const metadata: Metadata = {
  title: "Homes Within Plum Creek HOA | Gardner, Kansas",
  description:
    "Search the 119 Gardner, Kansas 66030 property addresses currently located within the boundaries of Plum Creek Homeowners Association.",
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
