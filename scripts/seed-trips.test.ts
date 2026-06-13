import { describe, expect, it } from "vitest";
import { buildSeedTrips } from "./seed-trips";
import type { TripInput } from "../lib/types";

const template: TripInput = {
  name: "Hai Van Pass Loop",
  location: "Hai Van Pass, Da Nang",
  tripType: "ROAD_TRIP",
  city: "Da Nang",
  province: "Da Nang",
  country: "Vietnam",
  durationDays: 2,
  vehicle: "MOTORBIKE",
  myMapsUrl: "https://www.google.com/maps/d/edit?mid=EXAMPLE",
};

describe("buildSeedTrips", () => {
  it("produces 11 variations", () => {
    expect(buildSeedTrips(template)).toHaveLength(11);
  });

  it("gives every variation a distinct, non-empty name", () => {
    const names = buildSeedTrips(template).map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.trim().length > 0)).toBe(true);
  });

  it("reuses the template's My Maps URL so each trip embeds a valid map", () => {
    expect(
      buildSeedTrips(template).every((t) => t.myMapsUrl === template.myMapsUrl),
    ).toBe(true);
  });

  it("propagates the template's googleMapsUrl when present", () => {
    const withLink: TripInput = {
      ...template,
      googleMapsUrl: "https://maps.app.goo.gl/EXAMPLE",
    };
    expect(
      buildSeedTrips(withLink).every(
        (t) => t.googleMapsUrl === withLink.googleMapsUrl,
      ),
    ).toBe(true);
  });

  it("omits googleMapsUrl entirely when the template has none", () => {
    expect(buildSeedTrips(template).every((t) => !("googleMapsUrl" in t))).toBe(
      true,
    );
  });

  it("only emits known trip types and vehicles", () => {
    const types = new Set([
      "ROAD_TRIP",
      "CITY",
      "BEACH",
      "MOUNTAIN",
      "FOOD",
      "CAMPING",
      "OTHER",
    ]);
    const vehicles = new Set(["MOTORBIKE", "CAR", "BICYCLE", "OTHER"]);
    for (const t of buildSeedTrips(template)) {
      expect(types.has(t.tripType)).toBe(true);
      expect(vehicles.has(t.vehicle)).toBe(true);
    }
  });
});
