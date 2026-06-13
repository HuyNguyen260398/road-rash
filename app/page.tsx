import AppShell from "@/components/AppShell";
import TripBrowser from "@/components/TripBrowser";
import AiSuggestBox from "@/components/AiSuggestBox";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Home / Discover (TASK-028). Public, server-rendered: fetch all trips and hand
// them to the client TripBrowser, which runs instant search/filter/group (M5).
export const dynamic = "force-dynamic";

export default async function Home() {
  let trips: Trip[] = [];
  let loadError: string | null = null;

  try {
    const result = await api.getTrips();
    trips = result.trips;
  } catch {
    // API not reachable/configured yet (e.g. before terraform apply) — render
    // the page shell with an empty grid rather than crashing.
    loadError = "Please try again in a moment.";
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Discover trips</h1>
          <p className="text-sm opacity-70">
            Browse travel plans shared by the community.
          </p>
        </header>

        {loadError ? (
          <EmptyState
            icon="⚠️"
            title="Trips are unavailable right now"
            description={loadError}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {trips.length > 0 && <AiSuggestBox trips={trips} />}
            <TripBrowser
              trips={trips}
              emptyMessage="No trips yet — be the first to share one."
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
