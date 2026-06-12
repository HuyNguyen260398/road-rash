import { describe, expect, it } from "vitest";
import { FAVORITE_LIMITS, validateFavoriteInput } from "./validate";

// The favorites POST body is tiny — just a tripId — but it still reaches a
// conditional DynamoDB write, so the server validates it rather than trusting a
// (potentially bypassed) client. These cover the same shape the trips validator
// does: object guard, required/typed/bounded field, whitespace trimming.

describe("validateFavoriteInput — valid input", () => {
  it("accepts a body with a non-empty tripId", () => {
    const result = validateFavoriteInput({ tripId: "trip-123" });
    expect(result).toEqual({ ok: true, value: { tripId: "trip-123" } });
  });

  it("trims surrounding whitespace on tripId", () => {
    const result = validateFavoriteInput({ tripId: "  trip-123  " });
    expect(result).toMatchObject({ ok: true, value: { tripId: "trip-123" } });
  });

  it("accepts a tripId at exactly the length limit", () => {
    const tripId = "a".repeat(FAVORITE_LIMITS.tripId);
    expect(validateFavoriteInput({ tripId }).ok).toBe(true);
  });
});

describe("validateFavoriteInput — invalid input", () => {
  it("rejects a non-object body", () => {
    expect(validateFavoriteInput(null).ok).toBe(false);
    expect(validateFavoriteInput("trip-123").ok).toBe(false);
    expect(validateFavoriteInput(undefined).ok).toBe(false);
  });

  it("rejects a missing tripId", () => {
    expect(validateFavoriteInput({}).ok).toBe(false);
  });

  it("rejects an empty / whitespace-only tripId", () => {
    expect(validateFavoriteInput({ tripId: "" }).ok).toBe(false);
    expect(validateFavoriteInput({ tripId: "   " }).ok).toBe(false);
  });

  it("rejects a non-string tripId", () => {
    expect(validateFavoriteInput({ tripId: 123 }).ok).toBe(false);
    expect(validateFavoriteInput({ tripId: ["trip-123"] }).ok).toBe(false);
  });

  it("rejects a tripId over the length limit", () => {
    const tripId = "a".repeat(FAVORITE_LIMITS.tripId + 1);
    expect(validateFavoriteInput({ tripId }).ok).toBe(false);
  });
});
