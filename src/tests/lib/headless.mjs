// L1 behavioral harness helpers: stand up a throwaway copy of a fixture repo with a pre-seeded
// .qrspi/ state, drive a QRSPI skill through headless Claude Code, and read back the artifacts.
//
// These run only when QRSPI_TEST_LIVE=1 (they spend tokens and need the `claude` CLI with the qrspi
// plugin installed). The deterministic pieces they lean on — the state machine and the withhold
// scanner — are unit-tested separately and for free.

import { execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { initState, gateCheck, recordProduced, PHASE_ORDER } from "../../scripts/qrspi-state.mjs";
import { ISO_HOME } from "./iso-home.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures");

// Is the headless harness runnable in this environment?
export function claudeAvailable() {
  try {
    execFileSync("claude", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Build a state object that has produced+approved every phase up to `lastProduced`, leaving
// `lastProduced` itself at `produced` (i.e. exactly the pre-state for running the NEXT phase).
function seedState(slug, lastProduced) {
  const stamp = "2026-01-01T00:00:00.000Z";
  let state = initState(slug, stamp);
  const upto = PHASE_ORDER.indexOf(lastProduced);
  for (let i = 0; i <= upto; i++) {
    const phase = PHASE_ORDER[i];
    state = recordProduced(state, phase, `${phase}.md`);
    // Approve every produced phase except the last one (the gate for the next phase will approve it).
    if (i < upto) state = gateCheck(state, PHASE_ORDER[i + 1], stamp).state;
  }
  return state;
}

// Create a temp repo: a copy of the fixture app + a seeded .qrspi/<slug>/ with the given artifact
// files and state. `files` maps artifact name -> contents (e.g. { "ticket.md": "...", ... }).
// `seedThrough` is the last phase to mark produced (omit for a bare repo with no feature yet).
export function makeTempRepo({ fixture = "sample-app", slug, files = {}, seedThrough } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "qrspi-l1-"));
  cpSync(join(FIXTURES, fixture), cwd, { recursive: true });
  if (slug) {
    const featureDir = join(cwd, ".qrspi", slug);
    mkdirSync(featureDir, { recursive: true });
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(featureDir, name), contents);
    }
    if (seedThrough) {
      writeFileSync(join(featureDir, "state.json"), JSON.stringify(seedState(slug, seedThrough), null, 2) + "\n");
    }
  }
  return { cwd, featureDir: slug ? join(cwd, ".qrspi", slug) : null };
}

// Drive a prompt (e.g. "/qrspi-research add-csv-export") through headless Claude Code in `cwd`.
// Returns the parsed JSON result. Tests assert on artifacts written to disk, not on this text.
export function runPrompt(cwd, prompt, { timeoutMs = 600000 } = {}) {
  // Isolation: if an isolated HOME has been built (npm run test:behavior builds it first), point the
  // nested claude there so its global-config writes can't corrupt the developer's real ~/.claude.json
  // (or race a sibling run). Falls back to the real HOME with no isolation if it wasn't built.
  const home = existsSync(ISO_HOME) ? ISO_HOME : process.env.HOME;
  // bypassPermissions: the run is fully autonomous (no Bash/Write prompts to hang on). Safe here
  // because every run is inside a throwaway temp dir created by makeTempRepo.
  const out = execFileSync(
    "claude",
    ["-p", prompt, "--output-format", "json", "--permission-mode", "bypassPermissions"],
    { cwd, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HOME: home } },
  );
  try {
    return JSON.parse(out);
  } catch {
    return { raw: out };
  }
}

export function readArtifact(featureDir, name) {
  const p = join(featureDir, name);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}
