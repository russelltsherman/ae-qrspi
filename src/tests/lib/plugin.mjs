// Test helpers: locate the plugin's own files and parse their front-matter.
// No dependencies — a tiny YAML-subset parser is enough for our `key: value` front-matter.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// tests/lib/plugin.mjs -> plugin root is two levels up.
export const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const dir = (...p) => join(PLUGIN_ROOT, ...p);

export function read(...p) {
  return readFileSync(join(PLUGIN_ROOT, ...p), "utf8");
}

// Split a Markdown file into { frontmatter: {...}, body: "..." }. Front-matter is the block
// between the leading `---` fences; values are taken verbatim as strings (good enough for the
// flat name/description/tools/model fields our agents and skills use).
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: text };
  const frontmatter = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    frontmatter[key] = line.slice(idx + 1).trim();
  }
  return { frontmatter, body: m[2] };
}

// List the agent markdown files (excluding .gitkeep and dotfiles).
export function agentFiles() {
  const d = dir("agents");
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".md") && !f.startsWith("."));
}

// List the skill directories (each contains a SKILL.md).
export function skillDirs() {
  const d = dir("skills");
  if (!existsSync(d)) return [];
  return readdirSync(d, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}
