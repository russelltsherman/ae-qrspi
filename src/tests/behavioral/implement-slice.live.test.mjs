// L1 behavioral — the Implement phase builds ONE slice: it edits code AND logs the checkpoint.
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "golden", "implement.json"), "utf8"));
const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();
const SLUG = "add-csv-export";

const seed = (name) => readFileSync(join(HERE, "fixtures", `${SLUG}.${name}.md`), "utf8");

test("L1 implement: slice 1 edits code and logs the checkpoint", { skip: SKIP }, () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: SLUG,
    seedThrough: "worktree",
    files: {
      "ticket.md": seed("ticket"),
      "questions.md": seed("questions"),
      "research.md": seed("research"),
      "design.md": seed("design"),
      "structure.md": seed("structure"),
      "plan.md": seed("plan"),
      "worktree.md": seed("worktree"),
    },
  });

  // Build only slice 1 (the `toCSV` function + its unit test).
  runPrompt(cwd, `/qrspi-implement ${SLUG} 1`);

  // 1) Code was edited: src/reports.js gains the toCSV function the structure specified.
  const reports = readFileSync(join(cwd, "src", "reports.js"), "utf8");
  assert.match(reports, /toCSV/, "slice 1 adds toCSV to src/reports.js");

  // 2) A test for the slice was added: some file whose name marks it a test references toCSV (the
  //    checkpoint exercises it). Walk the repo, skipping the artifact + dependency dirs.
  const found = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".qrspi" || e.name.startsWith(".")) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.test\.|(^|\/)test/i.test(e.name)) found.push(p);
    }
  };
  walk(cwd);
  const testReferencesToCSV = found.some((p) => /toCSV/.test(readFileSync(p, "utf8")));
  assert.ok(testReferencesToCSV, "slice 1 adds a test that exercises toCSV");

  // 3) implement.md logs the slice + its checkpoint.
  const log = readArtifact(featureDir, "implement.md");
  assert.ok(log, "implement.md was created");
  for (const section of golden.requiredSections) {
    assert.ok(log.includes(section), `implement.md must contain "${section}"`);
  }
  assert.match(log, /slice\s*1/i, "implement.md logs slice 1");
  assert.match(log, /checkpoint/i, "implement.md records the checkpoint");

  // 4) state.json tracks the slice just built.
  const state = JSON.parse(readFileSync(join(featureDir, "state.json"), "utf8"));
  assert.equal(state.currentSlice, "1", "state.currentSlice records the built slice");
  assert.equal(state.phases.implement.status, "produced", "implement recorded as produced");
});
