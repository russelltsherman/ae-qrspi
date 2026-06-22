# QRSPI User Guide

QRSPI is a multi-phase workflow for carrying a feature from a vague idea toward a pull request, with
a human review gate between phases. Phases don't share a live context window — they hand off through
files under `.qrspi/<feature-slug>/`, coordinated by a `state.json`. This guide covers the full
pipeline: capturing a feature as a ticket, the alignment phases —
**questions → research → design → structure → plan** — and the execution phases —
**worktree → implement → pr**.

## How it works

You run one phase at a time, each in its own (ideally fresh) Claude Code session, and **review the
artifact before running the next phase**. That review *is* the gate: a phase records its predecessor
as approved when you proceed, and refuses to run if its predecessor hasn't produced its artifact
yet. Nothing auto-advances.

## Prerequisites

- The `qrspi` plugin installed/enabled in Claude Code.
- **Node.js** on your PATH (the state/gate logic is a small Node script). Check with `node --version`.
- Run each skill from your **repository root** (the directory whose `.qrspi/` folder should hold the
  feature artifacts).

---

## Capture a feature as a ticket — `/qrspi-ticket`

This is the entry point. Give it a one-sentence or one-paragraph description of what you want.

```
/qrspi-ticket add CSV export to the reports page
```

What happens:

1. A short kebab-case **slug** is derived from your description (e.g. `add-csv-export`). That slug
   is the feature's folder name.
2. The workspace is seeded: `.qrspi/<slug>/state.json` is created. (If a feature with that slug
   already exists, you'll be asked whether to reuse it or pick a new slug — nothing is overwritten.)
3. The `qrspi-ticketer` agent writes `.qrspi/<slug>/ticket.md` — your **request and its intent**,
   captured *without* a solution baked in.
4. You're told to review the ticket.

The result, `.qrspi/<slug>/ticket.md`, looks like:

```markdown
# add-csv-export — ticket

## Request
Add CSV export to the reports page.

## Intent
Let users take report data out of the app for use in spreadsheets.

## Out of scope
none stated
```

**Your job after it runs:** read `ticket.md` and confirm it reflects what you actually want. If it
captured a solution instead of the request, or got the intent wrong, re-run `/qrspi-ticket` with a
clearer description, or edit `ticket.md` directly. Reviewing the ticket **is** the gate — there is
no auto-advance.

> The ticketer deliberately captures the *request*, not a design. It won't name files, functions, or
> libraries. Keeping the ticket solution-free is what stops it from biasing later analysis.

---

## Derive the technical questions — `/qrspi-questions`

Once you've reviewed the ticket, this turns it into the concrete technical questions that steer the
research phase.

```
/qrspi-questions add-csv-export
```

(The slug is optional if there's only one feature under `.qrspi/`.) It writes
`.qrspi/<slug>/questions.md` — a numbered list of source-answerable questions designed to make the
next phase examine every part of the code the feature will touch.

**Your job after it runs:** skim `questions.md` for coverage — does it ask about the right areas,
the existing tests, and the code that a change would ripple to? Add or sharpen questions by editing
the file directly. Then run `/qrspi-research`.

---

## Produce the cited factual map — `/qrspi-research`

This answers the questions with a **factual map of how the code works today** — every claim carrying
a `path:line` citation (or an explicit `[UNVERIFIED]`/`[UNKNOWN]` flag), and **no recommendations**.

```
/qrspi-research add-csv-export
```

It writes `.qrspi/<slug>/research.md`.

> **The ticket is withheld here.** The researcher is given `questions.md` only — never the ticket —
> so its map of the code can't be bent toward the feature you're hoping to build. This is the most
> important mechanism in QRSPI; it's why research runs as its own step.

**Your job after it runs — this is a hard gate.** Read `research.md` for accuracy: do the citations
actually say what's claimed? Are there silent assumptions presented as fact? Fix or flag anything
wrong before moving on, because everything downstream builds on this map. Then run `/qrspi-design`.

---

## Brain-dump the design — `/qrspi-design`

With the research reviewed, this produces a grounded design: how the code works now, the desired end
state, and the **design decisions with their trade-offs**. Here the ticket is back in play (the
withhold applied only to research).

```
/qrspi-design add-csv-export
```

It writes `.qrspi/<slug>/design.md` with `## Current state`, `## Desired end state`, and
`## Design decisions`.

**Your job after it runs — this is a hard gate ("brain surgery").** Challenge the decisions, redirect
any bad patterns, and resolve open questions the designer surfaced. Revise by editing `design.md`
directly or re-running `/qrspi-design`.

---

## Break the work into vertical slices — `/qrspi-structure`

With the design approved, this produces the concrete signatures/types and — the heart of this phase —
a **vertical-slice table**: the work split into thin, independently testable end-to-end paths, each
with its own checkpoint.

```
/qrspi-structure add-csv-export
```

It writes `.qrspi/<slug>/structure.md` with `## Signatures & types` and a `## Vertical slices` table
(columns: `slice | description | touches | checkpoint`).

**Your job after it runs — this is a hard gate.** Confirm the slices are genuinely *vertical* (each
one a thin path you could build and test on its own, not a horizontal layer like "all the types
first") and that every slice's checkpoint observes real behavior. Revise by editing `structure.md`
or re-running `/qrspi-structure`. Then run `/qrspi-plan`.

---

## Lay out the tactical steps — `/qrspi-plan`

This turns the approved structure into ordered, tactical steps — **each tagged with the slice it
belongs to** — so the work proceeds one verifiable slice at a time.

```
/qrspi-plan add-csv-export
```

It writes `.qrspi/<slug>/plan.md` with a `## Steps` list.

**Your job after it runs — spot-check.** Every step should trace to a slice from the structure; a
step with no slice is work that no checkpoint covers. Revise by editing `plan.md` or re-running
`/qrspi-plan`.

---

## Map slices to branches — `/qrspi-worktree`

With the plan reviewed, this turns the slice table into a **slice → branch/task map**: one
independently testable unit per branch, so each slice can be built and verified on its own.

```
/qrspi-worktree add-csv-export
```

It writes `.qrspi/<slug>/worktree.md` with a `## Branches` table (slice → branch, dependencies,
checkpoint). This phase still touches no code — it only lays out the work.

**Your job after it runs — review.** Check that every slice maps to exactly one branch and that the
ordering reflects real dependencies. Revise by editing `worktree.md` or re-running `/qrspi-worktree`.

---

## Build one slice at a time — `/qrspi-implement <slice>`

This is the **only** phase that edits code. It builds a **single slice** per run — the code plus its
tests — then runs that slice's checkpoint and reports whether it passed.

```
/qrspi-implement add-csv-export 1
```

The slice id is required (run it once per slice: `1`, then `2`, …). It edits the source and
writes/updates `.qrspi/<slug>/implement.md` — a per-slice log recording what changed and the
checkpoint result. `state.json`'s `currentSlice` tracks the slice you just built.

**Your job after it runs — this is a hard gate.** Review the diff and confirm the checkpoint actually
passed (the implementer reports the command it ran and the result). If it failed, fix it before
moving on. When the slice is good, run `/qrspi-implement <slug> <next-slice>` for the next one. The
implementer never pushes or commits — that stays with you.

---

## Draft the PR — `/qrspi-pr`

Once **all** slices are implemented and their checkpoints pass, this reads the diff and drafts a
structured PR description with self-review notes.

```
/qrspi-pr add-csv-export
```

It writes `.qrspi/<slug>/pr.md` with `## Summary`, `## Changes`, `## Test plan`, and
`## Self-review notes`. (Pass a base ref to diff against, e.g. `/qrspi-pr add-csv-export main`.)

**Your job after it runs — this is the final hard gate.** Read `pr.md` and the diff, then **create
the PR yourself**. QRSPI never pushes, commits, or opens a PR — you own the merge.

---

## Where the work lives

Everything for one feature lives under `.qrspi/<feature-slug>/`, and these files are meant to be
**committed to git** — the alignment artifacts become reviewable in the feature's own PR.

```
.qrspi/<feature-slug>/
  state.json     # phase status + approvals (don't hand-edit — the skills manage it)
  ticket.md      # the captured request
  questions.md   # the technical questions
  research.md    # the cited factual map
  design.md      # the design (current / desired / decisions)
  structure.md   # signatures/types + the vertical-slice table
  plan.md        # tactical steps, each tied to a slice
  worktree.md    # slice → branch/task map
  implement.md   # per-slice progress log + checkpoint results (this phase also edits code)
  pr.md          # the drafted PR description + self-review notes
```

The full contract — file-name conventions, the gate rule, and artifact templates — is in
[`qrspi-conventions.md`](./qrspi-conventions.md).

---

## Troubleshooting

- **`node: command not found`** — install Node.js; the state/gate logic needs it.
- **Wrong slug** — slugs are derived from your description. If you don't like the one chosen, re-run
  `/qrspi-ticket` with a clearer phrasing, or rename the `.qrspi/<slug>/` folder and the `feature`
  field in `state.json` together.
- **The ticket captured a solution, not a request** — that's a miss; re-run `/qrspi-ticket` with a
  description focused on *what* you want and *why*, not *how*.
