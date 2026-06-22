// L1 behavioral — the PR phase drafts a structured pr.md from the implemented diff and never pushes.
// Gated behind QRSPI_TEST_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempRepo, runPrompt, readArtifact, claudeAvailable } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "golden", "pr.json"), "utf8"));
const SKIP = process.env.QRSPI_TEST_LIVE !== "1" || !claudeAvailable();
const SLUG = "add-csv-export";

const seed = (name) => readFileSync(join(HERE, "fixtures", `${SLUG}.${name}.md`), "utf8");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "ignore" });

test("L1 pr: drafts pr.md from the diff without pushing", { skip: SKIP }, () => {
  const { cwd, featureDir } = makeTempRepo({
    slug: SLUG,
    seedThrough: "implement",
    files: {
      "ticket.md": seed("ticket"),
      "questions.md": seed("questions"),
      "research.md": seed("research"),
      "design.md": seed("design"),
      "structure.md": seed("structure"),
      "plan.md": seed("plan"),
      "worktree.md": seed("worktree"),
      "implement.md": seed("implement"),
    },
  });

  // Stand up a real git history so the reviewer has a diff to describe: commit the baseline, then
  // apply the slice-1 code change on top (uncommitted working-tree change).
  git(cwd, "init", "-q");
  git(cwd, "config", "user.email", "test@example.com");
  git(cwd, "config", "user.name", "test");
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", "baseline");
  const reportsPath = join(cwd, "src", "reports.js");
  writeFileSync(
    reportsPath,
    readFileSync(reportsPath, "utf8") +
      "\nexport function toCSV(report) {\n" +
      "  const head = report.columns.join(',');\n" +
      "  const body = report.rows.map((r) => report.columns.map((c) => r[c]).join(',')).join('\\n');\n" +
      "  return `${head}\\n${body}`;\n}\n",
  );

  runPrompt(cwd, `/qrspi-pr ${SLUG}`);

  const pr = readArtifact(featureDir, "pr.md");
  assert.ok(pr, "pr.md was created");
  for (const section of golden.requiredSections) {
    assert.ok(pr.includes(section), `pr.md must contain "${section}"`);
  }

  // The reviewer must not push or open a PR: still on the baseline commit, no extra commits/remotes.
  const log = execFileSync("git", ["log", "--oneline"], { cwd, encoding: "utf8" }).trim().split("\n");
  assert.equal(log.length, 1, "reviewer must not create commits");
  const remotes = execFileSync("git", ["remote"], { cwd, encoding: "utf8" }).trim();
  assert.equal(remotes, "", "reviewer must not add a remote / push");
});
