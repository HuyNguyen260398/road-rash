import { describe, expect, it } from "vitest";
import { filterToCandidates, parseSuggestions } from "./select";

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
