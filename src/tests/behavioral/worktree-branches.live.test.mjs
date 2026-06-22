// L1 behavioral — the WorkTree phase maps every slice to an independently testable branch.
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "golden", "worktree.json"), "utf8"));
const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();
const SLUG = "add-csv-export";

const seed = (name) => readFileSync(join(HERE, "fixtures", `${SLUG}.${name}.md`), "utf8");

test("L1 worktree: maps each slice to a branch", { skip: SKIP }, () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: SLUG,
    seedThrough: "plan",
    files: {
      "ticket.md": seed("ticket"),
      "questions.md": seed("questions"),
      "research.md": seed("research"),
      "design.md": seed("design"),
      "structure.md": seed("structure"),
      "plan.md": seed("plan"),
    },
  });

  runPrompt(cwd, `/qrspi-worktree ${SLUG}`);

  const worktree = readArtifact(featureDir, "worktree.md");
  assert.ok(worktree, "worktree.md was created");
  for (const section of golden.requiredSections) {
    assert.ok(worktree.includes(section), `worktree.md must contain "${section}"`);
  }
  // The seeded structure/plan have slices 1 and 2; both must be mapped to branches.
  const branchesBlock = worktree.split("## Branches")[1] ?? "";
  assert.match(branchesBlock, /slice\s*1/i, "slice 1 mapped to a branch");
  assert.match(branchesBlock, /slice\s*2/i, "slice 2 mapped to a branch");
  assert.match(branchesBlock, /branch|csv/i, "branch names present");
});
