import Link from "next/link";
import { redirect } from "next/navigation";
import TripGrid from "@/components/TripGrid";
import EmptyState from "@/components/EmptyState";
import { getServerSession } from "@/lib/server-session";
import { api } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Auth-gated "Saved" view (TASK-031). Reads the user's favorites (GET /favorites,
// tripIds only) and hydrates them from the public trip list, mirroring My Trips'
// filter-the-list approach (Option A, small dataset — ASSUMPTION-001). The
// favorites Lambda can't read the Trip table by design (UpdateItem-only on Trip),
// so hydration happens here, not in the handler.
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  let saved: Trip[] = [];
  let loadError: string | null = null;
  try {
    const [{ favorites }, { trips }] = await Promise.all([
      api.getFavorites(session.idToken),
      api.getTrips(),
    ]);
    const ids = new Set(favorites.map((f) => f.tripId));
    saved = trips.filter((t) => ids.has(t.id));
  } catch {
    loadError = "Please try again in a moment.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Saved trips</h1>
        <Link href="/" className="text-sm font-medium hover:underline">
          Discover more
        </Link>
      </header>

      {loadError ? (
        <EmptyState
          icon="⚠️"
          title="Couldn’t load your saved trips"
          description={loadError}
        />
      ) : saved.length === 0 ? (
        <EmptyState
          icon="🤍"
          title="No saved trips yet"
          description="Tap the heart on any trip to save it here for later."
          action={
            <Link
              href="/"
              className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Browse trips
            </Link>
          }
        />
      ) : (
        <TripGrid trips={saved} />
      )}
    </main>
  );
}
