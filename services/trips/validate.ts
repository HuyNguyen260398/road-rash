import { validateMyMapsUrl } from "../../lib/validation";
import { TRIP_TYPES, VEHICLES } from "../../lib/types";
import type { TripInput } from "../../lib/types";

// Server-side validation + limits for the trips create/edit payload (TASK-048,
// SEC-004). Pure (no AWS deps) so it unit-tests in isolation and bundles into
// the trips Lambda. The client form mirrors these caps for UX, but a client can
// bypass the form — the server is the authority that prevents oversized/spammy
// writes from reaching DynamoDB.

// Max character length per text field. Caps storage/iframe-src abuse and keeps
// payloads sane; mirrored by the client form's `maxLength` attributes.
export const FIELD_LIMITS = {
  name: 120,
  description: 2000,
  location: 200,
  city: 100,
  province: 100,
  country: 100,
  // URLs become an iframe src / deep link — bound them well under common limits.
  myMapsUrl: 2048,
  googleMapsUrl: 2048,
  // Server-issued S3 key (thumbnails/<sub>/<uuid>.<ext>, ~90 chars); cap with
  // headroom so a bypassed client can't bloat the item or overflow the
  // /uploads/thumbnail?key=… query when cards render.
  thumbnailKey: 256,
} as const;

// Upper bound on a trip's duration — a year of riding is already generous, and
// the cap blocks absurd values from a bypassed client.
export const MAX_DURATION_DAYS = 365;

export type ValidationResult =
  | { ok: true; value: TripInput }
  | { ok: false; message: string };

export function validateTripInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(b.name);
  const description = str(b.description);
  const location = str(b.location);
  const city = str(b.city);
  const province = str(b.province);
  const country = str(b.country);
  const myMapsUrl = str(b.myMapsUrl);
  const googleMapsUrl = str(b.googleMapsUrl);
  const thumbnailKey = str(b.thumbnailKey);

  if (!name) return { ok: false, message: "name is required" };
  if (!country) return { ok: false, message: "country is required" };

  if (!TRIP_TYPES.includes(b.tripType as (typeof TRIP_TYPES)[number])) {
    return { ok: false, message: "tripType is invalid" };
  }
  if (!VEHICLES.includes(b.vehicle as (typeof VEHICLES)[number])) {
    return { ok: false, message: "vehicle is invalid" };
  }

  const durationDays = Number(b.durationDays);
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    return { ok: false, message: "durationDays must be a positive integer" };
  }
  if (durationDays > MAX_DURATION_DAYS) {
    return {
      ok: false,
      message: `durationDays must not exceed ${MAX_DURATION_DAYS}`,
    };
  }

  // Length caps (TASK-048): reject oversized text before it reaches DynamoDB.
  const overLimit = (
    [
      ["name", name],
      ["description", description],
      ["location", location],
      ["city", city],
      ["province", province],
      ["country", country],
      ["myMapsUrl", myMapsUrl],
      ["googleMapsUrl", googleMapsUrl],
      ["thumbnailKey", thumbnailKey],
    ] as const
  ).find(([field, value]) => value.length > FIELD_LIMITS[field]);
  if (overLimit) {
    const [field] = overLimit;
    return {
      ok: false,
      message: `${field} must be ${FIELD_LIMITS[field]} characters or fewer`,
    };
  }

  // Server-side re-validation of the My Maps URL — defense in depth behind the
  // client-side guard (SEC-003); the string ends up as an iframe src.
  if (!validateMyMapsUrl(myMapsUrl)) {
    return {
      ok: false,
      message: "myMapsUrl is not a valid Google My Maps URL",
    };
  }

  return {
    ok: true,
    value: {
      name,
      description: description || undefined,
      location,
      tripType: b.tripType as TripInput["tripType"],
      city,
      province,
      country,
      durationDays,
      vehicle: b.vehicle as TripInput["vehicle"],
      thumbnailKey: thumbnailKey || undefined,
      myMapsUrl,
      googleMapsUrl: googleMapsUrl || undefined,
    },
  };
}
