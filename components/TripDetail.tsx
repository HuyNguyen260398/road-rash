"use client";

import { useEffect, useRef, useState } from "react";
import { toMyMapsEmbedUrl, validateMyMapsUrl } from "@/lib/validation";
import { googleMapsLink } from "@/lib/maps";
import { formatEnum } from "@/lib/format";
import type { Trip, Vehicle } from "@/lib/types";

// Shared trip-detail content (TASK-043). Rendered both inside TripDetailModal
// (card tap) and on the public /trip/[id] share page (TASK-046) so deep links
// and the modal show the same thing.
//
// The map is user-supplied data (CON-001): we embed it read-only via an
// <iframe> whose src is ALWAYS run through the host allow-list (validateMyMapsUrl)
// and canonicalised by toMyMapsEmbedUrl before it touches the DOM (SEC-003 — an
// unvalidated URL is never injected into the iframe src).

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

  return (
    <article className="flex flex-col gap-5 p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold sm:text-2xl">{trip.name}</h1>
          {/* Display-only heart — the interactive favorite toggle lands in M4
              (TASK-030), once the favorites API/route exists. */}
          <span
            className="flex shrink-0 items-center gap-1 text-sm opacity-80"
            title="Favorites"
          >
            <span aria-hidden>♥</span>
            <span aria-hidden>{trip.favoriteCount}</span>
            {/* The heart/number are decorative; give screen readers the meaning. */}
            <span className="sr-only">
              {trip.favoriteCount} favorite{trip.favoriteCount === 1 ? "" : "s"}
            </span>
          </span>
        </div>
        <p className="text-sm opacity-70">{locationLabel(trip)}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="opacity-50">Type</dt>
          <dd className="font-medium">{formatEnum(trip.tripType)}</dd>
        </div>
        <div>
          <dt className="opacity-50">Vehicle</dt>
          <dd className="font-medium">
            <span aria-hidden>{VEHICLE_ICON[trip.vehicle]}</span>{" "}
            {formatEnum(trip.vehicle)}
          </dd>
        </div>
        <div>
          <dt className="opacity-50">Duration</dt>
          <dd className="font-medium">
            {trip.durationDays} day{trip.durationDays === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="opacity-50">Author</dt>
          <dd className="truncate font-medium">{trip.authorName}</dd>
        </div>
      </dl>

      {trip.description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed opacity-90">
          {trip.description}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold opacity-70">Map</h2>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-black/10 bg-black/5 sm:aspect-video dark:border-white/15 dark:bg-white/10">
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
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm opacity-70">
              <span>This map couldn’t be embedded.</span>
              <a
                href={trip.myMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Open map ↗
              </a>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm opacity-60">
              Map preview unavailable.
            </div>
          )}
        </div>
        {/* Best-effort native handoff (TASK-045, CON-001): on mobile a
            google.com/maps URL prompts the OS to open the Maps app; on desktop
            it opens Maps in the browser. */}
        <a
          href={googleMapsLink(trip)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <span aria-hidden>📍</span> Open in Google Maps
        </a>
      </section>
    </article>
  );
}
