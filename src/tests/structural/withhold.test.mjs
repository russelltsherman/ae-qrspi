// L0 structural: the ticket-withhold firewall (mvp-plan §5, conventions §4) expressed as a
// deterministic check on the research skill's definition. This is the single most important
// mechanism in QRSPI: the researcher must be dispatched with questions.md ONLY, never ticket.md,
// so the factual map can't be bent toward the desired feature.
//
// This proves the firewall at the *definition* level (what the skill instructs). The runtime proof
// — the ticket text never appearing in the researcher's transcript — is the L1 behavioral test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { read, dir, parseFrontmatter } from "../lib/plugin.mjs";

const researchSkill = dir("skills", "qrspi-research", "SKILL.md");

test("the research skill exists", () => {
  assert.ok(existsSync(researchSkill), "expected skills/qrspi-research/SKILL.md");
});

test("research skill dispatches the researcher agent", () => {
  const { body } = parseFrontmatter(read("skills", "qrspi-research", "SKILL.md"));
  assert.match(body, /qrspi:qrspi-researcher/, "must dispatch the researcher");
});

test("research skill passes questions.md as the researcher's input", () => {
  const { body } = parseFrontmatter(read("skills", "qrspi-research", "SKILL.md"));
  assert.match(body, /questions\.md/, "researcher's input is questions.md");
});

test("research skill states the withhold explicitly (ticket is never passed to the researcher)", () => {
  const { body } = parseFrontmatter(read("skills", "qrspi-research", "SKILL.md"));
  // Some sentence must forbid passing the ticket — e.g. "never pass ticket.md" / "ticket is withheld".
  const forbidsTicket =
    /never[^.]*ticket\.md/i.test(body) ||
    /ticket[^.]*withh/i.test(body) ||
    /withh[^.]*ticket/i.test(body);
  assert.ok(forbidsTicket, "research skill must explicitly state the ticket is withheld");
});

test("the researcher agent works ticket-blind (does not have or request the ticket)", () => {
  const { body } = parseFrontmatter(read("agents", "qrspi-researcher.md"));
  assert.match(body, /ticket/i, "researcher must acknowledge it has no ticket");
  const blind = /(without|no access to|do not have|never).{0,40}ticket/i.test(body) ||
    /ticket.{0,40}(withheld|not given|unavailable)/i.test(body);
  assert.ok(blind, "researcher prompt must establish it is ticket-blind");
});

test("the designer skill DOES pass the ticket (withhold applies only to research)", () => {
  // Sanity: the firewall is specific to the researcher; the designer needs the ticket back.
  const { body } = parseFrontmatter(read("skills", "qrspi-design", "SKILL.md"));
  assert.match(body, /ticket\.md/, "designer is given research.md + ticket.md");
  assert.match(body, /research\.md/, "designer is given research.md + ticket.md");
});
