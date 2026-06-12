"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useFavorites } from "@/components/FavoritesProvider";
import type { Trip, Vehicle } from "@/lib/types";

// Trip card for the responsive grid (TASK-027). The thumbnail is fetched via a
// public presigned GET (the bucket is private); the heart is an optimistic
// favorite toggle (M4 / TASK-030) backed by FavoritesProvider — signed-out taps
// route to /login.

const VEHICLE_ICON: Record<Vehicle, string> = {
  MOTORBIKE: "🏍️",
  CAR: "🚗",
  BICYCLE: "🚲",
  OTHER: "🧭",
};

function locationLabel(trip: Trip): string {
  return (
    trip.location ||
    [trip.city, trip.province, trip.country].filter(Boolean).join(", ")
  );
}

export default function TripCard({
  trip,
  onOpen,
}: {
  trip: Trip;
  /** When set, a plain click opens the detail modal instead of navigating;
      the href to /trip/[id] is kept so share/new-tab/crawlers still work. */
  onOpen?: (trip: Trip) => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const router = useRouter();
  const { isFavorited, countDelta, toggle, signedIn } = useFavorites();

  const favorited = isFavorited(trip.id);
  const favoriteCount = Math.max(0, trip.favoriteCount + countDelta(trip.id));

  function handleFavorite(e: React.MouseEvent) {
    // The card is a Link — keep the heart from navigating/opening the modal.
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push("/login");
      return;
    }
    void toggle(trip.id);
  }

  function handleClick(e: React.MouseEvent) {
    if (!onOpen) return;
    // Let the browser handle modified clicks (new tab/window) and the link's
    // real navigation; only intercept a plain left-click to open the modal.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();
    onOpen(trip);
  }

  useEffect(() => {
    if (!trip.thumbnailKey) return;
    let active = true;
    api
      .getThumbnailUrl(trip.thumbnailKey)
      .then(({ url }) => {
        if (active) setThumbnailUrl(url);
      })
      .catch(() => {
        // Leave the placeholder if the presigned URL can't be fetched.
      });
    return () => {
      active = false;
    };
  }, [trip.thumbnailKey]);

  return (
    <Link
      href={`/trip/${trip.id}`}
      onClick={handleClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/10 transition-shadow hover:shadow-md dark:border-white/15"
    >
      <div className="relative aspect-[4/3] w-full bg-black/5 dark:bg-white/10">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URLs are dynamic hosts; next/image remotePatterns is overkill here.
          <img
            src={thumbnailUrl}
            alt={trip.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-40">
            {VEHICLE_ICON[trip.vehicle]}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 font-semibold">{trip.name}</h3>
        <p className="line-clamp-1 text-sm opacity-70">{locationLabel(trip)}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-sm opacity-80">
          <span className="flex items-center gap-2">
            <span aria-hidden>{VEHICLE_ICON[trip.vehicle]}</span>
            <span>
              {trip.durationDays} day{trip.durationDays === 1 ? "" : "s"}
            </span>
          </span>
          <button
            type="button"
            onClick={handleFavorite}
            aria-pressed={favorited}
            aria-label={
              favorited ? "Remove from favorites" : "Add to favorites"
            }
            title={favorited ? "Remove from favorites" : "Add to favorites"}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span aria-hidden className={favorited ? "text-red-500" : ""}>
              {favorited ? "♥" : "♡"}
            </span>
            <span>{favoriteCount}</span>
          </button>
        </div>
        <p className="truncate text-xs opacity-50">by {trip.authorName}</p>
      </div>
    </Link>
  );
}
