// L0 structural: every agent prompt is well-formed and obeys the cross-cutting conventions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { read, parseFrontmatter, agentFiles } from "../lib/plugin.mjs";

const files = agentFiles();

test("there is at least one agent", () => {
  assert.ok(files.length >= 1, "expected agents/*.md");
});

for (const file of files) {
  const slug = file.replace(/\.md$/, "");

  test(`agent ${file}: front-matter has name/description/tools/model`, () => {
    const { frontmatter } = parseFrontmatter(read("agents", file));
    assert.ok(frontmatter, "has YAML front-matter");
    assert.equal(frontmatter.name, slug, "name matches file name");
    assert.ok(frontmatter.description && frontmatter.description.length > 20, "real description");
    assert.ok(frontmatter.tools, "declares tools");
    assert.ok(frontmatter.model, "declares model");
  });

  test(`agent ${file}: instructs reading the conventions contract`, () => {
    const { body } = parseFrontmatter(read("agents", file));
    assert.match(body, /qrspi-conventions\.md/, "points the agent at the contract");
  });
}

test("only the implementer agent is allowed to edit code (Edit/Write-on-code)", () => {
  // Doc-only phases must not carry the Edit tool. (The implementer arrives in M3.)
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    if (slug === "qrspi-implementer") continue;
    const { frontmatter } = parseFrontmatter(read("agents", file));
    const tools = (frontmatter.tools || "").split(",").map((t) => t.trim());
    assert.ok(!tools.includes("Edit"), `${slug} must not have the Edit tool (doc-only phase)`);
  }
});
