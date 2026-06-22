# QRSPI Conventions (the output contract)

> Single source of truth for every QRSPI agent and skill. Read this before producing or recording
> **any** artifact. When this contract and a specific agent prompt disagree, **this contract wins** —
> tell the operator about the conflict rather than silently diverging.

QRSPI carries one feature from a vague ticket to a pull request through eight phases:

> **Q**uestions → **R**esearch → **D**esign → **S**tructure → **P**lan → **W**orkTree → **I**mplement → **PR**

(plus a pre-phase **ticket** capture). The first five phases are *alignment*; the last three are
*execution*. The value comes from **human review gates between phases**, so the artifacts exist to be
reviewed: they are **structured and cited, not narrative**.

---

## 1. The artifact tree

Per feature, everything lives under `.qrspi/<feature-slug>/`, **committed to git** (the alignment
docs are part of the feature's own PR — reviewable team alignment).

```
.qrspi/<feature-slug>/
  state.json         # phase status + human approvals (the coordination medium)
  ticket.md          # the user's request, captured verbatim-in-intent — HIDDEN from the researcher
  questions.md       # technical questions derived from the ticket
  research.md        # ticket-blind factual map; every claim cited path:line
  design.md          # current state / desired end state / design decisions
  structure.md       # signatures + new types + the vertical-slice table (checkpoint per slice)
  plan.md            # tactical steps, each linked to a structure slice
  worktree.md        # task/branch hierarchy, one testable unit per branch
  implement.md       # per-slice progress log + checkpoint result (the implement phase also edits CODE)
  pr.md              # PR description + self-review notes (drafted for the human, who owns the PR)
```

**`<feature-slug>`** is kebab-case derived from the ticket (e.g. `add-csv-export`).

### File-name convention — UNPREFIXED

File names carry **no numeric ordering prefix** (`research.md`, never `03-research.md`). Order is
conveyed by `state.json` and by `PHASE_ORDER` in `scripts/qrspi-state.mjs` — never by file names.
Each phase writes exactly one primary artifact named `<phase>.md` (the `implement` and `pr` phases
also touch code; see §5).

---

## 2. `state.json` — the coordination medium

Phases never share live context. They hand off through files, and `state.json` records where the
human is in the gate sequence. **Do not hand-edit it** — the skills mutate it through
`scripts/qrspi-state.mjs`, which is the one place the gate rule lives.

```json
{
  "feature": "add-csv-export",
  "createdAt": "<iso-8601>",
  "phases": {
    "ticket":    { "status": "approved", "artifact": "ticket.md", "approvedAt": "<iso>" },
    "questions": { "status": "produced", "artifact": "questions.md" },
    "research":  { "status": "pending" }
  },
  "currentSlice": null
}
```

### The status enum (exactly these four — no synonyms)

| status | meaning |
| --- | --- |
| `pending` | the phase has not run yet |
| `produced` | the agent wrote the artifact; **awaiting human review** |
| `approved` | the human reviewed it and moved on (proceeding past the gate **is** the approval) |
| `rejected` | the human rejected it; the phase must be redone before anything downstream runs |

### The gate rule (the single rule that enforces human-in-the-loop)

> A phase may run only when its **predecessor is at least `produced`**. Running phase N records
> N−1 as `approved` (the human reviewed it in the gap) and, after the agent writes the artifact,
> records N as `produced`.

This is implemented, not narrated. A skill opens its gate with:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs gate <slug> <phase> --root <repo-root>
```

which exits non-zero and names the missing predecessor if the gate is closed, and otherwise
approves the predecessor. After its agent writes the artifact, the skill records it with:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/qrspi-state.mjs record <slug> <phase> --artifact <phase>.md --root <repo-root>
```

To redo a phase after review ("brain surgery"), the human edits the artifact directly or re-runs
that phase's skill; `record` resets the phase to `produced` so it is re-reviewed.

---

## 3. Grounding — cite or flag (a convention, not an enforced check)

There is **no automated verification in the MVP** (mvp-plan §9.4). The human reviewing each gate is
the check, so the artifacts must make review easy by being honest about what is grounded:

- A claim about how the code behaves **must cite its source** as `path:line` (or `path:line-line`),
  relative to the repo root — e.g. `src/reports/export.ts:42`.
- A statement you could **not** ground in the source must be flagged **`[UNVERIFIED]`** inline —
  never asserted silently. An assumption is fine *if labelled*; a guess dressed as a fact is not.
- "I don't know" / `[UNKNOWN]` is an acceptable, valuable answer. Prefer it to invention.

The **researcher** is held to this most strictly: `research.md` is a factual map, every line either
cited or flagged, with **no opinions or recommendations**.

---

## 4. The ticket withhold (the firewall against the plan-reading illusion)

`ticket.md` is **never** passed to the researcher. The `qrspi-research` skill dispatches the
researcher with `questions.md` **only**. The researcher answers the questions blind to the desired
feature, so the factual map can't be bent toward a hoped-for conclusion. Any artifact that echoes
the ticket text into the researcher's input breaks this firewall — don't.

---

## 5. Artifact templates (the required shape of each document)

Every artifact starts with a one-line H1 naming the feature and phase, then the sections below.
Sections are **required headings** (a downstream skill / the L0 tests check for them). Keep prose
tight; prefer tables, signatures, and lists over paragraphs.

### `ticket.md`
- `## Request` — the user's ask, captured as a *request*, not a solution. No premature design.
- `## Intent` — the underlying goal in one or two sentences (the "why").
- `## Out of scope` — what this ticket is explicitly **not**, if known (else `none stated`).

### `questions.md`
- `## Questions` — a numbered list of concrete technical questions whose answers force the next
  phase to touch every relevant area of the code. Each question is answerable from the source.

### `research.md` (ticket-blind, cited)
- `## Findings` — answers to the questions as a **factual map**, every claim `path:line`-cited or
  `[UNVERIFIED]`-flagged. No recommendations.
- `## Open questions` — anything the source did not answer, flagged `[UNKNOWN]`.

### `design.md`
- `## Current state` — how it works today (grounded in research).
- `## Desired end state` — the target behavior.
- `## Design decisions` — the choices and their rationale; trade-offs made explicit.

### `structure.md`
- `## Signatures & types` — new/changed function signatures and type definitions.
- `## Vertical slices` — a **required table** of independently testable slices, each with a
  checkpoint. Columns: `slice | description | touches | checkpoint`. Slices are **vertical**
  (a thin end-to-end path), not horizontal layers.

### `plan.md`
- `## Steps` — tactical steps, each tagged with the `slice` it belongs to and constrained by the
  approved design/structure.

### `worktree.md`
- `## Branches` — slice → branch/task mapping, one independently testable unit per branch.

### `implement.md` (the implement phase also edits **code**)
The implement phase is the first to touch source. It builds **one vertical slice per invocation**,
runs that slice's checkpoint, and logs the outcome here so the human's hard gate has something
committed to review alongside the diff.
- `## Slices` — one `### slice <id>` subsection per slice built, each stating what changed, the
  files touched (`path:line` where useful), and the **checkpoint result** (the command run + whether
  it passed). Re-running a slice replaces its subsection rather than appending a duplicate.

### `pr.md` (the pr phase reads the **diff**; the human owns the PR)
A draft the human edits and pastes — the pr phase **never pushes or opens a PR** (mvp-plan §13).
- `## Summary` — what the change does and why, in a sentence or two.
- `## Changes` — the notable edits, grouped by area (cite `path:line`).
- `## Test plan` — how the change was verified (the slice checkpoints that ran).
- `## Self-review notes` — risks, follow-ups, and anything the human reviewer should scrutinize.

---

## 6. Agent / skill discipline

- **Skills are thin.** A phase skill only: opens its gate (script), dispatches its agent with the
  allowed inputs, records the artifact (script), and tells the human what to review and run next.
  If a skill starts explaining *how* to research or design, that text belongs in the agent prompt.
- **Agents carry the substance** and are single-responsibility. Each agent reads this contract
  first and obeys it.
- **Only `qrspi-implementer` edits code.** Every phase from ticket through worktree is
  read / analyse / write-doc only — this keeps blast radius contained.
- **No magic words.** The correct alignment behavior is each agent's *default*. The user passes a
  plain description; there are **zero required trigger phrases**.
