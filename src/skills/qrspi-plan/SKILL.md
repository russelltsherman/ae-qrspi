---
name: qrspi-plan
description: QRSPI Plan phase. Produces plan.md — ordered tactical steps, each tagged with its vertical slice — from the approved structure. Requires the structure phase. Use after /qrspi-structure, or when the user says "/qrspi-plan".
---

# /qrspi-plan — tactical steps, each tied to a slice

A *thin wrapper* around the `qrspi-planner` agent. It opens the gate, dispatches the agent with the
approved structure, records the artifact, and sets up the spot-check. The substance of sequencing
the work lives in the agent.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` may name the feature slug. If omitted and exactly one feature exists under `.qrspi/`,
use it; if several exist, ask which.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> plan --root <repo-root>
   ```
   If it exits non-zero, relay its message and stop. On success it has approved the `structure` phase.

2. **Dispatch the planner** via the Task tool with subagent type `qrspi:qrspi-planner`, passing:
   - `STRUCTURE_PATH` = `<repo-root>/.qrspi/<slug>/structure.md`
   - `SOURCE_ROOT` = `<repo-root>`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/plan.md`

3. **Record the artifact** once the agent reports it wrote `plan.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> plan --artifact plan.md --root <repo-root>
   ```

4. **Hand off.** Show the path to `plan.md` and tell the user to **spot-check** it: every step should
   tie to a slice from the structure. To revise, edit `plan.md` directly or re-run this skill.
   Do not auto-advance.

## Guardrails

- This skill never edits code and writes only `plan.md` (+ `state.json`).
