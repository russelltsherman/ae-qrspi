// Verify the L1 harness PLUMBING deterministically (free): the temp-repo builder copies the
// fixture and seeds state to the exact pre-state for the next phase. The token-spending claude
// invocation is exercised only by the gated *.live tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "../lib/headless.mjs";

test("makeTempRepo copies the fixture app", () => {
  const { cwd } = makeTempRepo({ slug: null });
  try {
    assert.ok(existsSync(join(cwd, "src", "reports.js")), "fixture source copied");
    assert.ok(existsSync(join(cwd, "package.json")), "fixture manifest copied");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("makeTempRepo seeds artifacts and state to the next-phase pre-state", () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: "add-csv-export",
    seedThrough: "questions",
    files: {
      "ticket.md": "# add-csv-export — ticket\n## Request\nx\n## Intent\nx\n## Out of scope\nnone stated\n",
      "questions.md": "# add-csv-export — questions\n## Questions\n1. Where are rows built?\n",
    },
  });
  try {
    const state = JSON.parse(readFileSync(join(featureDir, "state.json"), "utf8"));
    // Seeded "through questions" => ticket approved, questions produced, research still pending.
    assert.equal(state.phases.ticket.status, "approved");
    assert.equal(state.phases.questions.status, "produced");
    assert.equal(state.phases.research.status, "pending");
    assert.ok(existsSync(join(featureDir, "ticket.md")), "ticket artifact seeded");
    assert.ok(existsSync(join(featureDir, "questions.md")), "questions artifact seeded");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
