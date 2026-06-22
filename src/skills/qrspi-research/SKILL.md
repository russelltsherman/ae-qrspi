---
name: qrspi-research
description: QRSPI Research phase. Produces a cited, ticket-blind factual map (research.md) answering the technical questions. Dispatches the researcher with questions.md ONLY — the ticket is withheld (the firewall against the plan-reading illusion). Requires the questions phase. Use after /qrspi-questions, or when the user says "/qrspi-research".
---

# /qrspi-research — produce the cited factual map (ticket withheld)

A *thin wrapper* around the `qrspi-researcher` agent. Its one job that matters beyond the usual
gate/dispatch/record is the **ticket withhold**: the researcher is dispatched with `questions.md`
only and is **never** given `ticket.md`. This is the single most important mechanism in QRSPI — do
not weaken it.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`
(see §4, the ticket withhold).

## Input

`$ARGUMENTS` may name the feature slug. If omitted and exactly one feature exists under `.qrspi/`,
use it; if several exist, ask which.

## Procedure

1. **Open the gate.** From the repo root:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> research --root <repo-root>
   ```
   If it exits non-zero, relay its message and stop. On success it has approved the `questions` phase.

2. **Dispatch the researcher** via the Task tool with subagent type `qrspi:qrspi-researcher`,
   passing it **only**:
   - `QUESTIONS_PATH` = `<repo-root>/.qrspi/<slug>/questions.md`
   - `SOURCE_ROOT` = `<repo-root>`
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/research.md`

   **The withhold (do not violate):** do **not** pass `ticket.md`, its path, or any of its text in
   the researcher's prompt. Do not paraphrase the desired feature for the researcher. Do not read
   `ticket.md` into your own context and relay it. The researcher must answer the questions blind to
   the feature. If the researcher asks for the ticket, decline and tell it to proceed without it.

3. **Record the artifact** once the agent reports it wrote `research.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> research --artifact research.md --root <repo-root>
   ```

4. **Hand off.** Show the path to `research.md` and tell the user this is a **hard gate**: review the
   map for accuracy (are the citations right? any silent assumptions?) before running `/qrspi-design`.
   Do not auto-advance.

## Guardrails

- Never pass the ticket — directly or paraphrased — into the researcher's context.
- This skill never edits code and writes only `research.md` (+ `state.json`).
