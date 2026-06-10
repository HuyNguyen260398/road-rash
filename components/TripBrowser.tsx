"use client";

import { useCallback, useMemo, useState } from "react";
import SearchBar from "./SearchBar";
import FilterControls from "./FilterControls";
import TripGrid from "./TripGrid";
import { filterTrips, type TripFilters } from "@/lib/search";
import type { Trip } from "@/lib/types";

// Client-side discovery shell (TASK-034). The page fetches the full candidate
// set server-side (Option A, small dataset — ASSUMPTION-001) and hands it here;
// search/filter run instantly in the browser via lib/search.ts (TASK-035). The
// server `GET /trips` query params (TASK-033) back the same contract for the M6
// AI candidate set.

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
    () => filterTrips(trips, q, filters),
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
