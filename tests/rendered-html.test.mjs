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
});
