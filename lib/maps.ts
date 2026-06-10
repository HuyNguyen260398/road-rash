// "Open in Google Maps" deep-link builder (TASK-045, CON-001). Best-effort: on
// mobile a google.com/maps URL prompts the OS to hand off to the native app; on
// desktop it opens Maps in the browser. There is no guaranteed native handoff.
//
// The result is used as an <a href>, so a stored googleMapsUrl that isn't a real
// http(s) URL must never pass through — a `javascript:`/`data:` href would be an
// XSS sink (cf. the iframe guard in lib/validation.ts). When the explicit URL is
// missing or unsafe we fall back to a Maps search query built from the trip's
// own location fields.

import type { Trip } from "./types";

type LinkableTrip = Pick<
  Trip,
  "name" | "location" | "city" | "province" | "country" | "googleMapsUrl"
>;

function isSafeHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function locationQuery(trip: LinkableTrip): string {
  return (
    trip.location.trim() ||
    [trip.city, trip.province, trip.country].filter(Boolean).join(", ") ||
    trip.name
  );
}

export function googleMapsLink(trip: LinkableTrip): string {
  const explicit = trip.googleMapsUrl?.trim();
  if (explicit && isSafeHttpUrl(explicit)) return explicit;

  const query = encodeURIComponent(locationQuery(trip));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
