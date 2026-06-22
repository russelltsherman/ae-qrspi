# Layer 2 — rubric & routing evals (mvp-plan §11)

L2 grades the things L0 (structural) and L1 (behavioral) can't: **qualitative** properties of the
agents' output and the **triggering** of the skills. Both spend tokens and need the `claude` CLI with
the qrspi plugin installed, so they are **opt-in** — a bare `npm test` never runs them.

| Command | What it does | Cost |
| --- | --- | --- |
| `npm test` | the free pieces here — `evals.json` shape, the grading math, the routing parser | free, ~ms |
| `npm run test:eval` | rubric-grades fresh artifacts (the hard-gate phases by default) | tokens |
| `npm run test:routing` | natural-language routing probes (no magic words) | tokens |

## Rubric grading (`grade.mjs` + `evals.json`)

Each case in [`evals.json`](./evals.json) names a phase, the fixture + seed state to run it from, and a
list of **expectations** — verifiable qualitative statements (e.g. *"the researcher made no
recommendations"*, *"each slice is a vertical end-to-end path, not a horizontal layer"*). For each
case the grader:

1. generates the artifact **fresh** through headless Claude Code (reusing the L1 harness in
   `tests/lib/headless.mjs`), then
2. asks a separate, **tool-less `claude -p` judge** to grade the artifact against the expectations and
   return `{verdicts:[{id,passed,evidence}]}` — folded into a `grading.json`-shaped summary with a
   `pass_rate`. A case is green at or above the `bar` (default `0.8`).

```
npm run test:eval                      # the hard-gate subset (research, design, structure)
QRSPI_EVAL_CASES=all  npm run test:eval # every case
QRSPI_EVAL_CASES=2,4  npm run test:eval # specific case ids
QRSPI_EVAL_BAR=0.9    npm run test:eval # raise the bar
```

The schema is aligned with skill-creator's `evals.json` / `grading.json` (`references/schemas.md` in
that plugin) so the cases stay portable.

## Routing probes (`routing-probes.mjs`)

The "no magic words" check at the routing layer: a **plain natural-language request** — no slash
command, no skill name — is fed to `claude -p` with all the real skills installed, and we read the
first `"skill":"qrspi:qrspi-<phase>"` the model routes to. Correct routing = the description
disambiguates without a magic incantation. Each probe runs in a **seeded temp repo** (the same
fixtures the rubric harness uses) so a mid-pipeline phase has the feature context it needs.

```
npm run test:routing        # all probes
node tests/eval/routing-probes.mjs 3   # first 3 (QRSPI_EVAL_LIVE=1 required)
```

> **Why seed the repo?** The first smoke run probed from a bare repo with no `.qrspi/<feature>/`
> present: the entry-point `qrspi-ticket` routed cleanly, but mid-pipeline probes like "produce a
> map for the add-csv-export feature" routed to nothing — there was no feature to act on, and those
> skills gate on a produced predecessor. Seeding the feature to each probe's pre-state makes the test
> measure the *description's* triggering power, not an empty repo. Routing of mid-pipeline phases is
> still inherently softer than the entry point (in normal use they're invoked by slash command after
> a gate review); treat a probe miss as a prompt to sharpen that skill's `description`, not a hard
> failure of the pipeline.

### Why not skill-creator's `run_eval.py`?

skill-creator's standard triggering optimizer (`scripts/run_eval.py` / `run_loop.py`) plants a temp
`.claude/commands/<name>.md` proxy and checks whether `claude -p` fires it. **That detector is
unreliable in this devcontainer** — it returns a uniform 0/3 even for queries that obviously match
the description (documented in the project memory `skill-creator-run-eval-invalid-in-sandbox`). The
`claude` CLI itself works fine, so we validate triggering with the direct routing probes above
instead — they exercise true head-to-head disambiguation with every competing skill present.
(`quick_validate.py` also fails here because `pyyaml` is missing; our L0 frontmatter checks cover
that ground.)

## Caveats

- L2 grades **non-deterministic** output. Treat a single run as a signal, not a verdict; raise
  `runs` (re-invoke) when you need variance. The `bar` is deliberately below 1.0.
- The judge is an LLM; a borderline expectation can swing. Keep expectations **specific and
  falsifiable** so the judge has little room to equivocate.
