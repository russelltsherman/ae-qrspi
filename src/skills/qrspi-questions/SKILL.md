---
name: qrspi-questions
description: QRSPI Questions phase. Turns the captured ticket into concrete technical questions (questions.md) that steer the research phase. Requires the ticket phase to have produced ticket.md. Use after /qrspi-ticket, or when the user says "/qrspi-questions".
---

# /qrspi-questions — derive the technical questions

A *thin wrapper* around the `qrspi-questioner` agent. It opens the gate, dispatches the agent with
the ticket and the repo, records the artifact, and points the human to the next step. All the
substance of asking good questions lives in the agent.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` may name the feature slug. If omitted and exactly one feature exists under `.qrspi/`,
use it; if several exist, ask which.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> questions --root <repo-root>
   ```
   If it exits non-zero, relay its message (it names the missing predecessor) and stop — do not
   proceed. On success it has approved the `ticket` phase.

2. **Dispatch the questioner** via the Task tool with subagent type `qrspi:qrspi-questioner`,
   passing:
   - `TICKET_PATH` = `<repo-root>/.qrspi/<slug>/ticket.md`
   - `SOURCE_ROOT` = `<repo-root>`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/questions.md`

3. **Record the artifact** once the agent reports it wrote `questions.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> questions --artifact questions.md --root <repo-root>
   ```

4. **Hand off.** Show the path to `questions.md`, ask the user to review it for coverage, and tell
   them the next step is `/qrspi-research` (in a fresh session). Do not auto-advance.

## Guardrails

- This skill never edits code and writes only `questions.md` (+ `state.json`). It does not research
  or answer the questions — that is the next phase.
