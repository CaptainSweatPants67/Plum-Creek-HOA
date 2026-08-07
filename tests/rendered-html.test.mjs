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
  const documents = await readFile(
    new URL("../out/documents/index.html", import.meta.url),
    "utf8",
  );
  const neighborhoodMap = await readFile(
    new URL("../out/neighborhood-map/index.html", import.meta.url),
    "utf8",
  );
  const runForBoard = await readFile(
    new URL("../out/run-for-board/index.html", import.meta.url),
    "utf8",
  );
  const contact = await readFile(
    new URL("../out/contact/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /<title>Plum Creek Homeowners Association<\/title>/i);
  assert.match(html, /\/og\.png/);
  assert.match(html, /Explore Plum Creek/);
  assert.match(html, /Gardner, Kansas 66030/);
  assert.doesNotMatch(html, /Rooted in community/);
  assert.match(html, /Neighborhood Map &amp; HOA Tracts/);
  assert.match(html, /Request Architectural Control Committee approval/);
  assert.match(html, /architectural-request/);
  assert.match(html, /neighborhood-map/);
  assert.match(html, /documents/);
  assert.match(html, /pchoa66030@gmail\.com/);
  assert.match(html, /href="\/contact\//);
  assert.match(html, /Contact Michael Bruna with website issues/);
  assert.match(html, /su=Webmaster%20Site%20Issue/);
  assert.match(html, /Copy HOA email/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);

  assert.match(board, /2025–2026 roster/);
  assert.match(board, /roster/);
  assert.match(board, /Laura McKinney/);
  assert.match(board, /Michael Bruna/);
  assert.match(board, /Lori Whitson/);
  assert.match(board, /Charity Coker/);
  assert.match(board, /Vacant/);
  assert.match(board, /Seat 2024–2026/);
  assert.match(board, /Seat 2025–2027/);
  assert.match(board, /Seat Open 2026/);
  assert.match(board, /Five elected seats/);
  assert.match(board, /Two or three seats are voted on each year/);
  assert.match(board, /appoints the President/);
  assert.match(board, /href="\/events\//);
  assert.match(board, /href="\/run-for-board\//);
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
  assert.match(architecturalRequest, /Prepare request in Gmail/);
  assert.match(architecturalRequest, /Copy HOA email/);
  assert.match(architecturalRequest, /mail\.google\.com/);
  assert.match(architecturalRequest, /pchoa66030@gmail\.com/);
  assert.match(architecturalRequest, /declaration-of-restrictions\.pdf/);

  assert.match(committeeVolunteer, /Volunteer for a committee/);
  assert.match(committeeVolunteer, /Committee preference/);
  assert.match(committeeVolunteer, /Preferred way to help/);
  assert.match(committeeVolunteer, /Prepare volunteer email in Gmail/);
  assert.match(committeeVolunteer, /Copy HOA email/);
  assert.match(committeeVolunteer, /pchoa66030@gmail\.com/);

  assert.match(documents, /HOA documents/);
  assert.match(documents, /Declaration of Restrictions/);
  assert.match(documents, /plum-creek-bylaws\.pdf/);
  assert.match(documents, /supplemental-ratifying-declarations\.pdf/);
  assert.match(documents, /plat-map-3\.pdf/);

  assert.match(neighborhoodMap, /HOA-owned tracts/);
  assert.match(neighborhoodMap, /owned by the Plum Creek HOA/i);
  assert.match(neighborhoodMap, /hired contractors/i);
  assert.match(neighborhoodMap, /volunteer homeowners/i);
  assert.match(neighborhoodMap, /Tract A/);
  assert.match(neighborhoodMap, /Tract H/);
  assert.match(neighborhoodMap, /tract-a-big-pond\.jpg/);
  assert.match(neighborhoodMap, /tract-h-juniper-north\.jpg/);
  assert.match(neighborhoodMap, /1Kd_etC9UrcOeFTQBGiv3cUlh5d2TUSU/);

  assert.match(runForBoard, /Run for the Board/);
  assert.match(runForBoard, /five elected Board members/i);
  assert.match(runForBoard, /Officer position of interest/);
  assert.match(runForBoard, /President/);
  assert.match(runForBoard, /Vice President/);
  assert.match(runForBoard, /Secretary/);
  assert.match(runForBoard, /Treasurer/);
  assert.match(runForBoard, /Member/);
  assert.match(runForBoard, /Prepare Board interest email in Gmail/);
  assert.match(runForBoard, /Copy HOA email/);
  assert.match(runForBoard, /pchoa66030@gmail\.com/);

  assert.match(contact, /Contact the HOA/);
  assert.match(contact, /Open in Gmail/);
  assert.match(contact, /Copy email address/);
  assert.match(contact, /Use desktop email app/);
  assert.match(contact, /mail\.google\.com/);
  assert.match(contact, /pchoa66030@gmail\.com/);
  assert.match(contact, /does not collect or store your message/);
});
