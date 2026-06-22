# tasks-app (QRSPI fixture)

A deliberately tiny in-memory task list, used as a **second** QRSPI behavioral/eval fixture so the
agents are exercised against more than one codebase (the first is `sample-app`, a reports app).

- `src/store.js` — the task domain: add/list tasks held in a module-level array. No persistence,
  no search, no priorities — those gaps are where QRSPI features land.
- `src/cli.js` — a thin command-line front end over the store (`add <text>`, `list`).

There is intentionally no storage layer, no search, and no IDs beyond an incrementing counter.
