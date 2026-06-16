import { describe, expect, it } from "vitest";
import { selectTrending } from "./trending";
import type { Trip } from "./types";

// Minimal Trip factory — only the fields selectTrending reads matter; the rest
// are filled with valid placeholders so the object satisfies the Trip type.
function makeTrip(overrides: Partial<Trip> & { id: string }): Trip {
  return {
    name: "Trip",
    description: undefined,
    location: "Somewhere",
    tripType: "ROAD_TRIP",
    city: "City",
    province: "Province",
    country: "Country",
    durationDays: 1,
    vehicle: "CAR",
    thumbnailKey: undefined,
    myMapsUrl: "https://www.google.com/maps/d/embed?mid=abc",
    authorId: "author",
    authorName: "Author",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: undefined,
    favoriteCount: 0,
    ...overrides,
  };
}

describe("selectTrending", () => {
  it("orders by favoriteCount descending", () => {
    const trips = [
      makeTrip({ id: "a", favoriteCount: 1 }),
      makeTrip({ id: "b", favoriteCount: 9 }),
      makeTrip({ id: "c", favoriteCount: 5 }),
    ];
    expect(selectTrending(trips, 3).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks favoriteCount ties by newest createdAt", () => {
    const trips = [
      makeTrip({ id: "old", favoriteCount: 5, createdAt: "2026-01-01T00:00:00.000Z" }),
      makeTrip({ id: "new", favoriteCount: 5, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(selectTrending(trips, 2).map((t) => t.id)).toEqual(["new", "old"]);
  });

  it("slices to n", () => {
    const trips = [
      makeTrip({ id: "a", favoriteCount: 3 }),
      makeTrip({ id: "b", favoriteCount: 2 }),
      makeTrip({ id: "c", favoriteCount: 1 }),
    ];
    expect(selectTrending(trips, 2).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(selectTrending([], 6)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const trips = [
      makeTrip({ id: "a", favoriteCount: 1 }),
      makeTrip({ id: "b", favoriteCount: 9 }),
    ];
    const before = trips.map((t) => t.id);
    selectTrending(trips, 2);
    expect(trips.map((t) => t.id)).toEqual(before);
  });
});
