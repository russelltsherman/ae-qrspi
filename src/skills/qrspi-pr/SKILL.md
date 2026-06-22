---
name: qrspi-pr
description: QRSPI PR phase. Drafts pr.md — a structured PR description + self-review notes — from the implemented diff, via the qrspi-reviewer agent. Never pushes or opens a PR. Requires the implement phase. Use after the slices are built, or when the user says "/qrspi-pr".
---

# /qrspi-pr — draft the PR description, hand the human the wheel

A *thin wrapper* around the `qrspi-reviewer` agent. It opens the gate, dispatches the agent to read
the diff and draft `pr.md`, records the artifact, and sets up the final hard gate. The substance of
reviewing the change lives in the agent. The **human owns the PR** — this skill never pushes or opens
one.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` may name the feature slug and, optionally, a base ref to diff against (default the repo's
default branch). If the slug is omitted and exactly one feature exists under `.qrspi/`, use it.

> Run this only once **all** slices are implemented and their checkpoints pass — the gate only checks
> that `implement` ran at least once, so completing every slice first is on you.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> pr --root <repo-root>
   ```
   If it exits non-zero, relay its message and stop. On success it has approved the `implement` phase.

2. **Dispatch the reviewer** via the Task tool with subagent type `qrspi:qrspi-reviewer`, passing:
   - `SOURCE_ROOT` = `<repo-root>`
   - `BASE_REF` = the base branch (from `$ARGUMENTS`, else the repo's default branch)
   - `IMPLEMENT_PATH` = `<repo-root>/.qrspi/<slug>/implement.md`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/pr.md`

3. **Record the artifact** once the agent reports it wrote `pr.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> pr --artifact pr.md --root <repo-root>
   ```

4. **Hand off.** Show the path to `pr.md`. This is the **final hard gate**: the user reads the
   description and the diff, then **creates the PR themselves**. Do not push, commit, or open a PR.

## Guardrails

- This skill never pushes, commits, or opens a PR — it only drafts `pr.md` (+ `state.json`).
