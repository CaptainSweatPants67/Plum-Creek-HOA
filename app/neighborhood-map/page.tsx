/* The local neighborhood images are intentionally served as static assets. */
/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
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

export default function NeighborhoodMapPage() {
  const mapLink = getMapLink();

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

        <div className="tract-grid">
          {tracts.map((tract) => (
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
                <p>{tract.description}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="tract-image-note">
          Enhanced reference views are provided for orientation; landscaping,
          maintenance, and seasonal conditions may change.
        </p>
      </section>
    </main>
  );
}
