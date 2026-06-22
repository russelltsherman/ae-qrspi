// qrspi-state.mjs — the deterministic state/gate helper for the QRSPI pipeline.
//
// This is the ONE place the human-gate rule lives, so the per-phase skills can stay thin:
// they call this script instead of reasoning about state.json by hand. Pure functions
// (initState / gateCheck / recordProduced) carry the logic and are unit-tested; the CLI at
// the bottom is a thin fs wrapper.
//
// Gate rule (mvp-plan §4, §6): a phase may run only when its predecessor is at least
// `produced`. Running phase N records N-1 as `approved` (proceeding = approval, because the
// human reviewed it in the gap) and, after the agent writes the artifact, records N as
// `produced`.
//
// Run with: node --test (see qrspi-state.test.mjs)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

// Canonical phase order. The artifact for each phase is `<phase>.md` (unprefixed — order is
// conveyed here and in state.json, never by numeric file-name prefixes). Keep this in lockstep
// with docs/qrspi-conventions.md; conventions.test.mjs asserts they agree.
export const PHASE_ORDER = [
  "ticket",
  "questions",
  "research",
  "design",
  "structure",
  "plan",
  "worktree",
  "implement",
  "pr",
];

export const STATUS_VALUES = ["pending", "produced", "approved", "rejected"];

// A predecessor is "gate-openable" once the human has had something to review.
const REVIEWABLE = new Set(["produced", "approved"]);

export function initState(feature, now) {
  if (!feature) throw new Error("feature (slug) is required");
  const phases = {};
  for (const phase of PHASE_ORDER) phases[phase] = { status: "pending" };
  return { feature, createdAt: now, phases, currentSlice: null };
}

// Open the gate for `phase`: approve its predecessor if reviewable, else report what's missing.
// Returns { ok, state, message, blockedBy }. Does not mutate the input; returns a fresh state.
export function gateCheck(state, phase, now) {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx === -1) throw new Error(`unknown phase: ${phase}`);

  const next = structuredClone(state);

  if (idx === 0) {
    return { ok: true, state: next, message: `OK: '${phase}' is the entry phase (no predecessor).`, blockedBy: null };
  }

  const predName = PHASE_ORDER[idx - 1];
  const pred = next.phases[predName] ?? { status: "pending" };

  if (!REVIEWABLE.has(pred.status)) {
    return {
      ok: false,
      state: next,
      blockedBy: predName,
      message: `BLOCKED: '${phase}' needs '${predName}' to be produced first (it is '${pred.status}'). Run /qrspi-${predName} and review its artifact, then retry.`,
    };
  }

  // Proceeding past the human gate IS the approval of the predecessor.
  if (pred.status !== "approved") {
    pred.status = "approved";
    pred.approvedAt = now;
  }
  next.phases[predName] = pred;
  return { ok: true, state: next, message: `OK: gate open for '${phase}'; '${predName}' marked approved.`, blockedBy: null };
}

// Record that `phase` produced its artifact (called after the agent writes it). Re-running a
// phase resets it to `produced` so it must be re-reviewed; the next gate re-approves it.
// `slice` is the optional id of the vertical slice just built (the execution phases run one
// slice per invocation); when given it updates `currentSlice` so state tracks slice progress.
export function recordProduced(state, phase, artifact, slice) {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx === -1) throw new Error(`unknown phase: ${phase}`);
  const next = structuredClone(state);
  next.phases[phase] = { status: "produced", artifact: artifact ?? `${phase}.md` };
  if (slice != null && slice !== "") next.currentSlice = slice;
  return next;
}

// ---- CLI -------------------------------------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) flags[a.slice(2)] = argv[++i];
    else positional.push(a);
  }
  return { positional, flags };
}

function statePath(root, slug) {
  return join(root, ".qrspi", slug, "state.json");
}

function loadState(root, slug) {
  const p = statePath(root, slug);
  if (!existsSync(p)) {
    throw new Error(`no state for feature '${slug}' at ${p}. Run /qrspi-ticket first.`);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveState(root, slug, state) {
  const p = statePath(root, slug);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2) + "\n");
  return p;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const root = flags.root ?? process.cwd();
  const now = new Date().toISOString();

  try {
    switch (cmd) {
      case "init": {
        const [slug] = positional;
        if (!slug) throw new Error("usage: qrspi-state init <slug> --root <dir>");
        const p = statePath(root, slug);
        if (existsSync(p)) {
          process.stdout.write(`state already exists for '${slug}' (${p}); leaving it untouched.\n`);
          return;
        }
        saveState(root, slug, initState(slug, now));
        process.stdout.write(`initialized ${p}\n`);
        return;
      }
      case "gate": {
        const [slug, phase] = positional;
        if (!slug || !phase) throw new Error("usage: qrspi-state gate <slug> <phase> --root <dir>");
        const res = gateCheck(loadState(root, slug), phase, now);
        if (res.ok) saveState(root, slug, res.state);
        process.stdout.write(res.message + "\n");
        process.exit(res.ok ? 0 : 1);
        return;
      }
      case "record": {
        const [slug, phase] = positional;
        if (!slug || !phase) throw new Error("usage: qrspi-state record <slug> <phase> --artifact <name> [--slice <id>] --root <dir>");
        const next = recordProduced(loadState(root, slug), phase, flags.artifact, flags.slice);
        saveState(root, slug, next);
        const sliceNote = flags.slice ? ` (slice ${flags.slice})` : "";
        process.stdout.write(`recorded '${phase}' as produced for '${slug}'${sliceNote}\n`);
        return;
      }
      default:
        throw new Error(`unknown command '${cmd ?? ""}'. Commands: init | gate | record`);
    }
  } catch (err) {
    process.stderr.write(`qrspi-state: ${err.message}\n`);
    process.exit(2);
  }
}

// Only run the CLI when invoked directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) main();
