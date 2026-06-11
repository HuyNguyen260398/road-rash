import { describe, expect, it } from "vitest";
import { googleMapsLink } from "./maps";

// "Open in Google Maps" is a best-effort mobile deep link (CON-001, TASK-045).
// googleMapsLink prefers the trip's explicit googleMapsUrl and otherwise builds
// a Maps search-query URL from the trip's location. Because the result becomes
// an <a href>, a stored googleMapsUrl that isn't a real http(s) URL must never
// pass through (a javascript: href would be an XSS sink) — fall back instead.

const base = {
  name: "Coastal loop",
  location: "",
  city: "",
  province: "",
  country: "",
  googleMapsUrl: undefined as string | undefined,
};

describe("googleMapsLink", () => {
  it("uses an explicit Google Maps short link (maps.app.goo.gl)", () => {
    expect(
      googleMapsLink({
        ...base,
        googleMapsUrl: "https://maps.app.goo.gl/abc123",
      }),
    ).toBe("https://maps.app.goo.gl/abc123");
  });

  it("uses an explicit www.google.com/maps URL", () => {
    expect(
      googleMapsLink({
        ...base,
        googleMapsUrl: "https://www.google.com/maps/place/Hue",
      }),
    ).toBe("https://www.google.com/maps/place/Hue");
  });

  it("rejects a non-Google https URL and falls back to a search query", () => {
    // A stored googleMapsUrl is NOT host-validated server-side, so it could be
    // any site; labelling an arbitrary link "Open in Google Maps" would be a
    // phishing/open-redirect vector. Fall back to the safe Maps search instead.
    expect(
      googleMapsLink({
        ...base,
        location: "Da Lat",
        googleMapsUrl: "https://evil.example.com/maps/place/Hue",
      }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=Da%20Lat");
  });

  it("rejects a google.com lookalike host using it as a subdomain", () => {
    expect(
      googleMapsLink({
        ...base,
        location: "Da Lat",
        googleMapsUrl: "https://www.google.com.evil.com/maps/place/Hue",
      }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=Da%20Lat");
  });

  it("ignores a javascript: googleMapsUrl and falls back to a search query", () => {
    expect(
      googleMapsLink({
        ...base,
        location: "Da Lat",
        googleMapsUrl: "javascript:alert(1)",
      }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=Da%20Lat");
  });

  it("builds a search-query URL from the trip location when no googleMapsUrl", () => {
    expect(googleMapsLink({ ...base, location: "Hai Van Pass" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Hai%20Van%20Pass",
    );
  });

  it("falls back to city/province/country when location is empty", () => {
    expect(
      googleMapsLink({
        ...base,
        city: "Hue",
        province: "Thua Thien Hue",
        country: "Vietnam",
      }),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Hue%2C%20Thua%20Thien%20Hue%2C%20Vietnam",
    );
  });

  it("falls back to the trip name when no location fields are set", () => {
    expect(googleMapsLink({ ...base, name: "Mystery road trip" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Mystery%20road%20trip",
    );
  });
});
