"use client";

import { useState, type FormEvent } from "react";
import TripCard from "./TripCard";
import { api } from "@/lib/api-client";
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
      // TASK-042 replaces this with a plain-search fallback.
      setResults([]);
      setMessage("Couldn't get AI suggestions right now.");
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
    <section className="flex flex-col gap-4 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="ai-prompt" className="text-sm font-medium">
            Ask AI for trip ideas
          </label>
          <input
            id="ai-prompt"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Where do you want to ride?"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/20"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Asking…" : "Ask AI"}
          </button>
          {status === "done" && (
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-black/15 px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {message && <p className="text-sm opacity-70">{message}</p>}

      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map(({ trip, reason }) => (
            <div key={trip.id} className="flex flex-col gap-1">
              <TripCard trip={trip} />
              {reason && (
                <p className="px-1 text-xs italic opacity-70">{reason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
