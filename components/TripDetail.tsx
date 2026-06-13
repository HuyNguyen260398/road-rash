"use client";

import { useEffect, useRef, useState } from "react";
import {
  BikeIcon,
  CarIcon,
  Clock3Icon,
  CompassIcon,
  HeartIcon,
  MapIcon,
  NavigationIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { toMyMapsEmbedUrl, validateMyMapsUrl } from "@/lib/validation";
import { googleMapsLink } from "@/lib/maps";
import { formatEnum } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Trip, Vehicle } from "@/lib/types";

// Shared trip-detail content (TASK-043). Rendered both inside TripDetailModal
// (card tap) and on the public /trip/[id] share page (TASK-046) so deep links
// and the modal show the same thing.
//
// The map is user-supplied data (CON-001): we embed it read-only via an
// <iframe> whose src is ALWAYS run through the host allow-list (validateMyMapsUrl)
// and canonicalised by toMyMapsEmbedUrl before it touches the DOM (SEC-003 — an
// unvalidated URL is never injected into the iframe src).

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

export default function TripDetail({ trip }: { trip: Trip }) {
  // Only a validated My Maps URL is ever turned into an embed src.
  const embedSrc = validateMyMapsUrl(trip.myMapsUrl)
    ? toMyMapsEmbedUrl(trip.myMapsUrl)
    : null;

  // Load-failure fallback (TASK-044, RISK-004). A private/blocked My Maps map
  // can't be embedded; detect it via onError plus a timeout (cross-origin frames
  // often never fire onError) and fall back to a plain "Open map" link. The link
  // targets the original myMapsUrl, which is already host-allow-listed.
  // This component is mounted fresh per trip (the modal keys on trip.id, the
  // share page renders a single trip), so the timeout/ref start clean — no
  // in-effect reset needed.
  const [embedFailed, setEmbedFailed] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!embedSrc) return;
    const timer = setTimeout(() => {
      if (!loadedRef.current) setEmbedFailed(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [embedSrc]);

  const VehicleIcon = VEHICLE_ICON[trip.vehicle];

  return (
    <article className="flex flex-col gap-6 p-5 sm:p-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              {formatEnum(trip.tripType)}
            </Badge>
            <h1 className="text-2xl font-semibold sm:text-3xl">{trip.name}</h1>
          </div>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm text-muted-foreground"
            title="Favorites"
          >
            <HeartIcon className="size-4" aria-hidden />
            <span aria-hidden>{trip.favoriteCount}</span>
            <span className="sr-only">
              {trip.favoriteCount} favorite{trip.favoriteCount === 1 ? "" : "s"}
            </span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{locationLabel(trip)}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <MapIcon className="size-4" aria-hidden />
            Type
          </dt>
          <dd className="mt-1 font-medium">{formatEnum(trip.tripType)}</dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <VehicleIcon className="size-4" aria-hidden />
            Vehicle
          </dt>
          <dd className="mt-1 font-medium">{formatEnum(trip.vehicle)}</dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Clock3Icon className="size-4" aria-hidden />
            Duration
          </dt>
          <dd className="mt-1 font-medium">
            {trip.durationDays} day{trip.durationDays === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <UserIcon className="size-4" aria-hidden />
            Author
          </dt>
          <dd className="mt-1 truncate font-medium">{trip.authorName}</dd>
        </div>
      </dl>

      {trip.description ? (
        <p className="whitespace-pre-line text-sm leading-7 text-foreground/90">
          {trip.description}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MapIcon className="size-4" aria-hidden />
            Map
          </h2>
          <a
            href={googleMapsLink(trip)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
          >
            <NavigationIcon aria-hidden />
            Open in Google Maps
          </a>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-muted sm:aspect-video">
          {embedSrc && !embedFailed ? (
            <iframe
              src={embedSrc}
              title={`Map for ${trip.name}`}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => {
                loadedRef.current = true;
              }}
              onError={() => setEmbedFailed(true)}
            />
          ) : embedSrc ? (
            // Embed failed/blocked — offer the validated My Maps link instead.
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
              <span>This map couldn’t be embedded.</span>
              <a
                href={trip.myMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-4"
              >
                Open map
              </a>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
              Map preview unavailable.
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
