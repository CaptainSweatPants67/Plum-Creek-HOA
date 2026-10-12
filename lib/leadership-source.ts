import { currentBoardSource, positionCodes, type LeadershipRoster } from "./leadership-types";

// Public fallback contains current appointments only. Historical names are fetched
// by the authenticated member API and never embedded in the static site export.
export function getSavedLeadershipRoster(): LeadershipRoster {
  const board: LeadershipRoster["board"] = currentBoardSource.map((member, index) => ({
    id: `current-${index}`, person_id: member.name === "Vacant" ? null : `source-${member.name}`,
    name: member.name, year: 2026, term: member.term, position: member.position,
    kind: member.name === "Vacant" ? "vacant" as const : "director" as const,
  }));
  const officers: LeadershipRoster["officers"] = [];
  for (const [position, code] of Object.entries(positionCodes)) {
    const member = currentBoardSource.find((item) => item.position === position);
    officers.push({ id: `officer-current-${code}`, person_id: member ? `source-${member.name}` : null,
      name: member?.name ?? "Vacant", year: 2026, position, position_code: code });
  }
  return { board, officers };
}
