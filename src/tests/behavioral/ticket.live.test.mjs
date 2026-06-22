// L1 behavioral: /qrspi-ticket captures the request as a structured ticket.md.
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "golden", "ticket.json"), "utf8"));
const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();

test("L1 /qrspi-ticket writes a structured, solution-free ticket.md", { skip: SKIP }, () => {
  const { cwd } = makeTempRepo({});
  runPrompt(cwd, '/qrspi-ticket add CSV export to the reports page');

  // The slug is model-derived; find the one feature dir that was created.
  const featureDir = join(cwd, ".qrspi", findSoleFeature(cwd));
  const ticket = readArtifact(featureDir, "ticket.md");
  assert.ok(ticket, "ticket.md was created");
  for (const section of golden.requiredSections) {
    assert.ok(ticket.includes(section), `ticket.md must contain "${section}"`);
  }
  for (const pat of golden.mustNotContain.patterns) {
    assert.ok(!ticket.includes(pat), `ticket.md must not contain premature-design token "${pat}"`);
  }
});

function findSoleFeature(cwd) {
  const dirs = readdirSync(join(cwd, ".qrspi"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  assert.equal(dirs.length, 1, `expected exactly one feature dir, got ${dirs.join(",")}`);
  return dirs[0];
}
