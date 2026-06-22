// L1 behavioral — the Structure phase emits a real vertical-slice table with checkpoints.
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "golden", "structure.json"), "utf8"));
const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();
const SLUG = "add-csv-export";

const seed = (name) => readFileSync(join(HERE, "fixtures", `${SLUG}.${name}.md`), "utf8");

test("L1 structure: produces a vertical-slice table with checkpoints", { skip: SKIP }, () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: SLUG,
    seedThrough: "design",
    files: {
      "ticket.md": seed("ticket"),
      "questions.md": seed("questions"),
      "research.md": seed("research"),
      "design.md": seed("design"),
    },
  });

  runPrompt(cwd, `/qrspi-structure ${SLUG}`);

  const structure = readArtifact(featureDir, "structure.md");
  assert.ok(structure, "structure.md was created");
  for (const section of golden.requiredSections) {
    assert.ok(structure.includes(section), `structure.md must contain "${section}"`);
  }
  // The slice table must declare every required column.
  for (const col of golden.sliceTableColumns) {
    assert.match(structure, new RegExp(`\\b${col}\\b`, "i"), `slice table must have a '${col}' column`);
  }
  // At least one actual slice row (a table data row under the Vertical slices heading).
  const slicesBlock = structure.split("## Vertical slices")[1] ?? "";
  const dataRows = slicesBlock
    .split("\n")
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s|:-]+\|?\s*$/.test(l)); // pipe rows that aren't the header/separator
  assert.ok(dataRows.length >= 2, "expected a header plus at least one slice row in the table");
});
