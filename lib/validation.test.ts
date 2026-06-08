import { describe, expect, it } from "vitest";
import { toMyMapsEmbedUrl, validateMyMapsUrl } from "./validation";

// The My Maps URL guard is the security spine of CON-001 / SEC-003: the app
// stores a user-pasted string and renders it in an <iframe>, so validation must
// accept ONLY genuine Google My Maps links and reject everything else.

describe("validateMyMapsUrl", () => {
  // TEST-001 — valid My Maps URLs accepted.
  it("accepts a My Maps share/view URL", () => {
    expect(
      validateMyMapsUrl("https://www.google.com/maps/d/view?mid=1AbCdEf"),
    ).toBe(true);
  });

  it("accepts a My Maps edit URL", () => {
    expect(
      validateMyMapsUrl("https://www.google.com/maps/d/edit?mid=1AbCdEf"),
    ).toBe(true);
  });

  it("accepts a My Maps embed URL", () => {
    expect(
      validateMyMapsUrl("https://www.google.com/maps/d/embed?mid=1AbCdEf"),
    ).toBe(true);
  });

  it("accepts the u/0 viewer variant", () => {
    expect(
      validateMyMapsUrl("https://www.google.com/maps/d/u/0/viewer?mid=1AbCdEf"),
    ).toBe(true);
  });

  // TEST-001 — arbitrary / malicious URLs rejected.
  it("rejects a non-Google host", () => {
    expect(validateMyMapsUrl("https://evil.com/maps/d/view?mid=1AbCdEf")).toBe(
      false,
    );
  });

  it("rejects a lookalike host using google.com as a subdomain", () => {
    expect(
      validateMyMapsUrl("https://www.google.com.evil.com/maps/d/view?mid=x"),
    ).toBe(false);
  });

  it("rejects a javascript: scheme", () => {
    expect(validateMyMapsUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects http (non-TLS)", () => {
    expect(
      validateMyMapsUrl("http://www.google.com/maps/d/view?mid=1AbCdEf"),
    ).toBe(false);
  });

  it("rejects a regular Google Maps place URL (not My Maps)", () => {
    expect(validateMyMapsUrl("https://www.google.com/maps/place/Paris")).toBe(
      false,
    );
  });

  it("rejects a My Maps path with no mid", () => {
    expect(validateMyMapsUrl("https://www.google.com/maps/d/view")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateMyMapsUrl("")).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(validateMyMapsUrl("not a url")).toBe(false);
  });
});

describe("toMyMapsEmbedUrl", () => {
  // TEST-002 — yields a correct embed URL from share/view URLs.
  it("converts a view URL to the embed form", () => {
    expect(
      toMyMapsEmbedUrl("https://www.google.com/maps/d/view?mid=1AbCdEf"),
    ).toBe("https://www.google.com/maps/d/embed?mid=1AbCdEf");
  });

  it("converts an edit URL to the embed form", () => {
    expect(
      toMyMapsEmbedUrl("https://www.google.com/maps/d/edit?mid=1AbCdEf"),
    ).toBe("https://www.google.com/maps/d/embed?mid=1AbCdEf");
  });

  it("converts the u/0 viewer variant to the embed form", () => {
    expect(
      toMyMapsEmbedUrl("https://www.google.com/maps/d/u/0/viewer?mid=1AbCdEf"),
    ).toBe("https://www.google.com/maps/d/embed?mid=1AbCdEf");
  });

  it("leaves an already-embed URL as the embed form", () => {
    expect(
      toMyMapsEmbedUrl("https://www.google.com/maps/d/embed?mid=1AbCdEf"),
    ).toBe("https://www.google.com/maps/d/embed?mid=1AbCdEf");
  });

  it("throws on an invalid (non-My Maps) URL", () => {
    expect(() => toMyMapsEmbedUrl("https://evil.com/?mid=x")).toThrow();
  });
});
