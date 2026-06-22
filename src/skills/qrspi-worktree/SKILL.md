---
name: qrspi-worktree
description: QRSPI WorkTree phase. Produces worktree.md — a slice→branch/task map, one independently testable unit per branch — from the approved plan. Requires the plan phase. Use after /qrspi-plan, or when the user says "/qrspi-worktree".
---

# /qrspi-worktree — map slices to branches/tasks

A *thin wrapper* around the `qrspi-worktree` agent. It opens the gate, dispatches the agent with the
approved plan and structure, records the artifact, and sets up the review. The substance of breaking
the work into branches lives in the agent.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` may name the feature slug. If omitted and exactly one feature exists under `.qrspi/`,
use it; if several exist, ask which.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> worktree --root <repo-root>
   ```
   If it exits non-zero, relay its message and stop. On success it has approved the `plan` phase.

2. **Dispatch the worktree agent** via the Task tool with subagent type `qrspi:qrspi-worktree`,
   passing:
   - `PLAN_PATH` = `<repo-root>/.qrspi/<slug>/plan.md`
   - `STRUCTURE_PATH` = `<repo-root>/.qrspi/<slug>/structure.md`
   - `SOURCE_ROOT` = `<repo-root>`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/worktree.md`

3. **Record the artifact** once the agent reports it wrote `worktree.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> worktree --artifact worktree.md --root <repo-root>
   ```

4. **Hand off.** Show the path to `worktree.md` and tell the user to review the slice→branch mapping
   (one independently testable unit per branch). Then build slices one at a time with
   `/qrspi-implement <slug> <slice>`. Do not auto-advance.

## Guardrails

- This skill never edits code and writes only `worktree.md` (+ `state.json`).
