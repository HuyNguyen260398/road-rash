import { describe, expect, it } from "vitest";
import {
  MAX_CANDIDATES,
  MAX_FIELD_CHARS,
  MAX_PROMPT_CHARS,
  filterToCandidates,
  parsePositiveInt,
  parseSuggestRequest,
  parseSuggestions,
} from "./select";

// TEST-004 — the suggest-trips handler must only ever return IDs that were in
// the candidate set passed to Gemini (REQ-007, RISK-007). The model is free to
// hallucinate or echo IDs that don't exist; filterToCandidates is the pure guard
// that drops anything outside the candidate set before the handler re-validates
// the survivors against DynamoDB. parseSuggestions is the strict-JSON parse that
// tolerates the model's formatting quirks without throwing.

describe("parseSuggestions", () => {
  it("parses a strict JSON array of {id, reason}", () => {
    const text = JSON.stringify([
      { id: "1", reason: "coastal ride" },
      { id: "2", reason: "mountain pass" },
    ]);
    expect(parseSuggestions(text)).toEqual([
      { id: "1", reason: "coastal ride" },
      { id: "2", reason: "mountain pass" },
    ]);
  });

  it("strips a markdown code fence the model may wrap the JSON in", () => {
    const text = '```json\n[{"id":"1","reason":"x"}]\n```';
    expect(parseSuggestions(text)).toEqual([{ id: "1", reason: "x" }]);
  });

  it("keeps entries without a reason (reason is optional)", () => {
    expect(parseSuggestions('[{"id":"1"}]')).toEqual([{ id: "1" }]);
  });

  it("drops entries with a missing or non-string id", () => {
    const text = '[{"id":"1"},{"reason":"no id"},{"id":42}]';
    expect(parseSuggestions(text)).toEqual([{ id: "1" }]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseSuggestions("not json")).toEqual([]);
    expect(parseSuggestions("")).toEqual([]);
  });

  it("returns [] when the payload is not an array", () => {
    expect(parseSuggestions('{"id":"1"}')).toEqual([]);
  });
});

describe("filterToCandidates", () => {
  const candidates = new Set(["a", "b", "c"]);

  it("drops any suggestion whose id is not in the candidate set", () => {
    const suggestions = [
      { id: "a", reason: "keep" },
      { id: "z", reason: "hallucinated" },
      { id: "b", reason: "keep" },
    ];
    expect(filterToCandidates(suggestions, candidates)).toEqual([
      { id: "a", reason: "keep" },
      { id: "b", reason: "keep" },
    ]);
  });

  it("returns [] when nothing the model returned is a candidate", () => {
    expect(
      filterToCandidates([{ id: "x" }, { id: "y" }], candidates),
    ).toEqual([]);
  });

  it("preserves the model's ranking order", () => {
    const suggestions = [{ id: "c" }, { id: "a" }, { id: "b" }];
    expect(filterToCandidates(suggestions, candidates)).toEqual([
      { id: "c" },
      { id: "a" },
      { id: "b" },
    ]);
  });

  it("de-duplicates repeated ids, keeping the first occurrence", () => {
    const suggestions = [
      { id: "a", reason: "first" },
      { id: "a", reason: "second" },
    ];
    expect(filterToCandidates(suggestions, candidates)).toEqual([
      { id: "a", reason: "first" },
    ]);
  });
});

describe("parsePositiveInt", () => {
  it("returns the parsed value for a positive numeric string", () => {
    expect(parsePositiveInt("5000", 20000)).toBe(5000);
  });

  it("falls back when the env var is undefined", () => {
    expect(parsePositiveInt(undefined, 20000)).toBe(20000);
  });

  it("falls back on a non-numeric string (would otherwise be NaN → 0ms timeout)", () => {
    expect(parsePositiveInt("abc", 20000)).toBe(20000);
  });

  it("falls back on zero and negatives", () => {
    expect(parsePositiveInt("0", 20000)).toBe(20000);
    expect(parsePositiveInt("-5", 20000)).toBe(20000);
  });
});

describe("parseSuggestRequest", () => {
  const candidate = {
    id: "1",
    name: "Hanoi Loop",
    location: "Hoan Kiem",
    city: "Hanoi",
    province: "Hanoi",
    country: "Vietnam",
    tripType: "CITY",
    vehicle: "MOTORBIKE",
    durationDays: 2,
    description: "city ride",
  };

  it("parses a valid request", () => {
    const raw = JSON.stringify({ prompt: "coast", candidates: [candidate] });
    expect(parseSuggestRequest(raw)).toEqual({
      prompt: "coast",
      candidates: [candidate],
    });
  });

  it("returns undefined for missing/invalid/empty bodies", () => {
    expect(parseSuggestRequest(undefined)).toBeUndefined();
    expect(parseSuggestRequest("not json")).toBeUndefined();
    expect(parseSuggestRequest("[]")).toBeUndefined();
  });

  it("returns undefined when the prompt is empty or whitespace", () => {
    const raw = JSON.stringify({ prompt: "   ", candidates: [candidate] });
    expect(parseSuggestRequest(raw)).toBeUndefined();
  });

  it("returns undefined when candidates is missing or empty", () => {
    expect(
      parseSuggestRequest(JSON.stringify({ prompt: "x" })),
    ).toBeUndefined();
    expect(
      parseSuggestRequest(JSON.stringify({ prompt: "x", candidates: [] })),
    ).toBeUndefined();
  });

  it("trims and caps the prompt length", () => {
    const raw = JSON.stringify({
      prompt: "  " + "a".repeat(MAX_PROMPT_CHARS + 500) + "  ",
      candidates: [candidate],
    });
    expect(parseSuggestRequest(raw)?.prompt.length).toBe(MAX_PROMPT_CHARS);
  });

  it("caps oversized candidate string fields", () => {
    const raw = JSON.stringify({
      prompt: "x",
      candidates: [{ ...candidate, name: "n".repeat(MAX_FIELD_CHARS + 300) }],
    });
    expect(parseSuggestRequest(raw)?.candidates[0].name.length).toBe(
      MAX_FIELD_CHARS,
    );
  });

  it("drops candidate entries without a string id", () => {
    const raw = JSON.stringify({
      prompt: "x",
      candidates: [candidate, { name: "no id" }, { id: 42 }],
    });
    expect(parseSuggestRequest(raw)?.candidates).toEqual([candidate]);
  });

  it("returns undefined when no candidate entry is valid", () => {
    const raw = JSON.stringify({
      prompt: "x",
      candidates: [{ name: "no id" }],
    });
    expect(parseSuggestRequest(raw)).toBeUndefined();
  });

  it("caps the candidate count", () => {
    const many = Array.from({ length: MAX_CANDIDATES + 50 }, (_, i) => ({
      ...candidate,
      id: String(i),
    }));
    const raw = JSON.stringify({ prompt: "x", candidates: many });
    expect(parseSuggestRequest(raw)?.candidates.length).toBe(MAX_CANDIDATES);
  });
});
