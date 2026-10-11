import currentBoard from "../Info/Leadership2026.json";

export type BoardYear = {
  id: string;
  person_id: string | null;
  name: string;
  year: number;
  term: string;
  position: string;
  kind: "director" | "historical" | "vacant";
};
export type OfficerYear = {
  id: string;
  person_id: string | null;
  name: string;
  year: number;
  position: string;
  position_code: string;
};
export type LeadershipRoster = { board: BoardYear[]; officers: OfficerYear[] };

export const currentBoardSource = currentBoard;

export const positionCodes: Record<string, string> = {
  President: "president", "Vice President": "vice_president", Secretary: "secretary", Treasurer: "treasurer",
};
