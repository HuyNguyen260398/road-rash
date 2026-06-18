// Pure, dependency-free selection + request-parsing logic for the suggest-trips
// handler so it can be unit-tested (TEST-004) without touching the network or
// DynamoDB. The handler wires these between the request, the Gemini call, and the
// DynamoDB re-validation: parse/bound the request → parse the model's text → drop
// anything outside the candidate set → (handler) confirm the survivors still
// exist in the Trip table before returning.
import type {
  SuggestCandidate,
  SuggestLocale,
  SuggestRequest,
} from "../../lib/types";

export type Suggestion = { id: string; reason?: string };

// POST /suggest is public and drives Gemini spend (RISK-006), so the request is
// bounded at parse time: the candidate *count* caps the DynamoDB fan-out and the
// per-string caps stop a caller inflating the prompt with huge fields.
export const MAX_CANDIDATES = 100;
export const MAX_PROMPT_CHARS = 1000;
export const MAX_FIELD_CHARS = 200;
export const MAX_DESC_CHARS = 400;
export const MAX_SUMMARY_CHARS = 600;

// Safe numeric env parse: a non-numeric/zero/negative value falls back instead of
// yielding NaN (which would make setTimeout fire at 0ms and abort every call).
export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Normalize the optional UI locale; anything we don't ship falls back to en so
// the prompt always has a defined language to write the summary in.
function parseLocale(value: unknown): SuggestLocale {
  return value === "vi" ? "vi" : "en";
}

// Parse + validate + bound the POST /suggest body. Returns undefined for anything
// unusable (missing prompt, no valid candidates) so the handler can 400. All
// strings are trimmed and length-capped; the candidate array is capped in count.
export function parseSuggestRequest(
  raw: string | undefined,
): SuggestRequest | undefined {
  if (!raw) return undefined;

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof body !== "object" || body === null) return undefined;

  const b = body as Record<string, unknown>;
  const prompt =
    typeof b.prompt === "string"
      ? b.prompt.trim().slice(0, MAX_PROMPT_CHARS)
      : "";
  if (!prompt) return undefined;
  if (!Array.isArray(b.candidates) || b.candidates.length === 0) {
    return undefined;
  }

  const field = (v: unknown) =>
    typeof v === "string" ? v.trim().slice(0, MAX_FIELD_CHARS) : "";

  const candidates: SuggestCandidate[] = [];
  for (const entry of b.candidates.slice(0, MAX_CANDIDATES)) {
    if (typeof entry !== "object" || entry === null) continue;
    const c = entry as Record<string, unknown>;
    if (typeof c.id !== "string" || c.id.length === 0) continue;
    candidates.push({
      id: c.id.slice(0, MAX_FIELD_CHARS),
      name: field(c.name),
      location: field(c.location),
      city: field(c.city),
      province: field(c.province),
      country: field(c.country),
      tripType: field(c.tripType) as SuggestCandidate["tripType"],
      vehicle: field(c.vehicle) as SuggestCandidate["vehicle"],
      durationDays: Number(c.durationDays) || 0,
      description:
        typeof c.description === "string"
          ? c.description.trim().slice(0, MAX_DESC_CHARS)
          : undefined,
    });
  }
  if (candidates.length === 0) return undefined;

  return { prompt, candidates, locale: parseLocale(b.locale) };
}

// Gemini may wrap its JSON in a ```json code fence even when asked for raw JSON,
// so strip that (and surrounding whitespace) before parsing.
function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// Build Suggestion[] from an already-parsed value. Anything that isn't an array
// of objects with a string `id` yields [] — entries failing the id rule are
// skipped. Centralizes the id/reason rules so both parsers share them.
function parseEntries(value: unknown): Suggestion[] {
  if (!Array.isArray(value)) return [];

  const result: Suggestion[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, reason } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0) continue;
    result.push(typeof reason === "string" ? { id, reason } : { id });
  }
  return result;
}

// Strict-ish JSON parse of the model's response. Strips a ```json code fence,
// then expects a JSON array of objects with a string `id`; anything else yields
// [] — the handler then falls back rather than throwing.
export function parseSuggestions(text: string): Suggestion[] {
  const stripped = stripCodeFence(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return [];
  }

  return parseEntries(parsed);
}

// Envelope parser for the model's response. The prompt asks for an object
// { summary, results }, but we tolerate a bare array (older shape / model drift)
// by treating it as results with no summary. Strips a ```json code fence first,
// then delegates entry parsing to parseEntries so the id/reason rules stay in
// one place.
export function parseSuggestResponse(text: string): {
  summary: string;
  suggestions: Suggestion[];
} {
  const stripped = stripCodeFence(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { summary: "", suggestions: [] };
  }

  if (Array.isArray(parsed)) {
    return { summary: "", suggestions: parseEntries(parsed) };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { summary: "", suggestions: [] };
  }

  const obj = parsed as Record<string, unknown>;
  const summary =
    typeof obj.summary === "string"
      ? obj.summary.trim().slice(0, MAX_SUMMARY_CHARS)
      : "";
  const suggestions = parseEntries(obj.results);

  return { summary, suggestions };
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
