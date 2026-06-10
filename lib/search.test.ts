import { describe, expect, it } from "vitest";
import { filterTrips, groupTrips, matchesQuery } from "./search";
import type { Trip } from "./types";

// TEST-003 — the client-side search fallback (TASK-035) does the authoritative
// case-insensitive substring pass across the searchable fields (REQ-008), and
// composes with the exact-match filters so its results match the server filter
// for the loaded candidate set (CON-002, Option A).

function makeTrip(overrides: Partial<Trip>): Trip {
  return {
    id: "id",
    name: "Untitled",
    location: "",
    tripType: "OTHER",
    city: "",
    province: "",
    country: "",
    durationDays: 1,
    vehicle: "OTHER",
    myMapsUrl: "https://www.google.com/maps/d/view?mid=x",
    authorId: "author",
    authorName: "Author",
    createdAt: "2026-01-01T00:00:00.000Z",
    favoriteCount: 0,
    ...overrides,
  };
}

const hanoi = makeTrip({
  id: "1",
  name: "Hanoi Old Quarter Loop",
  location: "Hoan Kiem Lake",
  city: "Hanoi",
  province: "Hanoi",
  country: "Vietnam",
  tripType: "CITY",
  vehicle: "MOTORBIKE",
});

const dalat = makeTrip({
  id: "2",
  name: "Da Lat Pine Forest",
  location: "Central Highlands",
  city: "Da Lat",
  province: "Lam Dong",
  country: "Vietnam",
  tripType: "MOUNTAIN",
  vehicle: "CAR",
});

const tokyo = makeTrip({
  id: "3",
  name: "Tokyo Street Food Crawl",
  location: "Shibuya",
  city: "Tokyo",
  province: "Tokyo",
  country: "Japan",
  tripType: "FOOD",
  vehicle: "OTHER",
});

const trips = [hanoi, dalat, tokyo];

describe("matchesQuery", () => {
  it("is case-insensitive on the name", () => {
    expect(matchesQuery(hanoi, "HANOI")).toBe(true);
    expect(matchesQuery(hanoi, "old quarter")).toBe(true);
  });

  it("matches a substring in any searchable field", () => {
    expect(matchesQuery(tokyo, "shibuya")).toBe(true); // location
    expect(matchesQuery(dalat, "lam dong")).toBe(true); // province
    expect(matchesQuery(hanoi, "vietnam")).toBe(true); // country
  });

  it("matches against the enum tripType / vehicle values", () => {
    expect(matchesQuery(hanoi, "motorbike")).toBe(true);
    expect(matchesQuery(tokyo, "food")).toBe(true);
  });

  it("returns true for an empty query", () => {
    expect(matchesQuery(hanoi, "")).toBe(true);
    expect(matchesQuery(hanoi, "   ")).toBe(true);
  });

  it("returns false when no field contains the query", () => {
    expect(matchesQuery(hanoi, "antarctica")).toBe(false);
  });
});

describe("filterTrips", () => {
  it("returns all trips with no query and no filters", () => {
    expect(filterTrips(trips, "", {})).toEqual(trips);
  });

  it("applies case-insensitive free text across the set", () => {
    expect(filterTrips(trips, "VIETNAM", {})).toEqual([hanoi, dalat]);
  });

  it("applies an exact-match filter", () => {
    expect(filterTrips(trips, "", { country: "Japan" })).toEqual([tokyo]);
  });

  it("composes free text with filters", () => {
    expect(filterTrips(trips, "lat", { country: "Vietnam" })).toEqual([dalat]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(
      filterTrips(trips, "", { country: "Vietnam", tripType: "FOOD" }),
    ).toEqual([]);
  });
});

describe("groupTrips", () => {
  it("buckets by the chosen field, sorted by key", () => {
    expect(groupTrips(trips, "country")).toEqual([
      { key: "Japan", trips: [tokyo] },
      { key: "Vietnam", trips: [hanoi, dalat] },
    ]);
  });

  it("collapses empty values into an 'Other' bucket", () => {
    const blank = makeTrip({ id: "4", country: "" });
    expect(groupTrips([blank], "country")).toEqual([
      { key: "Other", trips: [blank] },
    ]);
  });
});
