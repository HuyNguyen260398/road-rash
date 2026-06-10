"use client";

import { TRIP_TYPES, VEHICLES } from "@/lib/types";
import type { Trip } from "@/lib/types";
import type { TripFilters } from "@/lib/search";

// Filter selects for the discovery grid (TASK-034 / REQ-008). tripType/vehicle
// options come from the fixed enums; location options (country/province/city)
// are derived from the loaded candidate set so we only offer values that exist.
// Selections compose with the SearchBar `q` and are applied client-side
// (lib/search.ts) for instant results over the small launch dataset.

// "ROAD_TRIP" -> "Road trip"
function formatEnum(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function distinct(trips: Trip[], key: keyof Trip): string[] {
  const values = new Set<string>();
  for (const t of trips) {
    const v = t[key];
    if (typeof v === "string" && v.trim()) values.add(v);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export default function FilterControls({
  trips,
  filters,
  onChange,
}: {
  trips: Trip[];
  filters: TripFilters;
  onChange: (next: TripFilters) => void;
}) {
  const set = (key: keyof TripFilters, value: string) =>
    onChange({ ...filters, [key]: value || undefined });

  const selectClass =
    "rounded-md border border-black/15 bg-transparent px-2 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/20";

  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Filter by trip type"
        className={selectClass}
        value={filters.tripType ?? ""}
        onChange={(e) => set("tripType", e.target.value)}
      >
        <option value="">All types</option>
        {TRIP_TYPES.map((t) => (
          <option key={t} value={t}>
            {formatEnum(t)}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by vehicle"
        className={selectClass}
        value={filters.vehicle ?? ""}
        onChange={(e) => set("vehicle", e.target.value)}
      >
        <option value="">All vehicles</option>
        {VEHICLES.map((v) => (
          <option key={v} value={v}>
            {formatEnum(v)}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by country"
        className={selectClass}
        value={filters.country ?? ""}
        onChange={(e) => set("country", e.target.value)}
      >
        <option value="">All countries</option>
        {distinct(trips, "country").map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by province"
        className={selectClass}
        value={filters.province ?? ""}
        onChange={(e) => set("province", e.target.value)}
      >
        <option value="">All provinces</option>
        {distinct(trips, "province").map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by city"
        className={selectClass}
        value={filters.city ?? ""}
        onChange={(e) => set("city", e.target.value)}
      >
        <option value="">All cities</option>
        {distinct(trips, "city").map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
