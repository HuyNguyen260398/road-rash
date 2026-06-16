import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import TripCard from "@/components/TripCard";
import type { Trip } from "@/lib/types";

// "Popular right now" strip on the landing page: real TripCards (reused as-is)
// so the optimistic-favorite hearts keep working via the app-wide
// FavoritesProvider. No onOpen prop -> a card click navigates to /trip/[id]
// rather than opening the modal (the modal lives on /discover). Returns null
// when empty so the section is omitted if there are no trips / the fetch failed.
export default function TrendingTrips({ trips }: { trips: Trip[] }) {
  if (trips.length === 0) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Popular right now</h2>
            <p className="text-sm text-muted-foreground">
              The community&apos;s most-loved routes.
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            See all trips
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </header>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      </div>
    </section>
  );
}
