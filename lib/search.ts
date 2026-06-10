import type { Trip } from "./types";

// Client-side search/filter fallback (TASK-035, CON-002 Option A). The server
// `GET /trips` does a coarse GSI Query + case-sensitive `contains`; this is the
// authoritative pass over the loaded candidate set: case-insensitive substring
// for free text plus exact-match filters. Pure + dependency-free so it's unit
// testable (TEST-003) and reusable by TripBrowser.

// Free-text searchable fields (REQ-008).
export const SEARCH_FIELDS: (keyof Trip)[] = [
  "name",
  "location",
  "city",
  "province",
  "country",
  "tripType",
  "vehicle",
];

// Exact-match filters, each backed by a Trip GSI server-side.
export type TripFilters = {
  tripType?: string;
  country?: string;
  province?: string;
  city?: string;
  vehicle?: string;
};

// Case-insensitive substring match across every searchable field. An empty or
// whitespace-only query matches everything.
export function matchesQuery(trip: Trip, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return SEARCH_FIELDS.some((field) =>
    String(trip[field] ?? "")
      .toLowerCase()
      .includes(needle),
  );
}

// Exact (case-sensitive) equality on each provided filter; absent/empty filters
// are ignored so filters compose by AND.
export function matchesFilters(trip: Trip, filters: TripFilters): boolean {
  return (
    Object.entries(filters) as [keyof TripFilters, string | undefined][]
  ).every(([key, value]) => !value || trip[key as keyof Trip] === value);
}

export function filterTrips(
  trips: Trip[],
  q: string,
  filters: TripFilters,
): Trip[] {
  return trips.filter(
    (trip) => matchesFilters(trip, filters) && matchesQuery(trip, q),
  );
}
