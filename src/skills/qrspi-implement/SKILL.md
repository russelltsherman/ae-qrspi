---
name: qrspi-implement
description: QRSPI Implement phase. Builds ONE vertical slice per run — code + tests — then runs its checkpoint, via the qrspi-implementer agent. Updates implement.md and the code. Requires the worktree phase. Use after /qrspi-worktree, or when the user says "/qrspi-implement <slice>".
---

# /qrspi-implement — build one slice, run its checkpoint

A *thin wrapper* around the `qrspi-implementer` agent — the one phase that edits code. It opens the
gate, dispatches the agent for **a single slice**, records the slice, and sets up the hard gate. The
substance of building the slice lives in the agent.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` provides the feature slug and the **slice id** to build (e.g. `add-csv-export 1`). If
the slug is omitted and exactly one feature exists under `.qrspi/`, use it. **The slice id is
required** — if it's missing, show the slices from `structure.md` and ask which to build. Build one
slice per run.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> implement --root <repo-root>
   ```
   If it exits non-zero, relay its message and stop. On success it has approved the `worktree` phase.

2. **Dispatch the implementer** via the Task tool with subagent type `qrspi:qrspi-implementer`,
   passing:
   - `SLICE` = the requested slice id
   - `PLAN_PATH` = `<repo-root>/.qrspi/<slug>/plan.md`
   - `STRUCTURE_PATH` = `<repo-root>/.qrspi/<slug>/structure.md`
   - `SOURCE_ROOT` = `<repo-root>`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/implement.md`

3. **Record the slice** once the agent reports it built the slice and ran its checkpoint:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> implement --artifact implement.md --slice <slice> --root <repo-root>
   ```
   (`--slice` updates `currentSlice` in `state.json` so progress is tracked.)

4. **Hand off.** Report the slice built and its **checkpoint result** (pass/fail). This is a **hard
   gate**: the user reviews the diff and confirms the checkpoint passed. If it failed, stop here — fix
   before proceeding. When this slice is good, run `/qrspi-implement <slug> <next-slice>` for the next
   one, or `/qrspi-pr` once **all** slices are implemented and passing. Do not auto-advance.

## Guardrails

- Builds **one slice per run** — never multiple in a single invocation.
- This is the only skill whose agent edits code; it touches source + `implement.md` (+ `state.json`).
- Never push, commit, or open a PR — the human owns that.
