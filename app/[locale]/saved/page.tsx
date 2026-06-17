import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangleIcon, HeartIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import TripGrid from "@/components/TripGrid";
import EmptyState from "@/components/EmptyState";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { buttonVariants } from "@/components/ui/button";
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
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <HeartIcon className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Saved trips</h1>
              <p className="text-sm text-muted-foreground">
                Routes you’ve favorited, ready to revisit anytime.
              </p>
            </div>
          </div>
          <Link
            href="/discover"
            className={buttonVariants({ variant: "outline" })}
          >
            Discover more
          </Link>
        </header>

        {loadError ? (
          <EmptyState
            icon={<AlertTriangleIcon className="size-6" aria-hidden />}
            title="Couldn’t load your saved trips"
            description={loadError}
          />
        ) : saved.length === 0 ? (
          <EmptyState
            icon={<HeartIcon className="size-6" aria-hidden />}
            title="No saved trips yet"
            description="Tap the heart on any trip to save it here for later."
            action={
              <Link href="/discover" className={buttonVariants()}>
                Browse trips
              </Link>
            }
          />
        ) : (
          <TripGrid trips={saved} />
        )}
      </div>
      <ScrollToTopButton />
    </AppShell>
  );
}
