"use client";

import { useCallback, useMemo, useState } from "react";
import SearchBar from "./SearchBar";
import FilterControls, { type TripFilters } from "./FilterControls";
import TripGrid from "./TripGrid";
import type { Trip } from "@/lib/types";

// Client-side discovery shell (TASK-034). The page fetches the full candidate
// set server-side (Option A, small dataset — ASSUMPTION-001) and hands it here;
// search/filter run instantly in the browser. The server `GET /trips` query
// params (TASK-033) back the same contract for the M6 AI candidate set.

// Free-text searchable fields (REQ-008). Moves to lib/search.ts in TASK-035.
const SEARCH_FIELDS: (keyof Trip)[] = [
  "name",
  "location",
  "city",
  "province",
  "country",
  "tripType",
  "vehicle",
];

function matchesFilters(trip: Trip, filters: TripFilters): boolean {
  return (
    Object.entries(filters) as [keyof TripFilters, string | undefined][]
  ).every(([key, value]) => !value || trip[key as keyof Trip] === value);
}

function matchesQuery(trip: Trip, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return SEARCH_FIELDS.some((field) =>
    String(trip[field] ?? "")
      .toLowerCase()
      .includes(needle),
  );
}

export default function TripBrowser({
  trips,
  emptyMessage = "No trips yet.",
}: {
  trips: Trip[];
  emptyMessage?: string;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<TripFilters>({});

  // Stable callback so SearchBar's debounce effect doesn't re-run each render.
  const handleSearch = useCallback((value: string) => setQ(value), []);

  const visible = useMemo(
    () => trips.filter((t) => matchesFilters(t, filters) && matchesQuery(t, q)),
    [trips, filters, q],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:max-w-xs sm:flex-1">
          <SearchBar onChange={handleSearch} />
        </div>
        <FilterControls trips={trips} filters={filters} onChange={setFilters} />
      </div>

      <TripGrid
        trips={visible}
        emptyMessage={
          trips.length === 0
            ? emptyMessage
            : "No trips match your search and filters."
        }
      />
    </div>
  );
}
