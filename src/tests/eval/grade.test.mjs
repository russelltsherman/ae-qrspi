// Free unit tests for the L2 grader's deterministic pieces (no model calls): case selection,
// JSON extraction from a noisy judge reply, and the verdict→summary fold (including the
// missing-verdict-is-a-FAIL rule). Run with: node --test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEvals, selectCases, foldVerdicts, extractJson, judgeText } from "./grade.mjs";

test("evals.json loads with a bar and at least one hard-gate case", () => {
  const evals = loadEvals();
  assert.ok(typeof evals.bar === "number" && evals.bar > 0 && evals.bar <= 1, "bar is a fraction");
  assert.ok(evals.cases.length >= 1, "has cases");
  assert.ok(evals.cases.some((c) => c.hardGate), "at least one hard-gate (smoke) case");
  for (const c of evals.cases) {
    assert.ok(c.skill && c.phase && c.artifact, `case ${c.id} has skill/phase/artifact`);
    assert.ok(Array.isArray(c.expectations) && c.expectations.length >= 1, `case ${c.id} has expectations`);
  }
});

test("selectCases: default returns the hard-gate subset", () => {
  const evals = loadEvals();
  const sel = selectCases(evals, undefined);
  assert.ok(sel.length >= 1);
  assert.ok(sel.every((c) => c.hardGate), "default selection is the hard-gate subset");
});

test("selectCases: explicit ids and 'all'", () => {
  const evals = loadEvals();
  assert.deepEqual(selectCases(evals, "2,4").map((c) => c.id), [2, 4]);
  assert.equal(selectCases(evals, "all").length, evals.cases.length);
});

test("extractJson pulls a balanced object out of fenced/prose noise", () => {
  const reply = 'Sure!\n```json\n{"verdicts":[{"id":1,"passed":true,"evidence":"x"}]}\n```\nDone.';
  assert.deepEqual(extractJson(reply), { verdicts: [{ id: 1, passed: true, evidence: "x" }] });
});

test("extractJson handles nested braces in evidence", () => {
  const reply = '{"verdicts":[{"id":1,"passed":false,"evidence":"saw {a:1} literal"}]}';
  assert.equal(extractJson(reply).verdicts[0].passed, false);
});

test("judgeText pulls the result text from claude -p's stream-event ARRAY", () => {
  // This CLI version returns an array of events; the verdict JSON lives in the result event's text.
  const out = JSON.stringify([
    { type: "system", subtype: "init", tools: ["Skill"] },
    { type: "assistant", message: { content: [{ type: "text", text: "thinking" }] } },
    { type: "result", subtype: "success", result: '{"verdicts":[{"id":1,"passed":true}]}' },
  ]);
  assert.equal(judgeText(out), '{"verdicts":[{"id":1,"passed":true}]}');
  // extractJson on that text must reach the verdicts, NOT the system/init object.
  assert.equal(extractJson(judgeText(out)).verdicts[0].passed, true);
});

test("judgeText tolerates the single-object form too", () => {
  assert.equal(judgeText('{"result":"hello","type":"result"}'), "hello");
});

test("foldVerdicts computes the summary and treats a missing verdict as FAIL", () => {
  const exps = ["a", "b", "c"];
  const { expectations, summary } = foldVerdicts(exps, [
    { id: 1, passed: true, evidence: "yes" },
    { id: 2, passed: false, evidence: "no" },
    // id 3 missing on purpose
  ]);
  assert.equal(expectations[0].passed, true);
  assert.equal(expectations[2].passed, false, "missing verdict is a FAIL");
  assert.equal(expectations[2].evidence, "no verdict returned");
  assert.deepEqual(summary, { passed: 1, failed: 2, total: 3, pass_rate: 1 / 3 });
});

test("foldVerdicts: all-pass is pass_rate 1", () => {
  const { summary } = foldVerdicts(["a", "b"], [
    { id: 1, passed: true }, { id: 2, passed: true },
  ]);
  assert.equal(summary.pass_rate, 1);
});
