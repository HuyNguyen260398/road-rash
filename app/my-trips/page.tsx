import Link from "next/link";
import { redirect } from "next/navigation";
import TripGrid from "@/components/TripGrid";
import { getServerSession } from "@/lib/server-session";
import { api } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Auth-gated "My trips" (TASK-028): trips authored by the current user. Until
// the author GSI/query lands (M5) this filters the full list by sub server-side.
export const dynamic = "force-dynamic";

export default async function MyTripsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  let mine: Trip[] = [];
  let loadError: string | null = null;
  try {
    const { trips } = await api.getTrips();
    mine = trips.filter((t) => t.authorId === session.sub);
  } catch {
    loadError = "Couldn’t load your trips right now. Please try again later.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">My trips</h1>
        <Link
          href="/trips/new"
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Create trip
        </Link>
      </header>

      {loadError ? (
        <p className="py-16 text-center opacity-60">{loadError}</p>
      ) : (
        <TripGrid
          trips={mine}
          emptyMessage="You haven’t created any trips yet."
        />
      )}
    </main>
  );
}
