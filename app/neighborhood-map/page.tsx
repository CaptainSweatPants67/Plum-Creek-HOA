/* The local neighborhood images are intentionally served as static assets. */
/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";

const tracts = [
  {
    letter: "A",
    title: "Big Pond",
    description:
      "The large neighborhood pond area with its walking path, pedestrian bridge, lawn, and established trees.",
    image: "/tracts/tract-a-big-pond.jpg",
  },
  {
    letter: "B",
    title: "Cherry Hills Circle Cul-de-sac",
    description:
      "HOA-owned green space serving the Cherry Hills Circle cul-de-sac.",
    image: "/tracts/tract-b-cherry-hills.jpg",
  },
  {
    letter: "C",
    title: "Sycamore Street Island",
    description:
      "The landscaped neighborhood island along Sycamore Street.",
    image: "/tracts/tract-c-island.jpg",
  },
  {
    letter: "D",
    title: "Park, Playground & Pond",
    description:
      "The community recreation tract with open lawn, walking access, playground equipment, trees, and pond area.",
    image: "/tracts/tract-d-park.jpg",
  },
  {
    letter: "E",
    title: "Little Pond & Entrance",
    description:
      "The smaller neighborhood pond and landscaped Plum Creek entrance monument.",
    image: "/tracts/tract-e-little-pond.jpg",
  },
  {
    letter: "F",
    title: "Juniper Cul-de-sac South",
    description:
      "HOA-owned open green space at the south Juniper cul-de-sac.",
    image: "/tracts/tract-f-juniper-south.jpg",
  },
  {
    letter: "G",
    title: "Elm Street Cul-de-sac",
    description:
      "HOA-owned open green space serving the Elm Street cul-de-sac.",
    image: "/tracts/tract-g-elm.jpg",
  },
  {
    letter: "H",
    title: "Juniper Cul-de-sac North",
    description:
      "HOA-owned open green space at the north Juniper cul-de-sac.",
    image: "/tracts/tract-h-juniper-north.jpg",
  },
];

type TractInfo = {
  acres: number;
  address?: string;
  squareFeet: number;
};

export const metadata: Metadata = {
  title: "Neighborhood Map & HOA Tracts | Plum Creek",
  description:
    "View the Plum Creek neighborhood map and the eight tracts owned and maintained by the HOA.",
};

function getMapLink() {
  return readFileSync(
    path.join(process.cwd(), "Info", "MapLink.txt"),
    "utf8",
  ).trim();
}

function getTractInfo() {
  const rows = readFileSync(
    path.join(process.cwd(), "Info", "Track Info.txt"),
    "utf8",
  )
    .trim()
    .split(/\r?\n/)
    .slice(1);

  return new Map<string, TractInfo>(
    rows.map((row) => {
      const [tractName, squareFeet, acres, rawAddress] = row
        .split(",")
        .map((field) => field.trim());
      const letter = tractName.replace(/^Tract\s+/i, "");
      const address = rawAddress && rawAddress.toUpperCase() !== "N/A"
        ? rawAddress
        : undefined;

      return [
        letter,
        {
          acres: Number(acres),
          address,
          squareFeet: Number(squareFeet),
        },
      ];
    }),
  );
}

export default function NeighborhoodMapPage() {
  const mapLink = getMapLink();
  const tractInfo = getTractInfo();
  const totalSquareFeet = Array.from(tractInfo.values()).reduce(
    (total, tract) => total + tract.squareFeet,
    0,
  );
  const totalAcres = totalSquareFeet / 43_560;

  return (
    <main className="inner-page">
      <section className="inner-hero map-page-hero">
        <p className="section-kicker">Shared neighborhood spaces</p>
        <h1>Map & HOA-owned tracts</h1>
        <p>
          Explore Plum Creek&apos;s neighborhood boundaries and the shared
          outdoor areas held for the benefit of the community.
        </p>
      </section>

      <section className="map-overview-section">
        <div className="map-overview-image">
          <img
            src="/plum-creek-map.jpg"
            alt="Map showing the Plum Creek neighborhood area"
          />
        </div>
        <div className="map-overview-copy">
          <p className="section-kicker">Neighborhood map</p>
          <h2>Find your way around Plum Creek.</h2>
          <p>
            Open the interactive map to view neighborhood streets and the
            larger Plum Creek community area.
          </p>
          <a href={mapLink} target="_blank" rel="noreferrer">
            Open interactive map <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section className="tracts-section">
        <div className="tract-showcase" aria-label="Plum Creek HOA tract features">
          <div className="tract-showcase-primary">
            <strong>{totalAcres.toFixed(2)}</strong>
            <span>Approximate HOA-owned acres</span>
          </div>
          <div className="tract-showcase-number">
            <strong>8</strong>
            <span>HOA-owned tracts</span>
          </div>
          <div className="tract-showcase-number">
            <strong>3</strong>
            <span>Neighborhood ponds</span>
          </div>
          <div className="tract-showcase-number">
            <strong>1</strong>
            <span>Community playground</span>
          </div>
          <div>
            <strong>Fishing</strong>
            <span>Catch-and-release</span>
          </div>
          <div>
            <strong>Green space</strong>
            <span>Lawns, trees, paths &amp; ponds</span>
          </div>
        </div>

        <p className="tract-acreage-note">
          Total acreage is calculated from 251,707.24 square feet. Acreage shown
          on individual tract cards is rounded to two decimal places.
        </p>

        <div className="tracts-heading">
          <div>
            <p className="section-kicker">Tracts A–H</p>
            <h2>Shared places, shared care.</h2>
          </div>
          <p>
            These eight tracts are owned by the Plum Creek HOA and maintained
            for the neighborhood through hired contractors and volunteer
            homeowners.
          </p>
        </div>

        <div className="tract-stewardship-note">
          <span aria-hidden="true">HOA ownership &amp; stewardship</span>
          <p>
            Contractor services support routine and specialized maintenance,
            while homeowner volunteers help care for, improve, and strengthen
            these shared community spaces.
          </p>
        </div>

        <div className="tract-access-notices">
          <article className="tract-access-card tract-access-card-fishing">
            <span>Catch-and-release fishing</span>
            <h3>Fishing is allowed in the HOA ponds.</h3>
            <p>
              Fishing is for Plum Creek HOA homeowners and their family members
              only. All fish must be released back into the pond; fishing is
              catch-and-release only.
            </p>
          </article>

          <article className="tract-access-card tract-access-card-boundary">
            <span>Private community access</span>
            <h3>Plum Creek HOA parks and ponds are not public amenities.</h3>
            <p>
              <strong>Plum Creek Estates</strong> and{" "}
              <strong>Plum Creek Manor</strong> are not part of Plum Creek HOA.
              Residents of those neighborhoods do not have access to Plum Creek
              HOA parks or ponds.
            </p>
            <Link href="/homes/">View homes within Plum Creek HOA</Link>
          </article>
        </div>

        <div className="tract-grid">
          {tracts.map((tract) => {
            const details = tractInfo.get(tract.letter);

            return (
              <article className="tract-card" key={tract.letter}>
                <div className="tract-image-wrap">
                  <img
                    src={tract.image}
                    alt={`Enhanced view of Tract ${tract.letter}: ${tract.title}`}
                    loading="lazy"
                  />
                  <span>Tract {tract.letter}</span>
                </div>
                <div className="tract-copy">
                  <h3>{tract.title}</h3>
                  <div className="tract-card-details">
                    <span>
                      <small>Area</small>
                      {details ? `${details.acres.toFixed(2)} acres` : "Not listed"}
                    </span>
                    {details?.address ? (
                      <span>
                        <small>Address</small>
                        {details.address}
                      </span>
                    ) : null}
                  </div>
                  <p>{tract.description}</p>
                </div>
              </article>
            );
          })}
        </div>

        <p className="tract-image-note">
          Enhanced reference views are provided for orientation; landscaping,
          maintenance, and seasonal conditions may change.
        </p>
      </section>
    </main>
  );
}
