// Triggering / routing probes — the "no magic words" check at the routing layer (mvp-plan §2, §8).
//
// skill-creator's run_eval.py measures triggering by planting a temp `.claude/commands/<name>.md`
// proxy and seeing if `claude -p` fires it — but that detector is unreliable in this devcontainer
// (project memory `skill-creator-run-eval-invalid-in-sandbox`: uniform 0/3 even on obvious
// positives). The validated alternative, used here: run a PLAIN natural-language request (no slash
// command, no skill name) through `claude -p` with ALL the real skills installed, stream the output,
// and read the FIRST `"skill":"qrspi:qrspi-<phase>"` the model routes to. That tests true head-to-head
// disambiguation. We kill the child as soon as we see the route so we don't pay for execution.
//
// Runs only when QRSPI_EVAL_LIVE=1 (spends tokens, needs the `claude` CLI + qrspi plugin installed).
// The parser is unit-tested for free in routing-probes.test.mjs.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ISO_HOME } from "../lib/iso-home.mjs";
import { makeTempRepo } from "../lib/headless.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BEHAVIORAL_FIXTURES = join(HERE, "..", "behavioral", "fixtures");

// Natural-language requests a user would actually type — deliberately WITHOUT the slash command or
// the skill name — paired with the qrspi skill each should route to. Mid-pipeline probes carry the
// SAME seed metadata the rubric harness uses (fixture + the feature pre-state) so the routing test
// is FAIR: the feature actually exists. Without it, a request like "produce a map for add-csv-export"
// has no feature to act on and the skill (which gates on its predecessor) can't sensibly fire — that
// would test the empty repo, not the description's triggering power.
export const PROBES = [
  {
    request: "I want to start a new feature with qrspi: add CSV export to the reports page",
    expect: "qrspi-ticket", fixture: "tasks-app", fresh: true,
  },
  {
    request: "produce a cited factual map of how the reporting code works today for the add-csv-export feature",
    expect: "qrspi-research", fixture: "sample-app", seedFeature: "add-csv-export",
    seedThrough: "questions", seedArtifacts: ["ticket", "questions"],
  },
  {
    request: "break the approved design for add-csv-export into independently testable vertical slices",
    expect: "qrspi-structure", fixture: "sample-app", seedFeature: "add-csv-export",
    seedThrough: "design", seedArtifacts: ["ticket", "questions", "research", "design"],
  },
  {
    request: "lay out the ordered tactical build steps for add-csv-export, each tied to a slice",
    expect: "qrspi-plan", fixture: "sample-app", seedFeature: "add-csv-export",
    seedThrough: "structure", seedArtifacts: ["ticket", "questions", "research", "design", "structure"],
  },
  {
    request: "build slice 1 of the add-csv-export feature and run its checkpoint",
    expect: "qrspi-implement", fixture: "sample-app", seedFeature: "add-csv-export",
    seedThrough: "worktree", seedArtifacts: ["ticket", "questions", "research", "design", "structure", "plan", "worktree"],
  },
  {
    request: "draft the pull-request description and self-review for the add-csv-export change",
    expect: "qrspi-pr", fixture: "sample-app", seedFeature: "add-csv-export",
    seedThrough: "implement", seedArtifacts: ["ticket", "questions", "research", "design", "structure", "plan", "worktree", "implement"],
  },
];

// Build the seeded temp repo a probe should run in, so mid-pipeline phases have their feature context.
function seedProbeRepo(probe) {
  const files = {};
  for (const name of probe.seedArtifacts ?? []) {
    files[`${name}.md`] = readFileSync(join(BEHAVIORAL_FIXTURES, `${probe.seedFeature}.${name}.md`), "utf8");
  }
  return makeTempRepo({
    fixture: probe.fixture,
    slug: probe.fresh ? null : probe.seedFeature,
    files,
    seedThrough: probe.seedThrough,
  });
}

// Pull the first routed qrspi skill out of a stream-json transcript. Returns e.g. "qrspi-ticket".
export function firstRoutedSkill(streamText) {
  const m = streamText.match(/"skill"\s*:\s*"qrspi:(qrspi-[a-z]+)"/);
  return m ? m[1] : null;
}

// Run one probe: seed its feature repo, stream `claude -p` from there, resolve as soon as the first
// qrspi skill routes (then kill the child), or on timeout (routed: null = a miss). The seeded repo is
// removed afterwards. Never lets the model execute side effects (destructive tools are disallowed).
export function runProbe(probe, { timeoutMs = 150000 } = {}) {
  const request = typeof probe === "string" ? probe : probe.request; // (string form kept for tests)
  const { cwd } = typeof probe === "string" ? { cwd: process.cwd() } : seedProbeRepo(probe);
  return new Promise((resolve) => {
    const home = existsSync(ISO_HOME) ? ISO_HOME : process.env.HOME;
    const child = spawn(
      "claude",
      [
        "-p", request,
        "--output-format", "stream-json", "--verbose", "--include-partial-messages",
        "--permission-mode", "bypassPermissions",
        // Block side effects + the blocking/expensive tools so a routed skill loads but does nothing.
        "--disallowedTools", "Write,Edit,Bash,Task,Agent,AskUserQuestion,WebFetch,WebSearch",
      ],
      { cwd, env: { ...process.env, HOME: home }, stdio: ["ignore", "pipe", "ignore"] },
    );

    let buf = "";
    let done = false;
    const finish = (routed) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      if (typeof probe !== "string") { try { rmSync(cwd, { recursive: true, force: true }); } catch {} }
      resolve({ request, routed });
    };
    const timer = setTimeout(() => finish(firstRoutedSkill(buf)), timeoutMs);

    child.stdout.on("data", (chunk) => {
      buf += chunk;
      const routed = firstRoutedSkill(buf);
      if (routed) finish(routed);
    });
    child.on("error", () => finish(null));
    child.on("close", () => finish(firstRoutedSkill(buf)));
  });
}

// ---- CLI: `node tests/eval/routing-probes.mjs [n]` — run the first n probes (default all). --------
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.QRSPI_EVAL_LIVE !== "1") {
    process.stdout.write("Routing probes are opt-in (spend tokens). Run via `npm run test:routing` or set QRSPI_EVAL_LIVE=1.\n");
    process.exit(0);
  }
  const n = process.argv[2] ? Number(process.argv[2]) : PROBES.length;
  const probes = PROBES.slice(0, n);
  let misses = 0;
  for (const p of probes) {
    const { routed } = await runProbe(p);
    const ok = routed === p.expect;
    if (!ok) misses++;
    process.stdout.write(
      `[${ok ? "PASS" : "MISS"}] expected ${p.expect}, routed ${routed ?? "(none)"}\n   ↳ "${p.request}"\n`,
    );
  }
  process.stdout.write(`\n${probes.length - misses}/${probes.length} probes routed correctly.\n`);
  process.exit(misses ? 1 : 0);
}
