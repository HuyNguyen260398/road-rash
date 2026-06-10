import Link from "next/link";
import { redirect } from "next/navigation";
import TripGrid from "@/components/TripGrid";
import EmptyState from "@/components/EmptyState";
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
    loadError = "Please try again in a moment.";
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
        <EmptyState
          icon="⚠️"
          title="Couldn’t load your trips"
          description={loadError}
        />
      ) : mine.length === 0 ? (
        <EmptyState
          icon="🧳"
          title="You haven’t created any trips yet"
          description="Share your first travel plan with the community."
          action={
            <Link
              href="/trips/new"
              className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Create trip
            </Link>
          }
        />
      ) : (
        <TripGrid trips={mine} />
      )}
    </main>
  );
}
