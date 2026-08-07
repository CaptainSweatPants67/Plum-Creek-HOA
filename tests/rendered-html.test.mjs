import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exports the Plum Creek community pages", async () => {
  const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");
  const board = await readFile(
    new URL("../out/board/index.html", import.meta.url),
    "utf8",
  );
  const events = await readFile(
    new URL("../out/events/index.html", import.meta.url),
    "utf8",
  );
  const committees = await readFile(
    new URL("../out/committees/index.html", import.meta.url),
    "utf8",
  );
  const architecturalRequest = await readFile(
    new URL("../out/architectural-request/index.html", import.meta.url),
    "utf8",
  );
  const committeeVolunteer = await readFile(
    new URL("../out/committee-volunteer/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /<title>Plum Creek Homeowners Association<\/title>/i);
  assert.match(html, /\/og\.png/);
  assert.match(html, /HOA documents/);
  assert.match(html, /Declaration of Restrictions/);
  assert.match(html, /plum-creek-bylaws\.pdf/);
  assert.match(html, /pchoa66030@gmail\.com/);
  assert.match(html, /1Kd_etC9UrcOeFTQBGiv3cUlh5d2TUSU/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);

  assert.match(board, /2025/);
  assert.match(board, /roster/);
  assert.match(board, /Laura McKinney/);
  assert.match(board, /Michael Bruna/);
  assert.match(board, /Board history/);

  assert.match(events, /Upcoming dates/);
  assert.match(events, /Annual Meeting/);
  assert.match(events, /Friday, October 9, 2026/);
  assert.match(events, /6:30 PM/);
  assert.match(events, /Gardner Senior Center/);
  assert.match(events, /128 E Park St, Gardner, KS 66030/);
  assert.match(events, /Open in Google Maps/);
  assert.match(events, /google\.com\/maps\?q=128%20E%20Park%20St%2C%20Gardner%2C%20KS%2066030/);

  assert.match(committees, /Architectural Control Committee/);
  assert.match(committees, /Covenants Review Committee/);
  assert.match(committees, /Beautification Committee/);
  assert.match(committees, /Welcoming Committee/);
  assert.match(committees, /appointed/i);
  assert.match(committees, /renewed each year/i);
  assert.match(committees, /Michael Bruna/);
  assert.match(committees, /Andrew Benedict-Nelson/);
  assert.match(committees, /architectural-request/);
  assert.match(committees, /committee-volunteer/);

  assert.match(architecturalRequest, /Architectural approval request/);
  assert.match(architecturalRequest, /Plum Creek property address/);
  assert.match(architecturalRequest, /Project type/);
  assert.match(architecturalRequest, /Prepare email to the HOA/);
  assert.match(architecturalRequest, /pchoa66030@gmail\.com/);
  assert.match(architecturalRequest, /declaration-of-restrictions\.pdf/);

  assert.match(committeeVolunteer, /Volunteer for a committee/);
  assert.match(committeeVolunteer, /Committee preference/);
  assert.match(committeeVolunteer, /Preferred way to help/);
  assert.match(committeeVolunteer, /Prepare volunteer email/);
  assert.match(committeeVolunteer, /pchoa66030@gmail\.com/);
});
