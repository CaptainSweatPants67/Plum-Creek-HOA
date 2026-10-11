import { readFile, writeFile } from "node:fs/promises";

// Only the existing public Board.txt and public current-roster JSON are inputs.
const history = (await readFile(new URL("../Info/Board.txt", import.meta.url), "utf8"))
  .split(/\r?\n/).slice(1).map((line) => line.split("\t").map((v) => v.trim()))
  .filter(([year, name, position]) => year && name && position && Number.isFinite(Number(year)));
const current = JSON.parse(await readFile(new URL("../Info/Leadership2026.json", import.meta.url), "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const personKey = (name) => `public-roster:${name}`;
const person = (name) => name === "Vacant" ? "null" : `(select id from public.leadership_people where source_key=${quote(personKey(name))})`;
const names = [...new Set([...history.map((r) => r[1]), ...current.map((r) => r.name)].filter((n) => n !== "Vacant"))];
const codes = { President: "president", "Vice President": "vice_president", Secretary: "secretary", Treasurer: "treasurer" };
const statements = ["-- Public roster seed only. Historical listings never verify an account or enable privileges.",
  "insert into public.leadership_people(display_name,source_key) values\n" + names.map((name) => `(${quote(name)},${quote(personKey(name))})`).join(",\n") + "\non conflict(source_key) do nothing;",
  "insert into public.board_member_years(person_id,service_year,seat_label,recorded_position,record_kind,published,source,source_key) values\n" + [
    ...history.map(([year, name, title], i) => `(${person(name)},${Number(year)},'Historical roster entry',${quote(title)},'historical',true,'Info/Board.txt',${quote(`history-board:${i}`)})`),
    ...current.map((row, i) => `(${person(row.name)},2026,${quote(row.term)},${quote(row.position)},${quote(row.name === "Vacant" ? "vacant" : "director")},true,'Info/Leadership2026.json',${quote(`current-board:2026:${i}`)})`),
  ].join(",\n") + "\non conflict(source_key) do nothing;",
  "insert into public.officer_member_years(person_id,position_code,service_year,published,source,source_key) values\n" + [
    ...history.flatMap(([year, name, title], i) => codes[title] ? [`(${person(name)},${quote(codes[title])},${Number(year)},true,'Info/Board.txt',${quote(`history-officer:${i}`)})`] : []),
    ...Object.entries(codes).map(([title, code]) => {
      const member = current.find((row) => row.position === title);
      return `(${person(member?.name ?? "Vacant")},${quote(code)},2026,true,'Info/Leadership2026.json',${quote(`current-officer:2026:${code}`)})`;
    }),
  ].join(",\n") + "\non conflict(source_key) do nothing;",
];
const destination = process.argv[2];
if (!destination || !/^supabase[\\/]migrations[\\/]\d+_public_leadership_roster_seed\.sql$/.test(destination)) throw new Error("Supply the CLI-generated public_leadership_roster_seed migration path.");
await writeFile(destination, statements.join("\n\n") + "\n");
console.log(`Generated public roster seed: ${history.length} historical rows, ${current.length} current Board seats, 4 current Officer positions.`);
