---
name: qrspi-ticket
description: Entry point of the QRSPI pipeline. Captures a one-sentence/paragraph feature request into a structured .qrspi/<slug>/ticket.md, seeds state.json, and points the user to the next phase. Use when starting a new feature with QRSPI, or when the user says "/qrspi-ticket <description>".
---

# /qrspi-ticket — start a QRSPI feature

This is the **entry point**. It turns a raw feature description into the first artifact and sets up
the per-feature workspace. It is a *thin wrapper*: it derives the slug, seeds state, dispatches the
`qrspi-ticketer` agent, records the artifact, and tells the human what to review. All the substance
of writing a good ticket lives in the agent, not here.

Read the conventions contract first if you have not: `${CLAUDE_PLUGIN_ROOT}/docs/qrspi-conventions.md`.

## Input

`$ARGUMENTS` is the user's feature description (a sentence or short paragraph). If it is empty, stop
and ask the user for a one-line description of the feature — do not invent one.

## Procedure

1. **Derive the feature slug.** Make a short kebab-case slug from the description
   (e.g. "Add CSV export to the reports page" → `add-csv-export`). Keep it ≤ 4–5 words. This is the
   feature directory name and the `feature` field in state.

2. **Seed state.** From the repo root, initialize the workspace (idempotent — it will not clobber an
   existing feature):
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs init <slug> --root <repo-root>
   ```
   If state already exists for this slug, tell the user it exists and ask whether to reuse it or
   pick a new slug — do not overwrite.

3. **Dispatch the ticketer agent** via the Task tool with subagent type `qrspi:qrspi-ticketer`,
   passing it:
   - `FEATURE_DESCRIPTION` = the raw `$ARGUMENTS` text (verbatim — do not pre-summarize or design).
   - `OUTPUT_PATH` = `<repo-root>/.qrspi/<slug>/ticket.md`.

   The agent writes `ticket.md`. Do not write it yourself and do not add design detail.

4. **Record the artifact** once the agent reports it wrote `ticket.md`:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> ticket --artifact ticket.md --root <repo-root>
   ```

5. **Hand off to the human.** Show the path to `ticket.md`, ask the user to confirm it reflects
   their intent, and tell them the next step is `/qrspi-questions` (run it in a fresh session;
   reviewing the ticket in the gap **is** the gate). Do not auto-advance.

## Guardrails

- This skill never edits code and never designs a solution — it only captures the request.
- It writes exactly one artifact (`ticket.md`) plus `state.json`. If you find yourself about to
  write `questions.md` or analyze the repo, stop: that is the next phase.
