// "Open in Google Maps" deep-link builder (TASK-045, CON-001). Best-effort: on
// mobile a google.com/maps URL prompts the OS to hand off to the native app; on
// desktop it opens Maps in the browser. There is no guaranteed native handoff.
//
// The result is used as an <a href> and labelled "Open in Google Maps", so the
// stored googleMapsUrl must be a genuine Google Maps link before it's trusted.
// It is NOT host-validated server-side (services/trips/handler.ts only validates
// myMapsUrl), so an author could store `javascript:…` (XSS sink) or any site
// (phishing / open-redirect under a Google label). We host-allow-list it here —
// mirroring the My Maps guard in lib/validation.ts — and otherwise fall back to
// a Maps search query built from the trip's own location fields.

import type { Trip } from "./types";

type LinkableTrip = Pick<
  Trip,
  "name" | "location" | "city" | "province" | "country" | "googleMapsUrl"
>;

// Exact-match Google hosts (no subdomains — defeats `www.google.com.evil.com`).
// The maps.app.goo.gl short-link host is maps-dedicated; the google.com family
// and the legacy goo.gl shortener must additionally sit under a /maps path.
const MAPS_DEDICATED_HOSTS = new Set(["maps.app.goo.gl"]);
const MAPS_PATH_HOSTS = new Set([
  "www.google.com",
  "google.com",
  "maps.google.com",
  "goo.gl",
]);

function isGoogleMapsUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (MAPS_DEDICATED_HOSTS.has(parsed.hostname)) return true;
  if (MAPS_PATH_HOSTS.has(parsed.hostname)) {
    return parsed.pathname.startsWith("/maps");
  }
  return false;
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
  if (explicit && isGoogleMapsUrl(explicit)) return explicit;

  const query = encodeURIComponent(locationQuery(trip));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
