// Deterministic leak detection for the ticket-withhold firewall.
//
// The runtime withhold test (L1) seeds the ticket with a unique CANARY token and a distinctive
// phrase that exist ONLY in ticket.md (never in questions.md or the source). After running
// /qrspi-research, the researcher's output (research.md) is scanned with these helpers: if the
// canary or a ticket-only phrase shows up, the ticket leaked into the ticket-blind researcher.
//
// These functions are pure and unit-tested (free), so the *detection* logic is trustworthy even
// though the live model run that produces the transcript is gated behind QRSPI_TEST_LIVE.

// A fixed, highly-improbable token. Put it in ticket.md; it must never appear in research output.
export const CANARY = "QRSPI-WITHHOLD-CANARY-7731";

// Case-insensitive, whitespace-tolerant canary check.
export function containsCanary(text, canary = CANARY) {
  if (!text) return false;
  const norm = (s) => s.toLowerCase().replace(/[\s\-_]+/g, "");
  return norm(text).includes(norm(canary));
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "as", "by",
  "is", "are", "be", "this", "that", "it", "its", "from", "at", "into", "via", "so", "we",
  "you", "your", "their", "they", "should", "could", "would", "add", "new", "page",
]);

export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 3);
}

// Verbatim phrase leakage: every contiguous run of `minWords` tokens from `secret` (the ticket) is
// checked against `suspect` (the researcher output), using the SAME tokenization for both so the
// sequences line up. A matched run counts as a leak only if it carries ≥2 non-stopword tokens —
// distinctive multi-word phrases are strong evidence the secret was copied, while runs that are
// mostly stopwords (incidental shared vocabulary) are excluded.
export function leakedPhrases(suspect, secret, { minWords = 4 } = {}) {
  const suspectTokens = tokenize(suspect);
  const suspectShingles = new Set();
  for (let i = 0; i + minWords <= suspectTokens.length; i++) {
    suspectShingles.add(suspectTokens.slice(i, i + minWords).join(" "));
  }

  const secretTokens = tokenize(secret);
  const leaked = new Set();
  for (let i = 0; i + minWords <= secretTokens.length; i++) {
    const run = secretTokens.slice(i, i + minWords);
    const shingle = run.join(" ");
    if (!suspectShingles.has(shingle)) continue;
    const contentWords = run.filter((w) => !STOPWORDS.has(w)).length;
    if (contentWords >= 2) leaked.add(shingle);
  }
  return [...leaked];
}

// Convenience: did the ticket leak into the suspect text (by canary OR distinctive phrase)?
export function ticketLeaked(suspect, ticket, opts) {
  return containsCanary(suspect) || leakedPhrases(suspect, ticket, opts).length > 0;
}
