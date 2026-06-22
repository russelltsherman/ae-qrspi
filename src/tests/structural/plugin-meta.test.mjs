// L0 structural: the plugin manifest is well-formed and names itself correctly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { read } from "../lib/plugin.mjs";

test("plugin.json parses and identifies the qrspi plugin", () => {
  const meta = JSON.parse(read(".claude-plugin", "plugin.json"));
  assert.equal(meta.name, "qrspi");
  assert.ok(meta.version, "version is present");
  assert.ok(meta.description && meta.description.length > 20, "has a real description");
});

test("the conventions contract exists", () => {
  const text = read("docs", "qrspi-conventions.md");
  assert.match(text, /QRSPI Conventions/);
});
