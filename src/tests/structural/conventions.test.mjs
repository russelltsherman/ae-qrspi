// L0 structural: the conventions contract and the state script agree, and the file-name
// convention (unprefixed) is honored where it is documented.
import { test } from "node:test";
import assert from "node:assert/strict";
import { read } from "../lib/plugin.mjs";
import { PHASE_ORDER, STATUS_VALUES } from "../../scripts/qrspi-state.mjs";

const contract = read("docs", "qrspi-conventions.md");

// The canonical artifact-tree block (the authoritative file list). We assert the unprefixed
// convention against THIS block, not the whole doc — the prose elsewhere teaches the rule by
// showing the forbidden form (`03-research.md`) as a negative example.
const artifactTree = contract.match(/```\n\.qrspi\/<feature-slug>\/([\s\S]*?)```/)?.[1] ?? "";

test("the contract has a canonical artifact-tree block", () => {
  assert.ok(artifactTree.length > 0, "expected a fenced .qrspi/<feature-slug>/ tree");
});

test("the contract documents every phase artifact, unprefixed", () => {
  for (const phase of PHASE_ORDER) {
    if (phase === "implement" || phase === "pr") continue; // these phases touch code, not a <phase>.md
    assert.match(artifactTree, new RegExp(`\\b${phase}\\.md\\b`), `tree should list ${phase}.md`);
    assert.doesNotMatch(artifactTree, new RegExp(`\\d+[-_]${phase}\\.md`), `${phase}.md must be unprefixed`);
  }
});

test("the contract documents the exact status enum the script uses", () => {
  for (const status of STATUS_VALUES) {
    assert.match(contract, new RegExp(`\`${status}\``), `contract should define status \`${status}\``);
  }
});

test("the contract states the gate rule (predecessor must be at least produced)", () => {
  assert.match(contract, /predecessor/i);
  assert.match(contract, /produced/);
});

test("the contract names the ticket withhold firewall", () => {
  assert.match(contract, /withhold/i);
  assert.match(contract, /research/i);
});

test("no agent or skill file uses a numeric ordering prefix", () => {
  // The unprefixed convention applies to our own files too.
  assert.doesNotMatch(read("docs", "qrspi-conventions.md"), /^\d+[-_]/m);
});
