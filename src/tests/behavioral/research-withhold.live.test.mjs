// L1 behavioral — THE withhold invariant (the firewall against the plan-reading illusion).
// The ticket is seeded with a CANARY token and a distinctive phrase that exist ONLY in ticket.md —
// not in the hand-written questions.md and not in the fixture source. We run /qrspi-research (which
// must dispatch the researcher with questions.md only) and assert the ticket did NOT leak into
// research.md. If it did, the researcher saw the ticket — the firewall is broken.
//
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";
import { CANARY, containsCanary, leakedPhrases } from "../lib/withhold-scan.mjs";

const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();
const SLUG = "add-csv-export";

// Ticket carries the canary + a distinctive phrase. The researcher must never see any of this.
const TICKET = `# ${SLUG} — ticket

## Request
Add CSV export to the reports page. Internal codename ${CANARY}: the sapphire ledger teleport workflow.

## Intent
Let users download report data as a spreadsheet-friendly file.

## Out of scope
none stated
`;

// Questions are written by hand to be ticket-free: factual, source-pointing, no canary, no
// "sapphire ledger teleport" phrase. This is what the researcher is legitimately allowed to see.
const QUESTIONS = `# ${SLUG} — questions

## Questions
1. Where are report rows assembled, and what is the shape of each row?
2. How is a report currently rendered for the user, and in what format?
3. What columns/fields exist on a report row today?
4. Are there existing tests covering the reporting code, and what do they assert?
`;

test("L1 research: the ticket never leaks into the ticket-blind researcher's output", { skip: SKIP }, () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: SLUG,
    seedThrough: "questions", // ticket approved, questions produced => research is runnable
    files: { "ticket.md": TICKET, "questions.md": QUESTIONS },
  });

  runPrompt(cwd, `/qrspi-research ${SLUG}`);

  const research = readArtifact(featureDir, "research.md");
  assert.ok(research, "research.md was created");

  // The core assertion: no canary, no distinctive ticket phrase in the researcher's output.
  assert.equal(containsCanary(research), false, "CANARY leaked into research.md — ticket withhold broken");
  assert.deepEqual(
    leakedPhrases(research, TICKET, { minWords: 4 }),
    [],
    "a distinctive ticket phrase leaked into research.md — ticket withhold broken",
  );
});
