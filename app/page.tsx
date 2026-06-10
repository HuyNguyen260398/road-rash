import Link from "next/link";
import TripBrowser from "@/components/TripBrowser";
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
    loadError = "Trips are unavailable right now. Please try again later.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Discover trips</h1>
          <p className="text-sm opacity-70">
            Browse travel plans shared by the community.
          </p>
        </div>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link href="/my-trips" className="hover:underline">
            My trips
          </Link>
          <Link
            href="/trips/new"
            className="rounded-md bg-foreground px-3 py-2 text-background transition-opacity hover:opacity-90"
          >
            Create trip
          </Link>
        </nav>
      </header>

      {loadError ? (
        <p className="py-16 text-center opacity-60">{loadError}</p>
      ) : (
        <TripBrowser
          trips={trips}
          emptyMessage="No trips yet — be the first to share one."
        />
      )}
    </main>
  );
}
