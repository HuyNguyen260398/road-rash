"use client";

import { useState, type FormEvent } from "react";
import { RotateCcwIcon, SparklesIcon } from "lucide-react";
import TripCard from "./TripCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { filterTrips } from "@/lib/search";
import type { SuggestCandidate, Trip } from "@/lib/types";

// AI suggestion box (TASK-041, GOAL-007). Submit-only (CON-003): the prompt
// fires a single POST /suggest on explicit click — never per-keystroke — so plain
// search (M5) stays instant and the AI call is intentional. The server ranks only
// ids from the candidate set we pass and re-validates them, so results map back
// to the already-loaded trips. On a Gemini failure the box falls back to plain
// search (TASK-042).

// Compact projection sent as the candidate set (REQ-007) — never the full record.
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

type Suggestion = { trip: Trip; reason?: string };
type Status = "idle" | "loading" | "done";

export default function AiSuggestBox({ trips }: { trips: Trip[] }) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || status === "loading") return;

    setStatus("loading");
    setMessage(null);

    const byId = new Map(trips.map((t) => [t.id, t]));
    try {
      const { suggestions } = await api.suggestTrips(q, toCandidates(trips));
      const mapped = suggestions
        .map((s): Suggestion | undefined => {
          const trip = byId.get(s.id);
          return trip ? { trip, reason: s.reason } : undefined;
        })
        .filter((s): s is Suggestion => s !== undefined);
      setResults(mapped);
      setMessage(
        mapped.length === 0
          ? "No trips matched that — try a different description, or browse below."
          : null,
      );
    } catch {
      // Gemini unavailable/timed out (the handler returns 502, apiFetch throws).
      // Degrade to plain client-side search over the same candidate set (M5) so
      // the user still gets results — never a crash or a hung spinner (RISK-006,
      // TASK-042).
      const fallback = filterTrips(trips, q, {}).map(
        (trip): Suggestion => ({ trip }),
      );
      setResults(fallback);
      setMessage(
        fallback.length === 0
          ? `AI is unavailable and no trips matched “${q}”. Try another search.`
          : "AI is unavailable right now — showing plain search results instead.",
      );
    } finally {
      setStatus("done");
    }
  }

  function clear() {
    setPrompt("");
    setResults([]);
    setMessage(null);
    setStatus("idle");
  }

  const loading = status === "loading";

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-accent p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <SparklesIcon className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Ask AI for trip ideas</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Describe the ride, region, or mood you want. AI only ranks the
            routes already loaded on this page.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 lg:grid-cols-[1fr_auto]"
      >
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="ai-prompt" className="sr-only">
            Trip idea prompt
          </label>
          <Textarea
            id="ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Weekend mountain ride, coastal drive with food stops, quiet cycling route..."
            className="min-h-20 bg-background"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="min-w-28"
          >
            {loading ? "Asking…" : "Ask AI"}
          </Button>
          {status === "done" && (
            <Button type="button" variant="outline" onClick={clear}>
              <RotateCcwIcon aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </form>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map(({ trip, reason }) => (
            <div key={trip.id} className="flex flex-col gap-1">
              <TripCard trip={trip} />
              {reason && (
                <p className="px-1 text-xs italic text-muted-foreground">
                  {reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
