// L0 structural: every skill is a thin, well-formed wrapper that dispatches a real agent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { read, dir, parseFrontmatter, skillDirs, agentFiles } from "../lib/plugin.mjs";

const skills = skillDirs();
const agents = new Set(agentFiles().map((f) => f.replace(/\.md$/, "")));

test("there is at least one skill", () => {
  assert.ok(skills.length >= 1, "expected skills/*/SKILL.md");
});

for (const slug of skills) {
  const path = dir("skills", slug, "SKILL.md");

  test(`skill ${slug}: SKILL.md exists with name/description front-matter`, () => {
    assert.ok(existsSync(path), "SKILL.md present");
    const { frontmatter } = parseFrontmatter(read("skills", slug, "SKILL.md"));
    assert.ok(frontmatter, "has front-matter");
    assert.equal(frontmatter.name, slug, "name matches directory");
    assert.ok(frontmatter.description && frontmatter.description.length > 20, "real description");
  });

  test(`skill ${slug}: references the conventions contract`, () => {
    const { body } = parseFrontmatter(read("skills", slug, "SKILL.md"));
    assert.match(body, /qrspi-conventions\.md/, "points at the contract");
  });

  test(`skill ${slug}: dispatches an agent that exists`, () => {
    const { body } = parseFrontmatter(read("skills", slug, "SKILL.md"));
    const refs = [...body.matchAll(/qrspi:(qrspi-\w+)/g)].map((m) => m[1]);
    assert.ok(refs.length >= 1, `${slug} should dispatch a qrspi:qrspi-* agent`);
    for (const agent of refs) {
      assert.ok(agents.has(agent), `${slug} references agent '${agent}' which has no agents/${agent}.md`);
    }
  });
}
