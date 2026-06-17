"use client";

import { useRef } from "react";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { DURATION, EASE, REDUCED_MOTION_QUERY } from "@/lib/motion";
import { TRIP_TYPES, VEHICLES } from "@/lib/types";
import type { Trip } from "@/lib/types";
import type { TripFilters } from "@/lib/search";
import { formatEnum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

// Filter selects for the discovery grid (TASK-034 / REQ-008). tripType/vehicle
// options come from the fixed enums; location options (country/province/city)
// are derived from the loaded candidate set so we only offer values that exist.
// Selections compose with the search pill's `q` and are applied client-side
// (lib/search.ts) for instant results over the small launch dataset.

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
  const t = useTranslations("search");
  const set = (key: keyof TripFilters, value: string) =>
    onChange({ ...filters, [key]: value || undefined });

  const hasFilters = Object.values(filters).some(Boolean);
  const activeKey = Object.values(filters).filter(Boolean).join("|");

  // Slide/fade the "Clear filters" affordance in whenever the active filter set
  // changes (it only renders while filters are active). Reduced-motion: instant.
  const clearRef = useRef<HTMLButtonElement>(null);
  useGSAP(
    () => {
      if (!clearRef.current) return;
      if (!window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      gsap.from(clearRef.current, {
        autoAlpha: 0,
        x: 8,
        duration: DURATION.fast,
        ease: EASE.out,
      });
    },
    { dependencies: [activeKey] },
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
          {t("filtersTitle")}
        </div>
        {hasFilters ? (
          <Button
            ref={clearRef}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => onChange({})}
          >
            <XIcon aria-hidden />
            {t("clearFilters")}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          aria-label={t("filterByTripType")}
          value={filters.tripType ?? ""}
          onChange={(e) => set("tripType", e.target.value)}
        >
          <option value="">{t("allTypes")}</option>
          {TRIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatEnum(t)}
            </option>
          ))}
        </Select>

        <Select
          aria-label={t("filterByVehicle")}
          value={filters.vehicle ?? ""}
          onChange={(e) => set("vehicle", e.target.value)}
        >
          <option value="">{t("allVehicles")}</option>
          {VEHICLES.map((v) => (
            <option key={v} value={v}>
              {formatEnum(v)}
            </option>
          ))}
        </Select>

        <Select
          aria-label={t("filterByCountry")}
          value={filters.country ?? ""}
          onChange={(e) => set("country", e.target.value)}
        >
          <option value="">{t("allCountries")}</option>
          {distinct(trips, "country").map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Select
          aria-label={t("filterByProvince")}
          value={filters.province ?? ""}
          onChange={(e) => set("province", e.target.value)}
        >
          <option value="">{t("allProvinces")}</option>
          {distinct(trips, "province").map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>

        <Select
          aria-label={t("filterByCity")}
          value={filters.city ?? ""}
          onChange={(e) => set("city", e.target.value)}
        >
          <option value="">{t("allCities")}</option>
          {distinct(trips, "city").map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
