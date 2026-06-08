"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { Trip, Vehicle } from "@/lib/types";

// Trip card for the responsive grid (TASK-027). The thumbnail is fetched via a
// public presigned GET (the bucket is private); the heart is display-only here
// and becomes an interactive toggle in M4.

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

export default function TripCard({ trip }: { trip: Trip }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

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
          <span className="flex items-center gap-1" title="Favorites">
            <span aria-hidden>♥</span>
            <span>{trip.favoriteCount}</span>
          </span>
        </div>
        <p className="truncate text-xs opacity-50">by {trip.authorName}</p>
      </div>
    </Link>
  );
}
