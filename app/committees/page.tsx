import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";

type CommitteeKey =
  | "architectural"
  | "covenants"
  | "beautification"
  | "welcoming";

type CommitteeMember = {
  name: string;
  role: string;
};

type Committee = {
  key: CommitteeKey;
  title: string;
  description: string;
  responsibilities: string[];
};

const committees: Committee[] = [
  {
    key: "architectural",
    title: "Architectural Control Committee",
    description:
      "Reviews proposed exterior construction and property changes for consistency with Plum Creek's recorded restrictions. The current Board of Directors serves as this committee.",
    responsibilities: [
      "Review plans, specifications, materials, exterior colors, and project placement",
      "Consider fences, roofs, detached structures, pools, solar panels, basketball goals, and similar exterior improvements",
      "Provide written approval guidance before covered work begins",
    ],
  },
  {
    key: "covenants",
    title: "Covenants Review Committee",
    description:
      "Supports the Board by reviewing Plum Creek's governing documents, identifying questions or areas that may need clarification, and making recommendations for Board consideration.",
    responsibilities: [
      "Study the declarations, restrictions, and bylaws",
      "Help organize covenant questions raised by homeowners",
      "Present findings and recommendations to the Board",
    ],
  },
  {
    key: "beautification",
    title: "Beautification Committee",
    description:
      "Encourages a welcoming neighborhood appearance and helps the Board plan community beautification efforts and shared-area improvements.",
    responsibilities: [
      "Recommend neighborhood appearance projects",
      "Help coordinate seasonal or volunteer beautification efforts",
      "Share improvement ideas and project needs with the Board",
    ],
  },
  {
    key: "welcoming",
    title: "Welcoming Committee",
    description:
      "Helps new residents feel at home by introducing them to the neighborhood, HOA resources, important contacts, and opportunities to participate in the community.",
    responsibilities: [
      "Welcome new Plum Creek households",
      "Share helpful HOA and neighborhood information",
      "Encourage connection and community involvement",
    ],
  },
];

export const metadata: Metadata = {
  title: "HOA Committees | Plum Creek",
  description:
    "Learn about Plum Creek HOA committees, their responsibilities, and current members.",
};

function committeeKey(line: string): CommitteeKey | undefined {
  const normalized = line.toLowerCase();

  if (normalized.startsWith("architectural")) return "architectural";
  if (normalized.startsWith("covenants")) return "covenants";
  if (normalized.startsWith("beautification")) return "beautification";
  if (normalized.startsWith("welcoming")) return "welcoming";
}

function getCommitteeMembers(): Record<CommitteeKey, CommitteeMember[]> {
  const source = readFileSync(
    path.join(process.cwd(), "Info", "Commitees.txt"),
    "utf8",
  );
  const members: Record<CommitteeKey, CommitteeMember[]> = {
    architectural: [],
    covenants: [],
    beautification: [],
    welcoming: [],
  };
  let activeCommittee: CommitteeKey | undefined;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = committeeKey(line);
    if (heading) {
      activeCommittee = heading;
      continue;
    }

    if (!activeCommittee || /^2A\./i.test(line)) continue;

    const [name, ...roleParts] = line.split(",").map((part) => part.trim());
    members[activeCommittee].push({
      name,
      role: roleParts.join(" · ") || "Member",
    });
  }

  return members;
}

export default function CommitteesPage() {
  const members = getCommitteeMembers();

  return (
    <main className="inner-page">
      <section className="inner-hero committees-hero">
        <p className="section-kicker">Neighbors working together</p>
        <h1>HOA committees</h1>
        <p>
          Plum Creek committees help the Board serve the neighborhood, review
          community needs, and welcome homeowner participation.
        </p>
      </section>

      <section className="committees-section">
        <div className="committee-appointment-note">
          <span aria-hidden="true">Annual appointments</span>
          <p>
            Committees serve under the direction of the Board of Directors.
            Committee members are appointed or reviewed by the Board and
            renewed each year. The recorded restrictions assign the
            Architectural Control Committee directly to the current Board of
            Directors.
          </p>
        </div>

        <div className="committee-grid">
          {committees.map((committee, index) => (
            <article
              className={`committee-card${
                committee.key === "architectural" ? " committee-card-featured" : ""
              }`}
              key={committee.key}
            >
              <span className="committee-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2>{committee.title}</h2>
              <p>{committee.description}</p>

              <div className="committee-responsibilities">
                <h3>What this committee does</h3>
                <ul>
                  {committee.responsibilities.map((responsibility) => (
                    <li key={responsibility}>{responsibility}</li>
                  ))}
                </ul>
              </div>

              <div className="committee-members">
                <h3>Current membership</h3>
                {committee.key === "architectural" ? (
                  <p className="committee-board-membership">
                    Current Board of Directors · <Link href="/board/">View board</Link>
                  </p>
                ) : members[committee.key].length > 0 ? (
                  <ul>
                    {members[committee.key].map((member) => (
                      <li key={`${member.name}-${member.role}`}>
                        <strong>{member.name}</strong>
                        <span>{member.role}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="committee-open">
                    Membership will be posted when appointments are confirmed.
                  </p>
                )}
              </div>

              {committee.key === "architectural" && (
                <Link className="committee-action" href="/architectural-request/">
                  Submit an approval request <span aria-hidden="true">→</span>
                </Link>
              )}
            </article>
          ))}
        </div>

        <div className="committee-contact-band">
          <div>
            <p className="section-kicker">Get involved</p>
            <h2>Interested in helping?</h2>
          </div>
          <p>
            Contact the Board to ask about committee openings or to share an
            idea for the neighborhood.
          </p>
          <Link href="/committee-volunteer/">Volunteer for a committee</Link>
        </div>
      </section>
    </main>
  );
}
