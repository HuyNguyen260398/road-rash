"use client";

import { useCallback, useMemo, useState } from "react";
import SearchBar from "./SearchBar";
import FilterControls from "./FilterControls";
import TripGrid from "./TripGrid";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
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

  const resultLabel = `${visible.length} route${
    visible.length === 1 ? "" : "s"
  }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="lg:max-w-sm lg:flex-1">
            <SearchBar onChange={handleSearch} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor="trip-group-by"
              className="text-sm font-medium text-muted-foreground"
            >
              Group
            </label>
            <Select
              id="trip-group-by"
              aria-label="Group trips by"
              className="min-w-48"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupField | "")}
            >
              <option value="">No grouping</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  By {g.label.toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <Badge variant="outline" className="w-fit bg-background">
            {resultLabel}
          </Badge>
        </div>
        <FilterControls trips={trips} filters={filters} onChange={setFilters} />
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
