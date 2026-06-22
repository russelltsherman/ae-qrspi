# agentic qrspi

A Claude Code plugin implementing **QRSPI** — a multi-phase coding pipeline that
carries a feature from ticket to pull request through multiple phases:

> **Q**uestions → **R**esearch → **D**esign → **S**tructure → **P**lan → **W**orkTree → **I**mplement → **PR**

(plus a pre-phase **ticket** capture). The first five phases are *alignment*; the last three are
*execution*. Each phase is a thin **skill** wrapping a single-responsibility **agent**, and phases
never share a live context — they hand off through committed artifacts under `.qrspi/<feature-slug>/`,
coordinated by a `state.json`. A human review gate sits between every phase; nothing auto-advances.

## Install

This repo is a Claude Code plugin marketplace (`ae-qrspi`) exposing the `qrspi` plugin.
From inside Claude Code, add the marketplace and install the plugin:

```
/plugin marketplace add russelltsherman/ae-qrspi
/plugin install qrspi@ae-qrspi
```

`/plugin marketplace add` also accepts the full clone URL
(`https://github.com/russelltsherman/ae-qrspi.git`) or a local path to a checkout
(`/plugin marketplace add ./ae-qrspi`) if you've already cloned it.

After installing, restart Claude Code (or run `/plugin` to confirm) and the
`/qrspi-*` commands below become available. Update later with:

```
/plugin marketplace update ae-qrspi
```

## Commands

| Phase | Command | Output |
| --- | --- | --- |
| Ticket | `/qrspi-ticket <description>` | `ticket.md` |
| Questions | `/qrspi-questions [slug]` | `questions.md` |
| Research | `/qrspi-research [slug]` | `research.md` (ticket withheld) |
| Design | `/qrspi-design [slug]` | `design.md` |
| Structure | `/qrspi-structure [slug]` | `structure.md` (vertical-slice table) |
| Plan | `/qrspi-plan [slug]` | `plan.md` |
| WorkTree | `/qrspi-worktree [slug]` | `worktree.md` (slice → branch map) |
| Implement | `/qrspi-implement <slug> <slice>` | code + tests + `implement.md` (one slice/run) |
| PR | `/qrspi-pr [slug]` | `pr.md` (drafted PR description; never pushes) |

See [`docs/user-guide.md`](./docs/user-guide.md) for the full walkthrough and
[`docs/qrspi-conventions.md`](./docs/qrspi-conventions.md) for the artifact contract.

## Tests

Three layers, only the first is free (mvp-plan §11):

```
npm test              # L0 structural + the free eval pieces (~ms) — frontmatter, gate logic, invariants
npm run test:behavior # L1 behavioral — drives each skill headless against a fixture (spends tokens)
npm run test:eval     # L2 rubric grading — LLM-judges fresh artifacts on qualitative bars (spends tokens)
npm run test:routing  # L2 routing probes — natural-language triggering, "no magic words" (spends tokens)
```

L1/L2 need the `claude` CLI with the qrspi plugin installed. See
[`tests/eval/README.md`](./tests/eval/README.md) for the rubric/routing details and the sandbox
caveat about skill-creator's triggering optimizer.
