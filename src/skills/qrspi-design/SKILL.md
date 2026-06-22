---
name: qrspi-design
description: QRSPI Design phase. Brain-dumps a grounded design (design.md) — current state, desired end state, and design decisions with trade-offs — from the research map plus the ticket. Requires the research phase. Use after /qrspi-research, or when the user says "/qrspi-design".
---

# /qrspi-design — brain-dump the grounded design

A *thin wrapper* around the `qrspi-designer` agent. It opens the gate, dispatches the agent with the
research map and the ticket, records the artifact, and sets up the "brain surgery" review. The
substance of designing lives in the agent.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` may name the feature slug. If omitted and exactly one feature exists under `.qrspi/`,
use it; if several exist, ask which.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> design --root <repo-root>
   ```
   If it exits non-zero, relay its message and stop. On success it has approved the `research` phase.

2. **Dispatch the designer** via the Task tool with subagent type `qrspi:qrspi-designer`, passing:
   - `RESEARCH_PATH` = `<repo-root>/.qrspi/<slug>/research.md`
   - `TICKET_PATH` = `<repo-root>/.qrspi/<slug>/ticket.md`  — the designer DOES get the ticket back;
     the withhold applied only to research.
   - `SOURCE_ROOT` = `<repo-root>`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/design.md`

3. **Record the artifact** once the agent reports it wrote `design.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> design --artifact design.md --root <repo-root>
   ```

4. **Hand off.** Show the path to `design.md` and tell the user this is a **hard gate** — perform
   "brain surgery": challenge the decisions and redirect any bad patterns before running
   `/qrspi-structure`. To revise, edit `design.md` directly or re-run this skill. Do not auto-advance.

## Guardrails

- This skill never edits code and writes only `design.md` (+ `state.json`).
