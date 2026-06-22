// Unit tests for the deterministic withhold leak detector (free; no model calls).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CANARY, containsCanary, tokenize, leakedPhrases, ticketLeaked } from "../lib/withhold-scan.mjs";

test("containsCanary detects the canary verbatim", () => {
  assert.equal(containsCanary(`...the ${CANARY} feature...`), true);
});

test("containsCanary tolerates case and separator changes", () => {
  assert.equal(containsCanary("qrspi withhold canary 7731"), true);
  assert.equal(containsCanary("QRSPIWITHHOLDCANARY7731"), true);
});

test("containsCanary is false when the canary is absent", () => {
  assert.equal(containsCanary("a perfectly ordinary research finding"), false);
  assert.equal(containsCanary(""), false);
});

test("tokenize drops short tokens and lowercases", () => {
  assert.deepEqual(tokenize("Add CSV Export to X"), ["add", "csv", "export"]);
});

test("leakedPhrases finds a distinctive multi-word phrase copied from the ticket", () => {
  const ticket = "Export the quarterly revenue ledger to an encrypted archive";
  const suspect = "The code can export the quarterly revenue ledger to disk.";
  const leaks = leakedPhrases(suspect, ticket, { minWords: 4 });
  assert.ok(leaks.length >= 1, `expected a leaked phrase, got ${JSON.stringify(leaks)}`);
});

test("leakedPhrases ignores incidental stopword overlap", () => {
  const ticket = "We should add this to the page for the users";
  const suspect = "The reports are rendered to the page by the server.";
  assert.deepEqual(leakedPhrases(suspect, ticket, { minWords: 4 }), []);
});

test("leakedPhrases returns nothing when the researcher stayed factual", () => {
  const ticket = "Add CSV export to the reports page so users can open data in a spreadsheet";
  const suspect =
    "buildReport assembles rows in src/reports.js:18; renderTable formats them at src/reports.js:24.";
  assert.deepEqual(leakedPhrases(suspect, ticket), []);
});

test("ticketLeaked flags either a canary or a phrase leak", () => {
  const ticket = `Add ${CANARY} secret export to the encrypted revenue ledger`;
  assert.equal(ticketLeaked("contains QRSPI-WITHHOLD-CANARY-7731 somewhere", ticket), true);
  assert.equal(ticketLeaked("export to the encrypted revenue ledger now", ticket, { minWords: 4 }), true);
  assert.equal(ticketLeaked("buildReport assembles rows at src/reports.js:18", ticket), false);
});
