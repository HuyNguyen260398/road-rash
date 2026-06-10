// Pure, dependency-free selection logic for the suggest-trips handler so it can
// be unit-tested (TEST-004) without touching the network or DynamoDB. The
// handler wires these between the Gemini call and the DynamoDB re-validation:
// parse the model's text → drop anything outside the candidate set → (handler)
// confirm the survivors still exist in the Trip table before returning.

export type Suggestion = { id: string; reason?: string };

// Strict-ish JSON parse of the model's response. Gemini may wrap the array in a
// ```json code fence even when asked for raw JSON, so strip that first. Anything
// that isn't a JSON array of objects with a string `id` yields [] — the handler
// then falls back rather than throwing.
export function parseSuggestions(text: string): Suggestion[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const result: Suggestion[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, reason } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0) continue;
    result.push(
      typeof reason === "string" ? { id, reason } : { id },
    );
  }
  return result;
}

// Drop any suggestion whose id is not in the candidate set (REQ-007), keeping the
// model's ranking order and de-duplicating repeated ids (first occurrence wins).
export function filterToCandidates(
  suggestions: Suggestion[],
  candidateIds: Set<string>,
): Suggestion[] {
  const seen = new Set<string>();
  const result: Suggestion[] = [];
  for (const suggestion of suggestions) {
    if (!candidateIds.has(suggestion.id)) continue;
    if (seen.has(suggestion.id)) continue;
    seen.add(suggestion.id);
    result.push(suggestion);
  }
  return result;
}
