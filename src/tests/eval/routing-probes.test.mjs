// Free unit tests for the routing-probe parser + probe table (no model calls). Run with: node --test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { firstRoutedSkill, PROBES } from "./routing-probes.mjs";
import { skillDirs } from "../lib/plugin.mjs";

test("firstRoutedSkill reads the routed skill from a Skill tool_use", () => {
  const stream = '...{"type":"tool_use","name":"Skill","input":{"skill":"qrspi:qrspi-ticket"}}...';
  assert.equal(firstRoutedSkill(stream), "qrspi-ticket");
});

test("firstRoutedSkill returns the FIRST route when several appear", () => {
  const stream = '"skill":"qrspi:qrspi-research" ... later "skill":"qrspi:qrspi-design"';
  assert.equal(firstRoutedSkill(stream), "qrspi-research");
});

test("firstRoutedSkill is null when nothing routed", () => {
  assert.equal(firstRoutedSkill('{"type":"text","text":"let me think"}'), null);
});

test("every probe targets a skill that actually exists", () => {
  const skills = new Set(skillDirs());
  assert.ok(PROBES.length >= 1, "has probes");
  for (const p of PROBES) {
    assert.ok(skills.has(p.expect), `probe targets ${p.expect} but no such skill dir`);
    assert.ok(!p.request.includes("/qrspi"), "probe request must not contain the slash command (no magic words)");
    assert.ok(!p.request.includes(p.expect), "probe request must not name the skill (no magic words)");
  }
});
