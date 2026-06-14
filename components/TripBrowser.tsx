"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import SearchPill from "./SearchPill";
import FilterControls from "./FilterControls";
import TripCard from "./TripCard";
import TripGrid from "./TripGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
  filterTrips,
  groupTrips,
  type GroupField,
  type TripFilters,
} from "@/lib/search";
import { formatEnum } from "@/lib/format";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import type { SuggestCandidate, Trip } from "@/lib/types";

// Client-side discovery shell. Typing filters the loaded set instantly
// (lib/search.ts); the inline "Ask AI" button submits the same text to
// POST /suggest (submit-only) and the grid switches to the ranked results until
// cleared. Filters + grouping collapse behind a toggle.

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: "country", label: "Country" },
  { value: "province", label: "Province" },
  { value: "city", label: "City" },
  { value: "tripType", label: "Trip type" },
  { value: "vehicle", label: "Vehicle" },
];

const ENUM_GROUPS: ReadonlySet<GroupField> = new Set(["tripType", "vehicle"]);

// Compact projection sent as the AI candidate set — never the full record.
function toCandidates(trips: Trip[]): SuggestCandidate[] {
  return trips.map((t) => ({
    id: t.id,
    name: t.name,
    location: t.location,
    city: t.city,
    province: t.province,
    country: t.country,
    tripType: t.tripType,
    vehicle: t.vehicle,
    durationDays: t.durationDays,
    description: t.description,
  }));
}

type AiResult = { trip: Trip; reason?: string };
type AiStatus = "idle" | "loading" | "done";

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
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiResults, setAiResults] = useState<AiResult[]>([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Monotonic id so a slow AI response for an abandoned query can't overwrite
  // state after the user has typed again or cleared. Bumped on every reset.
  const requestIdRef = useRef(0);

  const resetAi = useCallback(() => {
    requestIdRef.current += 1;
    setAiStatus("idle");
    setAiResults([]);
    setAiMessage(null);
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQ(value);
      // Editing the query drops back to plain search and abandons any in-flight
      // AI request.
      resetAi();
    },
    [resetAi],
  );

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

  // AI results render in a bespoke grid (each card carries a reason caption), so
  // they get their own paginated window — TripGrid's load-more covers plain search.
  const {
    visible: visibleAi,
    hasMore: hasMoreAi,
    sentinelRef: aiSentinelRef,
  } = useInfiniteScroll(aiResults);

  async function askAi() {
    const prompt = q.trim();
    if (!prompt || trips.length === 0) return;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setAiStatus("loading");
    setAiMessage(null);

    const byId = new Map(trips.map((t) => [t.id, t]));
    try {
      const { suggestions } = await api.suggestTrips(
        prompt,
        toCandidates(trips),
      );
      if (requestId !== requestIdRef.current) return; // superseded — discard
      const mapped = suggestions
        .map((s): AiResult | undefined => {
          const trip = byId.get(s.id);
          return trip ? { trip, reason: s.reason } : undefined;
        })
        .filter((r): r is AiResult => r !== undefined);
      setAiResults(mapped);
      setAiMessage(
        mapped.length === 0
          ? "No trips matched that — try a different description, or browse below."
          : null,
      );
    } catch {
      if (requestId !== requestIdRef.current) return; // superseded — discard
      // Gemini unavailable/timed out — fall back to plain search over the same
      // candidate set so the user still gets results.
      const fallback = filterTrips(trips, prompt, {}).map(
        (trip): AiResult => ({ trip }),
      );
      setAiResults(fallback);
      setAiMessage(
        fallback.length === 0
          ? `AI is unavailable and no trips matched "${prompt}". Try another search.`
          : "AI is unavailable right now — showing plain search results instead.",
      );
    } finally {
      if (requestId === requestIdRef.current) setAiStatus("done");
    }
  }

  function clearSearch() {
    setQ("");
    resetAi();
  }

  const aiActive = aiStatus === "done";
  const resultCount = aiActive ? aiResults.length : visible.length;
  const resultLabel = `${resultCount} route${resultCount === 1 ? "" : "s"}`;
  const hasActiveFilters =
    Object.values(filters).some(Boolean) || Boolean(groupBy);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <SearchPill
          value={q}
          onChange={handleChange}
          onAskAi={askAi}
          onClear={clearSearch}
          loading={aiStatus === "loading"}
          aiActive={aiActive}
          aiDisabled={trips.length === 0}
        />
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-primary"
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontalIcon className="size-4" aria-hidden />
            {filtersOpen ? "Hide filters" : "Show filters"}
            {hasActiveFilters ? (
              <span
                className="ml-1 size-2 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
          </Button>
          <Badge variant="outline" className="bg-background">
            {resultLabel}
          </Badge>
        </div>

        {/* Kept mounted (display toggled) so the toggle's aria-controls always
            references a live element. */}
        <div
          id="filter-panel"
          className={`flex-col gap-3 ${filtersOpen ? "flex" : "hidden"}`}
        >
          <FilterControls
            trips={trips}
            filters={filters}
            onChange={setFilters}
          />
          <div className="flex items-center gap-2">
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
        </div>
      </div>

      {aiMessage ? (
        <p className="text-sm text-muted-foreground">{aiMessage}</p>
      ) : null}

      {aiActive ? (
        aiResults.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleAi.map(({ trip, reason }) => (
                <div key={trip.id} className="flex flex-col gap-1">
                  <TripCard trip={trip} />
                  {reason ? (
                    <p className="px-1 text-xs italic text-muted-foreground">
                      {reason}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {hasMoreAi ? (
              <div ref={aiSentinelRef} aria-hidden className="h-px" />
            ) : null}
          </>
        ) : null
      ) : (
        <TripGrid
          trips={visible}
          groups={groups}
          emptyMessage={
            trips.length === 0
              ? emptyMessage
              : "No trips match your search and filters."
          }
        />
      )}
    </div>
  );
}
