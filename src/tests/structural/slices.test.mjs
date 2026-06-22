// L0 structural: the M2 plan-rigor invariants (mvp-plan §5, conventions §5).
// Structure MUST express the work as a vertical-slice table with a checkpoint per slice; Plan MUST
// tag every tactical step with the slice it belongs to. These are what make the plan spot-checkable
// and the work independently testable, so we pin them at the definition level.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { read, dir, parseFrontmatter } from "../lib/plugin.mjs";

test("the structure skill exists and dispatches the structurer", () => {
  assert.ok(existsSync(dir("skills", "qrspi-structure", "SKILL.md")), "skills/qrspi-structure/SKILL.md");
  const { body } = parseFrontmatter(read("skills", "qrspi-structure", "SKILL.md"));
  assert.match(body, /qrspi:qrspi-structurer/, "must dispatch the structurer");
});

test("the structurer agent mandates a vertical-slice table with a checkpoint per slice", () => {
  const { body } = parseFrontmatter(read("agents", "qrspi-structurer.md"));
  assert.match(body, /vertical slice/i, "must require vertical slices");
  assert.match(body, /checkpoint/i, "each slice needs a checkpoint");
  // the slice table's columns (conventions §5: slice | description | touches | checkpoint)
  for (const col of ["slice", "description", "touches", "checkpoint"]) {
    assert.match(body, new RegExp(`\\b${col}\\b`, "i"), `slice table must define the '${col}' column`);
  }
  // vertical (end-to-end), explicitly NOT horizontal layers
  assert.match(body, /horizontal/i, "must contrast vertical slices against horizontal layers");
});

test("the plan skill exists and dispatches the planner", () => {
  assert.ok(existsSync(dir("skills", "qrspi-plan", "SKILL.md")), "skills/qrspi-plan/SKILL.md");
  const { body } = parseFrontmatter(read("skills", "qrspi-plan", "SKILL.md"));
  assert.match(body, /qrspi:qrspi-planner/, "must dispatch the planner");
});

test("the planner agent ties every step to a slice", () => {
  const { body } = parseFrontmatter(read("agents", "qrspi-planner.md"));
  assert.match(body, /slice/i, "plan steps must reference slices");
  // each step is tagged/mapped to its slice
  const tagsStepsToSlices =
    /each step.{0,40}slice/i.test(body) || /step.{0,20}(tag|map|link)[a-z]*.{0,20}slice/i.test(body) ||
    /slice.{0,20}(per|for each|tag).{0,20}step/i.test(body);
  assert.ok(tagsStepsToSlices, "planner must map each step to its slice");
});

test("the structurer is constrained by the approved design (its input)", () => {
  const { body } = parseFrontmatter(read("skills", "qrspi-structure", "SKILL.md"));
  assert.match(body, /design\.md/, "structurer is given design.md");
});

test("the planner is constrained by the approved structure (its input)", () => {
  const { body } = parseFrontmatter(read("skills", "qrspi-plan", "SKILL.md"));
  assert.match(body, /structure\.md/, "planner is given structure.md");
});
