// Build an ISOLATED HOME for nested `claude -p` runs so the L1 harness never shares (and never
// corrupts) the developer's real ~/.claude.json.
//
// Every `claude` process reads/writes the global config under $HOME. If a nested run shares $HOME
// with the outer session (or with a sibling nested run), concurrent writes corrupt ~/.claude.json.
// We sidestep that entirely by pointing the nested run's $HOME at a throwaway directory that carries
// only what's needed to boot, authenticate, and resolve the qrspi plugin — NOT the 1.2 GB of chat
// history. The qrspi plugin still loads from the live working tree (the marketplace registration is
// an absolute path), so the tests exercise the current code.
//
// SECURITY NOTE: this copies your auth token (.credentials.json) into a temp dir. It's for local
// test runs on a trusted machine; the dir is created 0700. It is removed by `npm run test:behavior`
// teardown only implicitly (temp dir) — delete /tmp/qrspi-iso-home yourself if you care.

import { cpSync, mkdirSync, rmSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

export const ISO_HOME = join(tmpdir(), "qrspi-iso-home");

// Only these pieces of ~/.claude are carried over — enough to boot + auth + load plugins.
const CLAUDE_SUBPATHS = [".credentials.json", "settings.json", "CLAUDE.md", "plugins"];

export function buildIsoHome(realHome = homedir()) {
  rmSync(ISO_HOME, { recursive: true, force: true });
  mkdirSync(join(ISO_HOME, ".claude"), { recursive: true });

  // The legacy global config (marketplace registration, project map) lives at $HOME/.claude.json.
  const realJson = join(realHome, ".claude.json");
  if (existsSync(realJson)) cpSync(realJson, join(ISO_HOME, ".claude.json"));

  for (const sub of CLAUDE_SUBPATHS) {
    const src = join(realHome, ".claude", sub);
    if (existsSync(src)) cpSync(src, join(ISO_HOME, ".claude", sub), { recursive: true });
  }

  chmodSync(ISO_HOME, 0o700);
  return ISO_HOME;
}

// CLI: `node tests/lib/iso-home.mjs` builds it and prints the path (used by `npm run test:behavior`).
if (import.meta.url === `file://${process.argv[1]}`) {
  const p = buildIsoHome();
  process.stdout.write(`built isolated home: ${p}\n`);
}
