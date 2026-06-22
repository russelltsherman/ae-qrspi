// L1 behavioral — the no-magic-words invariant. A bare ticket with zero special phrasing (no
// "discuss first", no incantation) must still yield a real design discussion: a design.md with the
// reasoning sections filled in. The correct alignment behavior is the agent's DEFAULT, not something
// the user must request.
//
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "golden", "design.json"), "utf8"));
const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();
const SLUG = "add-csv-export";

// Deliberately plain. No magic words, no "please discuss", no methodology hints.
const TICKET = `# ${SLUG} — ticket

## Request
Add CSV export to the reports page.

## Intent
Let users open report data in a spreadsheet.

## Out of scope
none stated
`;

const QUESTIONS = `# ${SLUG} — questions

## Questions
1. Where are report rows assembled and rendered?
2. What columns exist on a row?
`;

const RESEARCH = `# ${SLUG} — research

## Findings
1. \`buildReport()\` assembles fixed rows and returns \`{ columns, rows }\` — src/reports.js:14.
2. \`renderTable()\` formats a report as a fixed-width text table — src/reports.js:21.
3. Columns are \`id\`, \`name\`, \`total\` — src/reports.js:3.
4. The reports page returns the rendered table as HTML at GET /reports — src/server.js:7.

## Open questions
- No automated tests cover the reporting code [UNKNOWN].
`;

test("L1 design: a bare ticket still produces a real design discussion", { skip: SKIP }, () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: SLUG,
    seedThrough: "research", // ticket+questions approved, research produced => design is runnable
    files: { "ticket.md": TICKET, "questions.md": QUESTIONS, "research.md": RESEARCH },
  });

  runPrompt(cwd, `/qrspi-design ${SLUG}`);

  const design = readArtifact(featureDir, "design.md");
  assert.ok(design, "design.md was created");
  for (const section of golden.requiredSections) {
    assert.ok(design.includes(section), `design.md must contain "${section}" (the discussion happened by default)`);
  }
  // The decisions section should carry actual reasoning, not be an empty heading.
  const decisionsBody = design.split("## Design decisions")[1] ?? "";
  assert.ok(decisionsBody.trim().length > 80, "design.md must record actual design decisions, not an empty section");
});
