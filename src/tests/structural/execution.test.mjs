// L0 structural: the M3 execution-phase invariants (mvp-plan §5, §12, §13; conventions §5, §6).
// WorkTree maps slices to branches; Implement edits code ONE slice at a time and runs the
// checkpoint; PR drafts a description WITHOUT pushing. These are the load-bearing properties of the
// execution half, so we pin them at the definition level (no model calls).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { read, dir, parseFrontmatter } from "../lib/plugin.mjs";

// ---- WorkTree ---------------------------------------------------------------------------------

test("the worktree skill exists and dispatches the worktree agent", () => {
  assert.ok(existsSync(dir("skills", "qrspi-worktree", "SKILL.md")), "skills/qrspi-worktree/SKILL.md");
  const { body } = parseFrontmatter(read("skills", "qrspi-worktree", "SKILL.md"));
  assert.match(body, /qrspi:qrspi-worktree/, "must dispatch the worktree agent");
  assert.match(body, /plan\.md/, "worktree is given the approved plan");
});

test("the worktree agent maps each slice to one independently testable branch", () => {
  const { body } = parseFrontmatter(read("agents", "qrspi-worktree.md"));
  assert.match(body, /## Branches/, "writes the Branches section");
  assert.match(body, /slice/i, "maps slices");
  assert.match(body, /branch/i, "maps to branches/tasks");
  assert.match(body, /one (independently )?testable unit per branch/i, "one testable unit per branch");
});

// ---- Implement --------------------------------------------------------------------------------

test("the implement skill exists, dispatches the implementer, and takes a slice id", () => {
  assert.ok(existsSync(dir("skills", "qrspi-implement", "SKILL.md")), "skills/qrspi-implement/SKILL.md");
  const { body } = parseFrontmatter(read("skills", "qrspi-implement", "SKILL.md"));
  assert.match(body, /qrspi:qrspi-implementer/, "must dispatch the implementer");
  assert.match(body, /slice id|slice\s+id|<slice>/i, "takes a slice id");
  assert.match(body, /--slice/, "records the slice into state (currentSlice)");
});

test("the implement skill builds one slice per run", () => {
  const { body } = parseFrontmatter(read("skills", "qrspi-implement", "SKILL.md"));
  assert.match(body, /one slice per run/i, "must constrain to one slice per invocation");
});

test("the implementer is the ONLY agent with the Edit tool", () => {
  const { frontmatter } = parseFrontmatter(read("agents", "qrspi-implementer.md"));
  const tools = (frontmatter.tools || "").split(",").map((t) => t.trim());
  assert.ok(tools.includes("Edit"), "implementer must carry Edit (it is the code-editing phase)");
  assert.ok(tools.includes("Bash"), "implementer needs Bash to run the checkpoint");
});

test("the implementer builds one slice and runs its checkpoint", () => {
  const { body } = parseFrontmatter(read("agents", "qrspi-implementer.md"));
  assert.match(body, /one (vertical )?slice/i, "scoped to a single slice");
  assert.match(body, /checkpoint/i, "runs the slice's checkpoint");
  // honesty: must not weaken/fake the checkpoint
  assert.match(body, /(do not|never).{0,80}(weaken|paper over|force)/is, "must forbid faking a passing checkpoint");
});

// ---- PR ---------------------------------------------------------------------------------------

test("the pr skill exists and dispatches the reviewer", () => {
  assert.ok(existsSync(dir("skills", "qrspi-pr", "SKILL.md")), "skills/qrspi-pr/SKILL.md");
  const { body } = parseFrontmatter(read("skills", "qrspi-pr", "SKILL.md"));
  assert.match(body, /qrspi:qrspi-reviewer/, "must dispatch the reviewer");
});

test("the pr phase never pushes or opens a PR (human owns it)", () => {
  const skill = parseFrontmatter(read("skills", "qrspi-pr", "SKILL.md")).body;
  const agent = parseFrontmatter(read("agents", "qrspi-reviewer.md")).body;
  for (const [label, body] of [["skill", skill], ["agent", agent]]) {
    assert.match(body, /(never|do not|not).{0,40}(push|open|create).{0,20}(a )?PR/is,
      `pr ${label} must state it does not push/open a PR`);
  }
});

test("the reviewer cannot edit code (only the implementer may)", () => {
  const { frontmatter } = parseFrontmatter(read("agents", "qrspi-reviewer.md"));
  const tools = (frontmatter.tools || "").split(",").map((t) => t.trim());
  assert.ok(!tools.includes("Edit"), "reviewer must not have Edit");
});
