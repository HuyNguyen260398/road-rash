import { describe, expect, it } from "vitest";
import { FIELD_LIMITS, MAX_DURATION_DAYS, validateTripInput } from "./validate";

// A valid raw create/edit body. Tests clone + override single fields so each
// case isolates one rule.
const validBody = () => ({
  name: "Ha Giang Loop",
  description: "Three days through the northern mountains.",
  location: "Northern Vietnam",
  tripType: "ROAD_TRIP",
  vehicle: "MOTORBIKE",
  durationDays: 3,
  city: "Ha Giang",
  province: "Ha Giang",
  country: "Vietnam",
  myMapsUrl: "https://www.google.com/maps/d/view?mid=abc123",
  googleMapsUrl: "https://maps.app.goo.gl/xyz",
});

describe("validateTripInput — valid input", () => {
  it("accepts a fully valid body", () => {
    const result = validateTripInput(validBody());
    expect(result.ok).toBe(true);
  });

  it("accepts a name at exactly the length limit", () => {
    const result = validateTripInput({
      ...validBody(),
      name: "a".repeat(FIELD_LIMITS.name),
    });
    expect(result.ok).toBe(true);
  });
});

describe("validateTripInput — required fields (regression)", () => {
  it("rejects a non-object body", () => {
    expect(validateTripInput(null).ok).toBe(false);
    expect(validateTripInput("nope").ok).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = validateTripInput({ ...validBody(), name: "  " });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a missing country", () => {
    const result = validateTripInput({ ...validBody(), country: "" });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an invalid tripType", () => {
    const result = validateTripInput({ ...validBody(), tripType: "SPACE" });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an invalid vehicle", () => {
    const result = validateTripInput({ ...validBody(), vehicle: "JETPACK" });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a non-positive durationDays", () => {
    expect(validateTripInput({ ...validBody(), durationDays: 0 }).ok).toBe(
      false,
    );
    expect(validateTripInput({ ...validBody(), durationDays: -2 }).ok).toBe(
      false,
    );
  });

  it("rejects a non-My-Maps myMapsUrl", () => {
    const result = validateTripInput({
      ...validBody(),
      myMapsUrl: "https://evil.example.com/maps",
    });
    expect(result).toMatchObject({ ok: false });
  });
});

describe("validateTripInput — server-side bounds (limits)", () => {
  it("rejects a name over the length limit", () => {
    const result = validateTripInput({
      ...validBody(),
      name: "a".repeat(FIELD_LIMITS.name + 1),
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a description over the length limit", () => {
    const result = validateTripInput({
      ...validBody(),
      description: "a".repeat(FIELD_LIMITS.description + 1),
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a location over the length limit", () => {
    const result = validateTripInput({
      ...validBody(),
      location: "a".repeat(FIELD_LIMITS.location + 1),
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects city/province/country over the length limit", () => {
    for (const field of ["city", "province", "country"] as const) {
      const result = validateTripInput({
        ...validBody(),
        [field]: "a".repeat(FIELD_LIMITS[field] + 1),
      });
      expect(result, `${field} should be rejected`).toMatchObject({
        ok: false,
      });
    }
  });

  it("rejects a durationDays over the upper bound", () => {
    const result = validateTripInput({
      ...validBody(),
      durationDays: MAX_DURATION_DAYS + 1,
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a myMapsUrl over the length limit", () => {
    // Structurally a valid My Maps URL, but too long to store/embed safely.
    const longMid = "a".repeat(FIELD_LIMITS.myMapsUrl);
    const result = validateTripInput({
      ...validBody(),
      myMapsUrl: `https://www.google.com/maps/d/view?mid=${longMid}`,
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a googleMapsUrl over the length limit", () => {
    const result = validateTripInput({
      ...validBody(),
      googleMapsUrl: `https://maps.app.goo.gl/${"a".repeat(FIELD_LIMITS.googleMapsUrl)}`,
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("accepts a presign-shaped thumbnailKey", () => {
    const result = validateTripInput({
      ...validBody(),
      thumbnailKey: `thumbnails/${"a".repeat(36)}/${"b".repeat(36)}.webp`,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a thumbnailKey over the length limit", () => {
    const result = validateTripInput({
      ...validBody(),
      thumbnailKey: "a".repeat(FIELD_LIMITS.thumbnailKey + 1),
    });
    expect(result).toMatchObject({ ok: false });
  });
});
