"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontalIcon } from "lucide-react";
import SearchPill from "./SearchPill";
import FilterControls from "./FilterControls";
import TripGrid from "./TripGrid";
import AiSummary from "./AiSummary";
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
import type { SuggestCandidate, SuggestLocale, Trip } from "@/lib/types";

// Client-side discovery shell. Typing only composes the AI prompt — it does NOT
// filter the grid. Clicking "Ask AI" submits the text to POST /suggest; the
// suggestion renders in the summary card above and the grid narrows to the
// AI-selected trips. Dropdown filters + grouping stay live and apply to whatever
// set is shown (all trips before a search, the AI subset after). Filters and
// grouping collapse behind a toggle.

const GROUP_OPTIONS: GroupField[] = [
  "country",
  "province",
  "city",
  "tripType",
  "vehicle",
];

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

type AiStatus = "idle" | "loading" | "success" | "error";

export default function TripBrowser({
  trips,
  emptyMessage,
}: {
  trips: Trip[];
  emptyMessage?: string;
}) {
  const t = useTranslations("search");
  const locale = useLocale() as SuggestLocale;
  const tEmpty = useTranslations("empty");
  const tTripType = useTranslations("tripType");
  const tVehicle = useTranslations("vehicle");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<TripFilters>({});
  const [groupBy, setGroupBy] = useState<GroupField | "">("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  // Ranked trips (best-first) from the last successful AI search. Empty until a
  // search succeeds; on failure the grid falls back to all trips, not these.
  const [aiResults, setAiResults] = useState<Trip[]>([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  // Monotonic id so a slow AI response for an abandoned query can't overwrite
  // state after the user has typed again or cleared. Bumped on every reset.
  const requestIdRef = useRef(0);

  const resetAi = useCallback(() => {
    requestIdRef.current += 1;
    setAiStatus("idle");
    setAiResults([]);
    setAiMessage(null);
    setAiSummary(null);
    setSummaryDismissed(false);
  }, []);

  const handleChange = useCallback((value: string) => {
    // Typing only edits the AI prompt; it never touches the grid. A prior AI
    // result set stays on screen while the user composes a new query and is only
    // replaced when Ask AI is submitted again (or cleared via the X button).
    setQ(value);
  }, []);

  // Only a successful search switches the grid to the AI subset; idle/loading/
  // error all show the full trip list.
  const aiActive = aiStatus === "success";

  // Free text never narrows the grid (empty query) — only the dropdown filters
  // do. The base set is the AI-selected trips once a search has run, otherwise
  // every trip.
  const visible = useMemo(
    () => filterTrips(aiActive ? aiResults : trips, "", filters),
    [aiActive, aiResults, trips, filters],
  );

  const groups = useMemo(() => {
    if (!groupBy) return undefined;
    return groupTrips(visible, groupBy).map((g) => ({
      // Enum group keys (tripType / vehicle) get translated display labels;
      // location group keys (country/province/city) stay as raw user data.
      label:
        groupBy === "tripType"
          ? tTripType(g.key)
          : groupBy === "vehicle"
            ? tVehicle(g.key)
            : g.key,
      trips: g.trips,
    }));
  }, [visible, groupBy, tTripType, tVehicle]);

  async function askAi() {
    const prompt = q.trim();
    if (!prompt || trips.length === 0) return;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setAiStatus("loading");
    setSummaryDismissed(false);
    setAiMessage(null);
    setAiSummary(null);

    const byId = new Map(trips.map((t) => [t.id, t]));
    try {
      const { summary, suggestions } = await api.suggestTrips(
        prompt,
        toCandidates(trips),
        locale,
      );
      if (requestId !== requestIdRef.current) return; // superseded — discard
      // Map ranked ids back to trips, preserving the model's best-first order.
      const mapped = suggestions
        .map((s) => byId.get(s.id))
        .filter((trip): trip is Trip => trip !== undefined);
      setAiSummary(summary || null);
      setAiResults(mapped);
      setAiMessage(mapped.length === 0 ? t("aiNoMatch") : null);
      setAiStatus("success");
    } catch {
      if (requestId !== requestIdRef.current) return; // superseded — discard
      // Gemini unavailable/timed out — keep the full trip list (no text-match
      // filtering) and surface the outage in the summary card.
      setAiResults([]);
      setAiMessage(t("aiUnavailable"));
      setAiStatus("error");
    }
  }

  function clearSearch() {
    setQ("");
    resetAi();
  }

  const resultLabel = t("results", { count: visible.length });
  const hasActiveFilters =
    Object.values(filters).some(Boolean) || Boolean(groupBy);
  // Show the AI card while a request is in flight, then keep it for the summary
  // or fallback message until the user dismisses it.
  const showSummary =
    aiStatus === "loading" ||
    ((Boolean(aiSummary) || Boolean(aiMessage)) && !summaryDismissed);

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
            {filtersOpen ? t("hideFilters") : t("showFilters")}
            {hasActiveFilters ? (
              <span
                className="ml-1 size-2 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
          </Button>
          {/* Hidden while loading so it can't flash a stale count under the
              spinner (the grid is hidden then too). */}
          {aiStatus !== "loading" ? (
            <Badge variant="outline" className="bg-background">
              {resultLabel}
            </Badge>
          ) : null}
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
              {t("group")}
            </label>
            <Select
              id="trip-group-by"
              aria-label={t("groupBy")}
              className="min-w-48"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupField | "")}
            >
              <option value="">{t("noGrouping")}</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {t("groupByOption", { field: t(`groupField.${g}`) })}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {showSummary ? (
        <AiSummary
          loading={aiStatus === "loading"}
          summary={aiSummary}
          message={aiMessage}
          onDismiss={() => setSummaryDismissed(true)}
        />
      ) : null}

      {/* While loading, the grid is hidden so the spinner + suggestion lead; the
          trips load in once the search resolves. When an AI search itself returns
          nothing, the summary card already says so — skip the grid's generic
          empty state to avoid double messaging. A non-empty AI set narrowed to
          nothing by the dropdown filters still shows "no matches" below. */}
      {aiStatus === "loading" || (aiActive && aiResults.length === 0) ? null : (
        <TripGrid
          trips={visible}
          groups={groups}
          emptyMessage={
            trips.length === 0
              ? (emptyMessage ?? tEmpty("noTripsYet"))
              : tEmpty("noMatches")
          }
        />
      )}
    </div>
  );
}
