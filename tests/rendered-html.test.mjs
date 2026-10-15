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
  const dues = await readFile(
    new URL("../out/dues/index.html", import.meta.url),
    "utf8",
  );
  const reportConcern = await readFile(
    new URL("../out/report-concern/index.html", import.meta.url),
    "utf8",
  );
  const homes = await readFile(
    new URL("../out/homes/index.html", import.meta.url),
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
  assert.match(html, /href="\/dues\//);
  assert.match(html, /Pay Your Dues/);
  assert.match(html, /href="\/report-concern\//);
  assert.match(html, /Report an issue or concern/);
  assert.match(html, /href="\/homes\//);
  assert.match(html, /Homes Within the HOA/);
  assert.match(html, /Contact Michael Bruna with website issues/);
  assert.match(html, /su=Webmaster%20Site%20Issue/);
  assert.match(html, /Copy HOA email/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);

  assert.match(board, /2026.*roster on file/);
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
  assert.doesNotMatch(board, /Board history|Historical roster entry|history-\d/);
  assert.match(board, /href="\/officers\//);
  const officers = await readFile(new URL("../out/officers/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(officers, /Officer history|officer-history-/);
  assert.match(officers, /President/);
  assert.match(officers, /Michael Bruna/);
  const portal = await readFile(new URL("../out/portal/index.html", import.meta.url), "utf8");
  assert.match(portal, /Homeowner portal/i);
  assert.match(portal, /Homeowner portal/);
  const resetPassword = await readFile(new URL("../out/portal/reset-password/index.html", import.meta.url), "utf8");
  assert.match(resetPassword, /Reset your password/);
  assert.match(resetPassword, /noindex, nofollow/);
  assert.doesNotMatch(portal, /portal_bootstrap_admin|activated_user_id|private\.signup_passcode/);
  const members = await readFile(new URL("../out/members/index.html", import.meta.url), "utf8");
  const admin = await readFile(new URL("../out/admin/index.html", import.meta.url), "utf8");
  assert.match(members, /My information and properties/);
  assert.match(admin, /HOA administration/);
  const leadership = await readFile(new URL("../out/leadership/index.html", import.meta.url), "utf8");
  const memberDocuments = await readFile(new URL("../out/member-documents/index.html", import.meta.url), "utf8");
  assert.match(leadership, /Officer &amp; Director workspace/);
  assert.match(leadership, /noindex, nofollow/);
  assert.match(memberDocuments, /Member library/);
  assert.match(memberDocuments, /noindex, nofollow/);
  assert.doesNotMatch(leadership, /Private notes|service_contacts.*email|storage_path/);
  assert.match(members, /noindex, nofollow/);
  assert.match(admin, /noindex, nofollow/);
  assert.doesNotMatch(admin, /portal_bootstrap_admin|activated_user_id|private\.signup_passcode/);

  assert.match(events, /Upcoming dates/);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (today <= "2026-10-09") {
    assert.match(events, /Annual Meeting/);
    assert.match(events, /Friday, October 9, 2026/);
    assert.match(events, /Gardner Senior Center/);
    assert.match(events, /Open in Google Maps/);
  } else {
    assert.doesNotMatch(events, /Friday, October 9, 2026/);
  }

  assert.match(committees, /Loading committee directory/);
  assert.match(committees, /appointed/i);
  assert.match(committees, /renewed each year/i);
  assert.doesNotMatch(committees, /Andrew Benedict-Nelson|Harvey Sime/);
  assert.match(committees, /committee-volunteer/);

  assert.match(architecturalRequest, /Architectural approval request/);
  assert.match(architecturalRequest, /Plum Creek property address/);
  assert.match(architecturalRequest, /Project type/);
  assert.match(architecturalRequest, /Prepare request in your email app/);
  assert.match(architecturalRequest, /Open in Gmail/);
  assert.match(architecturalRequest, /Copy HOA email/);
  assert.match(architecturalRequest, /mail\.google\.com/);
  assert.match(architecturalRequest, /pchoa66030@gmail\.com/);
  assert.match(architecturalRequest, /declaration-of-restrictions\.pdf/);

  assert.match(committeeVolunteer, /Volunteer for a committee/);
  assert.match(committeeVolunteer, /Committee preference/);
  assert.match(committeeVolunteer, /Preferred way to help/);
  assert.match(committeeVolunteer, /Prepare volunteer email/);
  assert.match(committeeVolunteer, /Open in Gmail/);
  assert.match(committeeVolunteer, /Copy HOA email/);
  assert.match(committeeVolunteer, /pchoa66030@gmail\.com/);

  assert.match(documents, /HOA documents/);
  assert.match(documents, /Declaration of Restrictions/);
  assert.doesNotMatch(documents, /plum-creek-bylaws\.pdf/);
  await assert.rejects(readFile(new URL('../out/documents/plum-creek-bylaws.pdf',import.meta.url)), /ENOENT/);
  assert.match(documents, /supplemental-ratifying-declarations\.pdf/);
  assert.match(documents, /plat-map-3\.pdf/);

  assert.match(neighborhoodMap, /HOA-owned tracts/);
  assert.match(neighborhoodMap, /owned by the Plum Creek HOA/i);
  assert.match(neighborhoodMap, /hired contractors/i);
  assert.match(neighborhoodMap, /volunteer homeowners/i);
  assert.match(neighborhoodMap, /5\.78/);
  assert.match(neighborhoodMap, /251,707\.24 square feet/);
  assert.match(neighborhoodMap, /8/);
  assert.match(neighborhoodMap, /3/);
  assert.match(neighborhoodMap, /Neighborhood ponds/);
  assert.match(neighborhoodMap, /Community playground/);
  assert.match(neighborhoodMap, /Green space/);
  assert.match(neighborhoodMap, /Fishing is allowed in the HOA ponds/);
  assert.match(neighborhoodMap, /homeowners and their family members only/);
  assert.match(neighborhoodMap, /catch-and-release only/);
  assert.match(neighborhoodMap, /Plum Creek Estates/);
  assert.match(neighborhoodMap, /Plum Creek Manor/);
  assert.match(neighborhoodMap, /are not part of Plum Creek HOA/);
  assert.match(neighborhoodMap, /do not have access to Plum Creek HOA parks or ponds/);
  assert.match(neighborhoodMap, /Tract A/);
  assert.match(neighborhoodMap, /3\.47 acres/);
  assert.match(neighborhoodMap, /1\.39 acres/);
  assert.match(neighborhoodMap, /0\.63 acres/);
  assert.match(neighborhoodMap, /225 E Pawnee LN/);
  assert.match(neighborhoodMap, /125 E Pawnee LN/);
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
  assert.match(runForBoard, /Prepare Board interest email/);
  assert.match(runForBoard, /Open in Gmail/);
  assert.match(runForBoard, /Copy HOA email/);
  assert.match(runForBoard, /pchoa66030@gmail\.com/);

  assert.match(contact, /Contact the HOA/);
  assert.match(contact, /Open your email app/);
  assert.match(contact, /Open in Gmail/);
  assert.match(contact, /Copy email address/);
  assert.match(contact, /mailto:pchoa66030@gmail\.com/);
  assert.match(contact, /mail\.google\.com/);
  assert.match(contact, /pchoa66030@gmail\.com/);
  assert.match(contact, /does not collect or store your message/);

  assert.match(dues, /Pay your HOA dues/);
  assert.match(dues, /2026 dues/);
  assert.match(dues, /\$260\.00/);
  assert.match(dues, /\$265\.14/);
  assert.match(dues, /\$290\.00/);
  assert.match(dues, /\$30 late fee/);
  assert.match(dues, /P\.O\. Box 14/);
  assert.match(dues, /Gardner, KS 66030/);
  assert.match(dues, /pchoa66030@gmail\.com/);
  assert.match(dues, /Include your name and property address/);
  assert.match(dues, /May 1, 2026/);
  assert.match(dues, /considered late/);
  assert.match(dues, /January 1, 2027/);
  assert.match(dues, /set by the Board each year/);
  assert.match(dues, /href="\/events\//);
  assert.match(dues, /What your dues support/);
  assert.match(dues, /Land &amp; green spaces/);
  assert.match(dues, /Mowing and routine upkeep/);
  assert.match(dues, /Pond maintenance/);
  assert.match(dues, /three HOA-owned ponds/);
  assert.match(dues, /Insurance/);
  assert.match(dues, /Administrative fees/);
  assert.match(dues, /href="\/neighborhood-map\//);

  assert.match(reportConcern, /Report an issue or concern/);
  assert.match(reportConcern, /General concern/);
  assert.match(reportConcern, /Possible covenants violation/);
  assert.match(reportConcern, /Other issue/);
  assert.match(reportConcern, /Issue location or address/);
  assert.match(reportConcern, /Date observed/);
  assert.match(reportConcern, /Describe the issue or concern/);
  assert.match(reportConcern, /Prepare concern email/);
  assert.match(reportConcern, /Open in Gmail/);
  assert.match(reportConcern, /Copy HOA email/);
  assert.match(reportConcern, /does not guarantee a specific response/);
  assert.match(reportConcern, /href="\/documents\//);

  assert.match(homes, /Homes within Plum Creek HOA/);
  assert.match(homes, /currently within the boundaries of Plum Creek HOA/);
  assert.match(homes, /119/);
  assert.equal([...homes.matchAll(/class="home-address-item"/g)].length, 119);
  assert.match(homes, /Search the HOA home list/);
  assert.match(homes, /real estate professionals/);
  assert.match(homes, /title companies/);
  assert.match(homes, /Zillow value snapshot/);
  assert.match(homes, /\$403,680/);
  assert.match(homes, /106 of 119/);
  assert.match(homes, /\$402,700/);
  assert.match(homes, /Thirteen homes did not return/);
  assert.match(homes, /not an appraisal/);
  assert.match(homes, /not used by the HOA to set dues/);
  assert.match(homes, /zillow\.com\/zestimate/);
  assert.match(homes, /101 Cherry Hills Circle, Gardner, KS 66030/);
  assert.match(homes, /650 South Juniper Street, Gardner, KS 66030/);
  assert.match(homes, /720 South Spruce Street, Gardner, KS 66030/);
  assert.match(homes, /785 South Elm Street, Gardner, KS 66030/);
  assert.match(homes, /891 South Sycamore Street, Gardner, KS 66030/);
  assert.match(homes, /719 South Spruce Circle, Gardner, KS 66030/);
  assert.match(homes, /href="\/neighborhood-map\//);
  assert.match(homes, /href="\/contact\//);
});
