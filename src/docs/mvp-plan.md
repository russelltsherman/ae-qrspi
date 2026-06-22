# QRSPI MVP Plan

Status: **DRAFT for review** — this is a plan, not an implementation.
Source idea: [`from-rpi-to-qrspi.md`](./from-rpi-to-qrspi.md) (Alex Lavaee, summarizing Dex Horthy's QRSPI/CRISPY framework).
Target: a Claude Code plugin (`plugins/qrspi`) whose harness is **agent prompts** (the substance) wrapped by **skills** (thin invokers), coordinating through **filesystem artifacts**.

---

## 1. What we are building and why

QRSPI is an eight-phase pipeline that carries a feature from a vague ticket to a pull request:

> **Q**uestions → **R**esearch → **D**esign → **S**tructure → **P**lan → **W**orkTree → **I**mplement → **PR**

The first five phases are *alignment* (get the agent's understanding correct before any code is planned); the last three are *execution*. The pipeline exists to defeat three failure modes that killed the simpler Research-Plan-Implement workflow at scale. The MVP is judged on whether it defeats those three failures — not on feature count.

### The three failures QRSPI must defeat (our acceptance lens)

| Failure (from the article) | What it looks like | The mechanism the MVP provides |
| --- | --- | --- |
| **Instruction budget overflow** (~150–200 instr. ceiling; RPI hit 85+ in one prompt and silently dropped buried steps) | Agent appears to follow the workflow but quietly skips constraints | Split work across phases; keep each agent prompt single-responsibility and short (a soft guideline, see §2) |
| **Magic-words dependency** (correct behavior required a secret incantation) | Without exact phrasing, the agent skips the alignment conversation | Each agent's *default* behavior is the correct behavior; **zero required trigger phrases** |
| **Plan-reading illusion** (a plan that reads well but builds wrong) | Human approves convincing prose; architectural debt accrues underneath | Artifacts are **structured and cited, not narrative**; hard human review gates after Research/Design/Structure |

Everything below traces back to this table (see §8).

---

## 2. Design principles → concrete mechanisms

The article's principles, translated into what we actually build for the MVP.

1. **Instruction budget is a soft guideline.** Each phase agent is single-responsibility and kept short, but this is a discipline for the author, **not an enforced check** — there is no instruction-count linting or verification in the MVP. The real test that an agent follows its prompt is the end-to-end dry run.
2. **No magic words.** Skills pass a plain ticket/feature description. The correct alignment behavior (e.g. "discuss before planning") is baked into each agent's default prompt, not requested by the user.
3. **Structured, not narrative.** Research claims cite `path:line`; Design/Structure/Plan use fixed templates (sections, signatures, slice tables) rather than free prose. Citation is an **output convention**, not an automated verification step — the human reviewing the gate is the check.
4. **Context firewalls are a soft guideline.** Each phase *can* run as a fresh sub-agent (its own context window), and phases hand off through files so fresh sessions are always possible. But the 40/60 context rule is **monitored and managed by the operating human**, not enforced by the harness — the human decides when to start a fresh session.
5. **Vertical slices over horizontal layers.** The Structure phase is *required* to express the work as independently testable vertical slices (e.g. mock API → front end → DB) with a checkpoint per slice. WorkTree and Implement iterate per slice.
6. **Filesystem is the coordination medium.** Phases never share live context. They hand off through `.qrspi/<feature-slug>/` artifacts and a `state.json`. This is what makes fresh sessions and resume possible.
7. **Human-in-the-loop is not optional.** The article's value comes from human gates: review the research map, perform "brain surgery" on the design, spot-check the plan, own the PR. The MVP **stops at each gate** and never auto-advances past one. With verification dropped (§9), these human gates *are* the quality mechanism.

---

## 3. Architecture

Two layers (settled, §9), matching the user's directive ("agent prompts + skills as thin wrappers") and the sibling `port-spec-panel` plugin's proven shape.

```
skills/        ONE thin wrapper PER PHASE; manages state, checks the gate, dispatches its agent
agents/        the QRSPI phase prompts — single-responsibility, one job each
.qrspi/<slug>/ per-feature artifacts + state.json   (COMMITTED to git — reviewable team alignment)
docs/          this plan, the source article, and a conventions contract
tests/         fixtures + structural/behavioral tests for the prompts and skills (§11)
```

- **Per-phase skills (decision #2).** There is no central orchestrator. Each phase is its own skill the user invokes in its own (typically fresh) session — the purest form of the context-firewall principle, with the human managing context (§2.4). A skill is thin: resolve the feature dir, check `state.json`, dispatch its agent, present the artifact, record state. No phase domain logic in skills — that lives in the agent prompt.
- **Agents** carry all the substance. Each is a Markdown subagent definition (frontmatter `name`, `description`, `tools`) + a tight system prompt, invoked via the Agent/Task tool for a clean context window.
- **The gate is the session boundary.** Because phases are separate skill invocations, the human reviews each artifact *between* skills. Running phase N records phase N−1 as `approved` (proceeding *is* the approval); a phase refuses to run if its predecessor isn't at least `produced` and points the user to the missing step.
- **No verification/lint layer in the MVP** (decision #4). No runtime checks of user artifacts for instruction budget, citations, or plan coverage. (Tests of *our own prompts/skills* are separate — §11.)

---

## 4. Artifact layout & state

File names are intentionally unprefixed (no numeric ordering prefixes); order is conveyed by `state.json`, not file names.

Artifacts are **committed to git** (decision #3): the alignment docs become reviewable in the feature's own PR, which is much of their value to a team.

```
.qrspi/<feature-slug>/
  ticket.md          # the user's request, written by /qrspi-ticket — HIDDEN from the researcher
  questions.md       # technical questions derived from the ticket
  research.md        # ticket-blind factual map; every claim cited path:line (convention, human-reviewed)
  design.md          # current state / desired end state / design decisions (~200 lines)
  structure.md       # signatures, new types, and the vertical-slice table w/ checkpoints
  plan.md            # tactical steps, each linked to a structure slice
  worktree.md        # task hierarchy / branch-per-slice mapping
  state.json         # phase status + human approvals + notes
```

**`state.json` (minimal schema):**

```json
{
  "feature": "add-csv-export",
  "createdAt": "<iso>",
  "phases": {
    "questions":  { "status": "approved", "artifact": "questions.md", "approvedAt": "<iso>" },
    "research":   { "status": "produced", "artifact": "research.md" },
    "design":     { "status": "pending" }
  },
  "currentSlice": null
}
```

`status` ∈ `pending | produced | approved | rejected`. A phase agent may run only when the prior phase is `approved`. This single rule enforces the human gates and enables resume.

---

## 5. The agents

One pre-phase ticket agent + eight phase agents. For each: **input → output**, the design move that matters, and the human gate. All agents obey the conventions contract (§10).

| Agent | Input | Output | Key design move | Human gate after |
| --- | --- | --- | --- | --- |
| `qrspi-ticketer` | a sentence/paragraph from the user | `ticket.md` | Capture the *request*, not a solution — no premature design, so it can't bias Questions/Research | Light: confirm the ticket reflects intent |
| `qrspi-questioner` | `ticket.md` | `questions.md` | Convert a vague ticket into concrete technical questions that force the next phase to touch all relevant code | Light: confirm coverage |
| `qrspi-researcher` | `questions.md` **only** | `research.md` | **Ticket is withheld.** Produce a *cited factual map* answering the questions — no opinions, no recommendations | **Hard:** human reviews the map for accuracy |
| `qrspi-designer` | `research.md` + `ticket.md` | `design.md` | Brain-dump understanding: current state / desired end state / design decisions | **Hard:** "brain surgery" — redirect bad patterns |
| `qrspi-structurer` | `design.md` | `structure.md` | Define signatures/types + **mandatory vertical-slice table** with a checkpoint per slice | **Hard:** confirm slices are independently testable |
| `qrspi-planner` | `structure.md` | `plan.md` | Tactical steps, each tagged with its slice; constrained by already-approved design/structure | Light: **spot-check** only |
| `qrspi-worktree` | `plan.md` | `worktree.md` | Map slices to a branch/task hierarchy (one testable unit per branch) | Light |
| `qrspi-implementer` | `plan.md` + one slice | code + tests for that slice | Implements **one slice per fresh context**, runs its checkpoint | **Hard:** per-slice checkpoint passes |
| `qrspi-reviewer` | the diff | PR description + self-review notes | Assists review; **human reads and owns the code** | **Hard:** human approves the PR |

**Design notes**
- The **ticket withhold** (`qrspi-researcher`) is enforced by the `qrspi-research` skill: it dispatches the researcher with only `questions.md` in its prompt; `ticket.md` is never passed. This is the single most important mechanism against the plan-reading illusion.
- `qrspi-ticketer` and phases through WorkTree are read/analyze/write-doc only (no code edits). Only `qrspi-implementer` edits code. This keeps blast radius contained.

---

## 6. The skills (one thin wrapper per phase)

Per decision #2, every phase is its own skill. The user runs them one at a time, reviewing the artifact between invocations (the review *is* the gate). Each skill does the same four things: check the predecessor's state, dispatch its agent fresh with only the allowed inputs, write/record the artifact, and tell the human what to review and run next.

| Skill | Wraps agent | Notes |
| --- | --- | --- |
| `qrspi-ticket` | `qrspi-ticketer` | **Entry point.** Accepts a sentence/paragraph, creates `.qrspi/<slug>/`, seeds `state.json`, writes `ticket.md`. |
| `qrspi-questions` | `qrspi-questioner` | requires `ticket.md` |
| `qrspi-research` | `qrspi-researcher` | **dispatches with `questions.md` only — never `ticket.md`** (the withhold) |
| `qrspi-design` | `qrspi-designer` | |
| `qrspi-structure` | `qrspi-structurer` | must emit the vertical-slice table |
| `qrspi-plan` | `qrspi-planner` | |
| `qrspi-worktree` | `qrspi-worktree` | |
| `qrspi-implement` | `qrspi-implementer` | takes a slice id; one slice per run |
| `qrspi-pr` | `qrspi-reviewer` | |

**Gate mechanics (no orchestrator):** running phase N requires phase N−1 to be at least `produced`; on run it records N−1 as `approved` (proceeding = approval, because the human reviewed it in the gap) and sets N to `produced`. To redo a phase after review ("brain surgery"), the human edits the artifact directly or re-runs that phase's skill with feedback. Skipping is hard because each skill refuses to run without its predecessor and names the missing step.

**Why so thin:** all domain logic lives in agent prompts. If a skill starts explaining *how* to research or design, that text belongs in the agent. Skills only: check state, dispatch, record, point to next.

---

## 7. Control flow (one feature, happy path)

The human runs one skill per step, reviewing the artifact before invoking the next (ideally in a fresh session):

```
/qrspi-ticket "add CSV export to the reports page"  → ticket.md      ─► [review intent]
/qrspi-questions                                    → questions.md   ─► [review coverage]
/qrspi-research        (TICKET WITHHELD)            → research.md    ─► [HARD review]
/qrspi-design                                       → design.md      ─► [HARD: brain surgery]
/qrspi-structure                                    → structure.md   ─► [HARD: slices testable?]
/qrspi-plan                                         → plan.md        ─► [spot-check]
/qrspi-worktree                                     → worktree.md    ─► [review]
/qrspi-implement <slice>   (repeat per slice)       → code+tests     ─► [HARD: checkpoint]
/qrspi-pr                                           → PR description ─► [HARD: human owns PR]
```

Each `[...]` is the human reviewing between skill runs. Resume is implicit — every skill reads `state.json` and refuses to run ahead of its predecessor.

---

## 8. Failure-mode traceability (acceptance check)

With verification dropped, the failures are defeated **by design and proven by human review + the dry run**, not by scripts.

| RPI failure | How this MVP defeats it | How we know it holds |
| --- | --- | --- |
| Instruction budget | 8 single-responsibility agents; each prompt kept short (soft guideline) | Dry run: each agent produces its artifact without dropping its core steps |
| Magic words | Correct alignment behavior is each agent's default; skills pass a plain description | Dry run issues a bare ticket with no special phrasing and the design discussion still happens |
| Plan-reading illusion | Cited, structured (non-prose) artifacts; ticket withheld from researcher; hard human gates after R/D/S | Withhold check (researcher prompt is ticket-free) + the human gates catch wrong understanding before code |

---

## 9. Decisions (settled)

1. **MVP scope — all 8 phases.** Depth in the alignment phases, execution kept thin. MVP *boundary* at the end of M2 (validated plan); M3 (execution) is a fast follow.
2. **Orchestration — per-phase skills, no central orchestrator.** Each phase is its own skill, run in its own session; the human manages context (§2.4, §3, §6).
3. **`.qrspi/` artifacts — committed to git.** Alignment docs are reviewable in the feature PR (§4).
4. **Verification — out of scope for the MVP.** No runtime checking of user artifacts (citations, plan coverage, instruction budget). Possible post-MVP add-backs if human-only gating proves leaky: citation-resolution check, slice↔plan coverage check, adversarial `qrspi-verifier`.
5. **Gate-collapsing (8→~6) — out of scope for the MVP.** Keep all 8; revisit only with real usage evidence.

---

## 10. Conventions contract (build first)

Before any agent, write `docs/qrspi-conventions.md` — the single source of truth every agent must read (the `port-spec-conventions` precedent). It pins:
- the `.qrspi/<slug>/` tree and **unprefixed** file names;
- `state.json` schema and the "prior phase must be approved" rule;
- the cite-or-flag convention for research (`path:line`, or an explicit `[UNVERIFIED]` flag — never silent assertion), as a *convention*, not an enforced check;
- artifact templates (Design = current/desired/decisions; Structure = signatures + slice table; Plan = step→slice mapping).

This is what keeps the agents consistent.

---

## 11. How we TDD agent prompts and skills

Prompts run on a non-deterministic model, so we can't assert exact output. We TDD by asserting **invariants and structure** (deterministic), driving **behavior in headless Claude Code** against fixtures, and grading **quality with an LLM rubric** over repeated runs. The loop is genuine red→green→refactor: write the fixture + assertions first (red), write the prompt until they pass at the required rate (green), then **shorten the prompt while holding the rate** (refactor) — which is how we find the instruction budget empirically, recovering the benefit of the linting we dropped.

> Scope note: this tests *our own prompts/skills*. It is distinct from decision #4 (no runtime verification of the **user's** artifacts). The standing TDD directive is satisfied here, not violated by #4.

**No CI for the MVP.** Every layer is a plain local command a developer runs by hand (and is expected to run before committing). Default `npm test` is the fast, free, deterministic inner loop; the layers that cost tokens are opt-in commands so they're never triggered by accident.

**Layer 0 — Structural tests (deterministic, free, fast).** `node --test` over the plugin's own files: agent/skill frontmatter valid; each skill references an agent that exists; `plugin.json` enumerates everything; unprefixed file-name convention honored; each prompt contains its required sections. No model calls — runs in milliseconds.

**Layer 1 — Behavioral tests (headless, assertion-based, costs tokens).** Drive a skill/agent with `claude -p --output-format json` against a copy of the fixture repo in a temp dir, then assert *deterministic facts, never wording*, e.g.:
- the expected artifact was created and contains the template's required sections;
- **withhold invariant** — `qrspi-research` produced `research.md` AND the ticket text never appeared in the researcher's input/transcript;
- **no-magic-words invariant** — a bare ticket with zero special phrasing still yields a design discussion.
Run each N times; require a pass-rate threshold (invariants ≈100%). Opt-in via env so `npm test` never spends tokens.

**Layer 2 — Rubric / eval tests (LLM-as-judge, quality, costs tokens).** For properties not structurally checkable ("research stayed factual, no recommendations"; "slices are genuinely vertical"). For skills this is the **`skill-creator` eval loop** (used whenever a skill is created or substantially modified), giving rubric grading + variance analysis. Invoked locally on demand.

### Local test runner (the CLI surface)

```
tests/
  fixtures/sample-app/      # tiny committed sample repo the agents analyze
  fixtures/golden/          # expected sections / files per phase
  lib/                      # helpers: run a skill headless, read .qrspi state, parse artifacts
  structural/*.test.mjs     # Layer 0
  behavioral/*.test.mjs     # Layer 1 (skipped unless QRSPI_TEST_LIVE=1)
```

Commands (npm scripts in a minimal `package.json`; node's built-in test runner, no test deps):

| Command | Layer | Cost | When |
| --- | --- | --- | --- |
| `npm test` | L0 | free, ~ms | every save — the TDD inner loop |
| `npm run test:behavior` | L1 | tokens | before committing a prompt/skill change (sets `QRSPI_TEST_LIVE=1`) |
| `npm run test:eval` | L2 | tokens | when authoring/modifying a skill (delegates to `skill-creator`) |
| `npm run test:all` | L0+L1+L2 | tokens | pre-merge gate, run by hand |

`test:behavior` controls run count via `QRSPI_TEST_RUNS` (default low for cost). Behavioral tests `node --test --test-skip` themselves when `QRSPI_TEST_LIVE` is unset, so a bare `npm test` is always green and free.

**Fixtures:** the committed `tests/fixtures/sample-app` with golden expectations.
**Done per agent/skill** = L0 green + L1 invariants at threshold + L2 rubric ≥ bar, all run locally. **MVP done** = the above green through M2.

---

## 12. Milestones

| Milestone | Delivers | Done when |
| --- | --- | --- |
| **M0 — Scaffold** | conventions contract, `state.json` schema, `qrspi-ticket` skill, `qrspi-ticketer` agent, L0 test harness + fixture skeleton | `/qrspi-ticket` produces a clean `ticket.md`; L0 green; `state.json` seeded for the new feature |
| **M1 — Alignment core** | `qrspi-questions`/`-research`/`-design` skills + their agents; L1 withhold + no-magic-words tests | dry run produces cited research + a design doc; withhold invariant passes |
| **M2 — Plan rigor (★ MVP boundary)** | `qrspi-structure` (vertical slices) + `qrspi-plan` skills + agents | a spot-checkable plan with a slice table exists end-to-end; L0/L1 green through plan |
| **M3 — Execution** | `qrspi-worktree`/`-implement` (per-slice)/`-pr` skills + agents | trivial feature implemented one slice at a time with checkpoints; PR description generated |
| **M4 — Hardening** | L2 rubric/eval via `skill-creator`, README, more fixtures | L2 rubrics ≥ bar; README documents the flow |

Ship **M2 as the MVP**; M3–M4 are fast follows.

---

## 13. Non-goals (MVP)

- **No verification/lint layer** — no instruction-budget linting, citation checking, or plan-coverage checking (deferred, §9.4).
- **No CI** — TDD is required, but tests are run locally from the command line (§11); no pipeline wiring in the MVP.
- No automatic merging or pushing — human owns the PR.
- No multi-feature parallelism — one feature at a time.
- No model-tier auto-selection.
- No UI beyond the CLI artifacts and skill output.

---

## 14. Risks

- **Gate fatigue.** Eight phases with gates may feel heavy (the article's own "3→8 steps" pushback). *Mitigation:* light gates on ticket/questions/plan/worktree; only Research/Design/Structure/Implement/PR are hard. Revisit after the dry run.
- **No verification net.** With verification dropped, a plausible-but-wrong artifact relies entirely on the human catching it at a gate. *Mitigation:* structured templates + citations make review easier; re-add checks (§9.4) if human-only gating proves leaky.
- **Ticket-withhold leakage.** If any artifact echoes the ticket into the researcher's input, the firewall breaks. *Mitigation:* the dry run asserts the researcher prompt is ticket-free.
- **Context management is manual.** The 40/60 rule is on the human (§2.4); a long session can silently degrade. *Mitigation:* the per-phase skill model (decision #2) makes a clean start per phase the natural path; document fresh-session guidance.

---

## 15. Immediate next step (on approval)

All §9 decisions are settled. Start **M0**: write `docs/qrspi-conventions.md`, the `state.json` schema, the `qrspi-ticket` skill, the `qrspi-ticketer` agent, and the Layer-0 test harness + fixture skeleton — so the contract, entry point, and test scaffold exist before the alignment agents.
```
