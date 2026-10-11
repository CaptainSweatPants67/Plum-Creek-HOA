import { readFileSync } from "node:fs";
import path from "node:path";
import { currentBoardSource, positionCodes, type LeadershipRoster } from "./leadership-types";

// Public roster source only. Never read homeowner contact imports here.
export function getSavedLeadershipRoster(): LeadershipRoster {
  const historical = readFileSync(path.join(process.cwd(), "Info", "Board.txt"), "utf8")
    .split(/\r?\n/).slice(1).map((line) => line.split("\t").map((v) => v.trim()))
    .filter(([year, name, position]) => year && name && position && Number.isFinite(Number(year)));
  const board: LeadershipRoster["board"] = historical.map(([year, name, position], index) => ({
    id: `history-${index}`, person_id: `source-${name}`, name, year: Number(year), term: "Historical roster entry", position, kind: "historical",
  }));
  board.push(...currentBoardSource.map((member, index) => ({
    id: `current-${index}`, person_id: member.name === "Vacant" ? null : `source-${member.name}`,
    name: member.name, year: 2026, term: member.term, position: member.position,
    kind: member.name === "Vacant" ? "vacant" as const : "director" as const,
  })));
  const officers: LeadershipRoster["officers"] = historical.filter(([, , position]) => positionCodes[position])
    .map(([year, name, position], index) => ({
      id: `officer-history-${index}`, person_id: `source-${name}`, name, year: Number(year), position, position_code: positionCodes[position],
    }));
  for (const [position, code] of Object.entries(positionCodes)) {
    const member = currentBoardSource.find((item) => item.position === position);
    officers.push({ id: `officer-current-${code}`, person_id: member ? `source-${member.name}` : null,
      name: member?.name ?? "Vacant", year: 2026, position, position_code: code });
  }
  return { board, officers };
}
