"use client";

import { useCallback, useMemo, useState } from "react";
import SearchBar from "./SearchBar";
import FilterControls from "./FilterControls";
import TripGrid from "./TripGrid";
import {
  filterTrips,
  groupTrips,
  type GroupField,
  type TripFilters,
} from "@/lib/search";
import { formatEnum } from "@/lib/format";
import type { Trip } from "@/lib/types";

// Client-side discovery shell (TASK-034). The page fetches the full candidate
// set server-side (Option A, small dataset — ASSUMPTION-001) and hands it here;
// search/filter/group run instantly in the browser via lib/search.ts (TASK-035,
// TASK-036). The server `GET /trips` query params (TASK-033) back the same
// contract for the M6 AI candidate set.

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: "country", label: "Country" },
  { value: "province", label: "Province" },
  { value: "city", label: "City" },
  { value: "tripType", label: "Trip type" },
  { value: "vehicle", label: "Vehicle" },
];

// Group keys that are fixed enums need prettifying for the section header;
// location values are already human-readable.
const ENUM_GROUPS: ReadonlySet<GroupField> = new Set(["tripType", "vehicle"]);

export default function TripBrowser({
  trips,
  emptyMessage = "No trips yet.",
}: {
  trips: Trip[];
  emptyMessage?: string;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<TripFilters>({});
  const [groupBy, setGroupBy] = useState<GroupField | "">("");

  // Stable callback so SearchBar's debounce effect doesn't re-run each render.
  const handleSearch = useCallback((value: string) => setQ(value), []);

  const visible = useMemo(
    () => filterTrips(trips, q, filters),
    [trips, filters, q],
  );

  const groups = useMemo(() => {
    if (!groupBy) return undefined;
    return groupTrips(visible, groupBy).map((g) => ({
      label: ENUM_GROUPS.has(groupBy) ? formatEnum(g.key) : g.key,
      trips: g.trips,
    }));
  }, [visible, groupBy]);

  const selectClass =
    "rounded-md border border-black/15 bg-transparent px-2 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/20";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:max-w-xs sm:flex-1">
          <SearchBar onChange={handleSearch} />
        </div>
        <FilterControls trips={trips} filters={filters} onChange={setFilters} />
        <select
          aria-label="Group trips by"
          className={selectClass}
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupField | "")}
        >
          <option value="">No grouping</option>
          {GROUP_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              Group by {g.label.toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <TripGrid
        trips={visible}
        groups={groups}
        emptyMessage={
          trips.length === 0
            ? emptyMessage
            : "No trips match your search and filters."
        }
      />
    </div>
  );
}
