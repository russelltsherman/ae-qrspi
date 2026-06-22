---
name: qrspi-structure
description: QRSPI Structure phase. Produces structure.md — signatures/types plus the mandatory vertical-slice table (a checkpoint per slice) — from the approved design. Requires the design phase. Use after /qrspi-design, or when the user says "/qrspi-structure".
---

# /qrspi-structure — signatures, types, and the vertical-slice table

A *thin wrapper* around the `qrspi-structurer` agent. It opens the gate, dispatches the agent with
the approved design, records the artifact, and sets up the slice review. The substance of slicing
the work lives in the agent.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` may name the feature slug. If omitted and exactly one feature exists under `.qrspi/`,
use it; if several exist, ask which.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> structure --root <repo-root>
   ```
   If it exits non-zero, relay its message and stop. On success it has approved the `design` phase.

2. **Dispatch the structurer** via the Task tool with subagent type `qrspi:qrspi-structurer`,
   passing:
   - `DESIGN_PATH` = `<repo-root>/.qrspi/<slug>/design.md`
   - `SOURCE_ROOT` = `<repo-root>`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/structure.md`

3. **Record the artifact** once the agent reports it wrote `structure.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> structure --artifact structure.md --root <repo-root>
   ```

4. **Hand off.** Show the path to `structure.md` and tell the user this is a **hard gate**: confirm
   the vertical slices are genuinely independent and each has a real checkpoint before running
   `/qrspi-plan`. Do not auto-advance.

## Guardrails

- This skill never edits code and writes only `structure.md` (+ `state.json`).
