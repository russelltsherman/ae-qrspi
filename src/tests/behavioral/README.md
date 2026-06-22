# Behavioral (L1) tests — how to run them

These tests drive the QRSPI skills through **headless Claude Code** (`claude -p`) against a
throwaway copy of the fixture app, then assert deterministic facts about the artifacts produced
(see `mvp-plan.md` §11). They cost tokens and need the `claude` CLI with the `qrspi` plugin enabled.

## Run them from a PLAIN shell — not from inside a Claude Code session

Each test spawns a nested `claude -p`. Every `claude` process reads and writes the **shared global
config** `~/.claude.json`. If two `claude` processes write it at once, it gets corrupted (Claude
backs it up and recreates a stub, but you lose your config state).

Two consequences:

1. **Run from a standalone terminal**, not from within an active `claude` session. A nested run
   racing the outer session's config writes corrupts `~/.claude.json`.
2. **Run serially.** `npm run test:behavior` already passes `--test-concurrency=1` so the test
   files run one at a time instead of in parallel — keep it that way; parallel nested `claude`
   processes are the main corruption trigger.

```bash
# from a normal shell, in plugins/qrspi:
npm run test:behavior          # all L1 tests, serial
QRSPI_TEST_LIVE=1 node --test tests/behavioral/research-withhold.live.test.mjs   # just one
```

If `QRSPI_TEST_LIVE` is unset (or `claude` is not on PATH) every test here self-skips, so a bare
`npm test` stays green and free.

## What each test proves

- `research-withhold.live.test.mjs` — **the firewall**: a canary + distinctive phrase seeded only in
  `ticket.md` must never appear in the ticket-blind researcher's `research.md`.
- `design-no-magic-words.live.test.mjs` — a bare ticket still yields a real design discussion.
- `structure-slices.live.test.mjs` — Structure emits a vertical-slice table with checkpoints.
- `plan-slices.live.test.mjs` — Plan tags every step with its slice.
- `ticket.live.test.mjs` — `/qrspi-ticket` writes a structured, solution-free ticket.

If you recover the config helper invocation `qrspi-state.mjs`, note it exposes `init | gate |
record` only (status/read were intentionally removed).
