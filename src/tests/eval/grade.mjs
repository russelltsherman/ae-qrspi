// Layer-2 rubric grader (mvp-plan §11). For each eval case it: (1) generates the phase's artifact
// fresh via headless Claude Code (reusing the L1 harness), then (2) asks a separate `claude -p`
// JUDGE to grade the artifact against the case's `expectations`, returning PASS/FAIL + evidence.
//
// Why an LLM judge instead of skill-creator's run_eval.py: run_eval.py only measures *triggering*
// (does the description fire), and its detector is unreliable in this devcontainer (see the project
// memory `skill-creator-run-eval-invalid-in-sandbox`). The qualitative quality bar L2 actually wants
// — "research stayed factual", "slices are genuinely vertical" — is graded here instead, by giving
// the judge the artifact text inline and disallowing every tool so it can only reason and answer.
//
// Runs only when QRSPI_EVAL_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin). The
// grading SHAPE (summary math, case selection) is unit-tested for free in grade.test.mjs.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempRepo, runPrompt, readArtifact } from "../lib/headless.mjs";
import { ISO_HOME } from "../lib/iso-home.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BEHAVIORAL_FIXTURES = join(HERE, "..", "behavioral", "fixtures");

export function loadEvals() {
  return JSON.parse(readFileSync(join(HERE, "evals.json"), "utf8"));
}

// Which cases to grade: QRSPI_EVAL_CASES="2,3,4" selects by id; otherwise the hard-gate subset
// (the smoke default); QRSPI_EVAL_CASES="all" runs everything.
export function selectCases(evals, sel = process.env.QRSPI_EVAL_CASES) {
  if (sel && sel !== "all") {
    const ids = new Set(sel.split(",").map((s) => Number(s.trim())));
    return evals.cases.filter((c) => ids.has(c.id));
  }
  if (sel === "all") return evals.cases;
  const hard = evals.cases.filter((c) => c.hardGate);
  return hard.length ? hard : evals.cases;
}

// Build the temp repo for a case and run its skill to produce the artifact fresh.
function generateArtifact(c) {
  const seedFiles = {};
  for (const name of c.seedArtifacts ?? []) {
    seedFiles[`${name}.md`] = readFileSync(join(BEHAVIORAL_FIXTURES, `${c.seedFeature}.${name}.md`), "utf8");
  }
  const { cwd, featureDir } = makeTempRepo({
    fixture: c.fixture,
    slug: c.fresh ? null : c.seedFeature,
    files: seedFiles,
    seedThrough: c.seedThrough,
  });

  runPrompt(cwd, c.prompt);

  // Seeded cases know their feature dir; a fresh case (ticket) created an unknown slug — discover it.
  let dir = featureDir;
  if (c.fresh) {
    const qdir = join(cwd, ".qrspi");
    const slugs = existsSync(qdir) ? readdirSync(qdir, { withFileTypes: true }).filter((e) => e.isDirectory()) : [];
    dir = slugs.length ? join(qdir, slugs[0].name) : null;
  }
  const artifact = dir ? readArtifact(dir, c.artifact) : null;
  return { cwd, artifact };
}

function judgePrompt(c, artifactText) {
  const numbered = c.expectations.map((e, i) => `${i + 1}. ${e}`).join("\n");
  return [
    "You are a strict grader for an AI coding-workflow artifact. Judge ONLY the artifact text below.",
    "Superficial or partial compliance is a FAIL. If an expectation cannot be confirmed from the text, FAIL it.",
    "",
    `=== ARTIFACT (${c.artifact}) ===`,
    artifactText,
    "=== END ARTIFACT ===",
    "",
    "EXPECTATIONS:",
    numbered,
    "",
    'Return ONLY a JSON object, no prose, of the form:',
    '{"verdicts":[{"id":1,"passed":true,"evidence":"<one sentence>"}, ...]}',
  ].join("\n");
}

// Fold a judge's verdicts into the grading.json-shaped expectations + summary. Pure, so the math is
// unit-tested for free. A missing verdict for an expectation counts as a FAIL (no benefit of doubt).
export function foldVerdicts(expectationTexts, verdicts = []) {
  const expectations = expectationTexts.map((text, i) => {
    const v = verdicts.find((x) => x.id === i + 1) ?? {};
    return { text, passed: Boolean(v.passed), evidence: v.evidence ?? "no verdict returned" };
  });
  const passed = expectations.filter((e) => e.passed).length;
  const total = expectations.length;
  return { expectations, summary: { passed, failed: total - passed, total, pass_rate: total ? passed / total : 0 } };
}

// Pull the assistant's final text out of `claude -p --output-format json`. This CLI version returns
// an ARRAY of stream events (system/init, assistant messages, a final result event) — NOT a single
// {result} object — so we find the result event's text; we also tolerate the single-object form.
export function judgeText(out) {
  let parsed;
  try { parsed = JSON.parse(out); } catch { return out; }
  if (Array.isArray(parsed)) {
    const ev = [...parsed].reverse().find((m) => typeof m?.result === "string") ??
      [...parsed].reverse().find((m) => m?.type === "result");
    return ev?.result ?? out;
  }
  return typeof parsed?.result === "string" ? parsed.result : out;
}

// Extract the first balanced JSON object from a string (judges sometimes wrap it in prose/fences).
export function extractJson(text) {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("judge returned no JSON object");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("judge returned an unbalanced JSON object");
}

// Run the judge as a fully tool-less `claude -p` so it can only reason over the inline artifact.
function runJudge(prompt, { timeoutMs = 300000 } = {}) {
  const home = existsSync(ISO_HOME) ? ISO_HOME : process.env.HOME;
  const out = execFileSync(
    "claude",
    [
      "-p", prompt,
      "--output-format", "json",
      "--permission-mode", "bypassPermissions",
      "--disallowedTools", "Write,Edit,Bash,Read,Glob,Grep,Task,WebFetch,WebSearch",
    ],
    { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HOME: home } },
  );
  return extractJson(judgeText(out));
}

// Grade one case end to end: generate the artifact, judge it, fold into a grading.json-shaped object.
export function gradeCase(c) {
  const { artifact } = generateArtifact(c);
  if (!artifact) {
    return {
      case_id: c.id, skill: c.skill, phase: c.phase, error: "artifact not produced",
      expectations: c.expectations.map((text) => ({ text, passed: false, evidence: "artifact was never written" })),
      summary: { passed: 0, failed: c.expectations.length, total: c.expectations.length, pass_rate: 0 },
    };
  }
  const verdicts = runJudge(judgePrompt(c, artifact)).verdicts ?? [];
  return { case_id: c.id, skill: c.skill, phase: c.phase, ...foldVerdicts(c.expectations, verdicts) };
}

// ---- CLI: `node tests/eval/grade.mjs [ids|all]` — grade selected cases and print a report. -------
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.QRSPI_EVAL_LIVE !== "1") {
    process.stdout.write("L2 grader is opt-in (spends tokens). Run via `npm run test:eval` or set QRSPI_EVAL_LIVE=1.\n");
    process.exit(0);
  }
  const evals = loadEvals();
  const cases = selectCases(evals, process.argv[2] ?? process.env.QRSPI_EVAL_CASES);
  const bar = Number(process.env.QRSPI_EVAL_BAR ?? evals.bar);
  let failures = 0;
  for (const c of cases) {
    let g;
    try {
      g = gradeCase(c);
    } catch (err) {
      failures++;
      process.stdout.write(`\n[ERROR] case ${c.id} ${c.skill} — ${err.message}\n`);
      continue;
    }
    const ok = g.summary.pass_rate >= bar;
    if (!ok) failures++;
    process.stdout.write(
      `\n[${ok ? "PASS" : "FAIL"}] case ${g.case_id} ${g.skill} — ${g.summary.passed}/${g.summary.total} (${(g.summary.pass_rate * 100).toFixed(0)}%, bar ${(bar * 100).toFixed(0)}%)\n`,
    );
    for (const e of g.expectations) {
      process.stdout.write(`   ${e.passed ? "✓" : "✗"} ${e.text}\n      ↳ ${e.evidence}\n`);
    }
  }
  process.stdout.write(`\n${cases.length - failures}/${cases.length} cases at or above the ${(bar * 100).toFixed(0)}% bar.\n`);
  process.exit(failures ? 1 : 0);
}
