// Tests for qrspi-state.mjs — run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHASE_ORDER,
  STATUS_VALUES,
  initState,
  gateCheck,
  recordProduced,
} from "./qrspi-state.mjs";

const NOW = "2026-06-22T00:00:00.000Z";

test("PHASE_ORDER is the QRSPI sequence, ticket first and pr last", () => {
  assert.deepEqual(PHASE_ORDER, [
    "ticket", "questions", "research", "design",
    "structure", "plan", "worktree", "implement", "pr",
  ]);
});

test("initState seeds every phase as pending with no slice", () => {
  const s = initState("add-csv-export", NOW);
  assert.equal(s.feature, "add-csv-export");
  assert.equal(s.createdAt, NOW);
  assert.equal(s.currentSlice, null);
  for (const phase of PHASE_ORDER) {
    assert.equal(s.phases[phase].status, "pending", `${phase} should start pending`);
  }
});

test("initState rejects a missing feature slug", () => {
  assert.throws(() => initState("", NOW), /feature/);
});

test("gateCheck: the entry phase (ticket) opens with no predecessor", () => {
  const s = initState("f", NOW);
  const res = gateCheck(s, "ticket", NOW);
  assert.equal(res.ok, true);
  assert.equal(res.blockedBy, null);
});

test("gateCheck: a phase is BLOCKED when its predecessor is still pending", () => {
  const s = initState("f", NOW);
  const res = gateCheck(s, "research", NOW); // questions still pending
  assert.equal(res.ok, false);
  assert.equal(res.blockedBy, "questions");
  assert.match(res.message, /qrspi-questions/);
  // input state is untouched
  assert.equal(s.phases.questions.status, "pending");
});

test("gateCheck: a produced predecessor is approved when the gate opens", () => {
  let s = initState("f", NOW);
  s = recordProduced(s, "ticket", "ticket.md");      // ticket produced
  s = recordProduced(s, "questions", "questions.md"); // questions produced
  const res = gateCheck(s, "research", NOW);
  assert.equal(res.ok, true);
  assert.equal(res.state.phases.questions.status, "approved");
  assert.equal(res.state.phases.questions.approvedAt, NOW);
});

test("gateCheck: an already-approved predecessor stays approved (idempotent)", () => {
  let s = initState("f", NOW);
  s = recordProduced(s, "ticket", "ticket.md");
  s = gateCheck(s, "questions", NOW).state; // approves ticket
  assert.equal(s.phases.ticket.status, "approved");
  const approvedAt = s.phases.ticket.approvedAt;
  // Re-running the gate must not flip or re-stamp an approved predecessor.
  const again = gateCheck(s, "questions", "2026-12-31T00:00:00.000Z");
  assert.equal(again.ok, true);
  assert.equal(again.state.phases.ticket.status, "approved");
  assert.equal(again.state.phases.ticket.approvedAt, approvedAt);
});

test("gateCheck: a rejected predecessor blocks the gate", () => {
  let s = initState("f", NOW);
  s = recordProduced(s, "ticket", "ticket.md");
  s.phases.ticket.status = "rejected";
  const res = gateCheck(s, "questions", NOW);
  assert.equal(res.ok, false);
  assert.equal(res.blockedBy, "ticket");
});

test("gateCheck: unknown phase throws", () => {
  assert.throws(() => gateCheck(initState("f", NOW), "nope", NOW), /unknown phase/);
});

test("recordProduced sets status=produced and the artifact name", () => {
  const s = recordProduced(initState("f", NOW), "ticket", "ticket.md");
  assert.equal(s.phases.ticket.status, "produced");
  assert.equal(s.phases.ticket.artifact, "ticket.md");
});

test("recordProduced defaults the artifact to <phase>.md", () => {
  const s = recordProduced(initState("f", NOW), "design");
  assert.equal(s.phases.design.artifact, "design.md");
});

test("recordProduced leaves currentSlice untouched when no slice is given", () => {
  const s = recordProduced(initState("f", NOW), "worktree", "worktree.md");
  assert.equal(s.currentSlice, null);
});

test("recordProduced records the slice the implement phase just built", () => {
  // The execution phases run one slice at a time; recording carries the slice id so
  // state.currentSlice reflects where the human is in the slice sequence.
  const s = recordProduced(initState("f", NOW), "implement", "implement.md", "2");
  assert.equal(s.phases.implement.status, "produced");
  assert.equal(s.currentSlice, "2");
});

test("recordProduced overwrites currentSlice on the next slice", () => {
  let s = recordProduced(initState("f", NOW), "implement", "implement.md", "1");
  s = recordProduced(s, "implement", "implement.md", "2");
  assert.equal(s.currentSlice, "2");
});

test("recordProduced re-running an approved phase resets it to produced (needs re-review)", () => {
  let s = initState("f", NOW);
  s = recordProduced(s, "ticket", "ticket.md");
  s = gateCheck(s, "questions", NOW).state; // ticket -> approved
  s = recordProduced(s, "ticket", "ticket.md"); // brain surgery: redo ticket
  assert.equal(s.phases.ticket.status, "produced");
});

test("status enum is exactly the four documented values", () => {
  assert.deepEqual(STATUS_VALUES, ["pending", "produced", "approved", "rejected"]);
});
