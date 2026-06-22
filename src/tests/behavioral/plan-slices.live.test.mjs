// L1 behavioral — the Plan phase ties every tactical step to a slice from the structure.
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "golden", "plan.json"), "utf8"));
const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();
const SLUG = "add-csv-export";

const seed = (name) => readFileSync(join(HERE, "fixtures", `${SLUG}.${name}.md`), "utf8");

test("L1 plan: produces slice-tagged tactical steps", { skip: SKIP }, () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: SLUG,
    seedThrough: "structure",
    files: {
      "ticket.md": seed("ticket"),
      "questions.md": seed("questions"),
      "research.md": seed("research"),
      "design.md": seed("design"),
      "structure.md": seed("structure"),
    },
  });

  runPrompt(cwd, `/qrspi-plan ${SLUG}`);

  const plan = readArtifact(featureDir, "plan.md");
  assert.ok(plan, "plan.md was created");
  for (const section of golden.requiredSections) {
    assert.ok(plan.includes(section), `plan.md must contain "${section}"`);
  }
  // Every plan must reference its slices; the seeded structure has slices 1 and 2.
  assert.match(plan, /slice/i, "plan steps must reference slices");
  const stepsBlock = plan.split("## Steps")[1] ?? "";
  assert.match(stepsBlock, /slice\s*1/i, "steps should tag slice 1");
  assert.match(stepsBlock, /slice\s*2/i, "steps should tag slice 2");
});
