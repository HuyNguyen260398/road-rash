"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BikeIcon,
  CarIcon,
  Clock3Icon,
  CompassIcon,
  HeartIcon,
  MapPinIcon,
  NavigationIcon,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useFavorites } from "@/components/FavoritesProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatEnum } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Trip, Vehicle } from "@/lib/types";

// Trip card for the responsive grid (TASK-027). The thumbnail is fetched via a
// public presigned GET (the bucket is private); the heart is an optimistic
// favorite toggle (M4 / TASK-030) backed by FavoritesProvider — signed-out taps
// route to /login.

const VEHICLE_ICON: Record<Vehicle, LucideIcon> = {
  MOTORBIKE: NavigationIcon,
  CAR: CarIcon,
  BICYCLE: BikeIcon,
  OTHER: CompassIcon,
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
  const VehicleIcon = VEHICLE_ICON[trip.vehicle];

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
      className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URLs are dynamic hosts; next/image remotePatterns is overkill here.
            <img
              src={thumbnailUrl}
              alt={trip.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary">
              <VehicleIcon className="size-12 opacity-70" aria-hidden />
            </div>
          )}
          <div className="absolute left-3 top-3">
            <Badge variant="secondary">{formatEnum(trip.tripType)}</Badge>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="space-y-1">
            <h3 className="line-clamp-1 font-semibold">{trip.name}</h3>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPinIcon className="size-4 shrink-0" aria-hidden />
              <span className="line-clamp-1">{locationLabel(trip)}</span>
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <VehicleIcon className="size-4" aria-hidden />
              <span>{formatEnum(trip.vehicle)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3Icon className="size-4" aria-hidden />
              <span>
                {trip.durationDays} day{trip.durationDays === 1 ? "" : "s"}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              by {trip.authorName}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFavorite}
              aria-pressed={favorited}
              aria-label={
                favorited ? "Remove from favorites" : "Add to favorites"
              }
              title={favorited ? "Remove from favorites" : "Add to favorites"}
              className="h-8 shrink-0 px-2"
            >
              <HeartIcon
                aria-hidden
                className={cn(favorited ? "fill-current text-destructive" : "")}
              />
              <span>{favoriteCount}</span>
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  );
}
