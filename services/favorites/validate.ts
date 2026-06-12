// Server-side validation for the favorites POST body. Pure (no AWS deps) so it
// unit-tests in isolation and bundles into the favorites Lambda. The only input
// a client controls is the tripId; bound it so a bypassed client can't write a
// junk/oversized key into the Favorite table (which feeds the saved-trips view).

// Trip ids are server-generated UUIDs (~36 chars); cap with headroom rather than
// pinning an exact format so the validator stays robust if the id scheme changes.
export const FAVORITE_LIMITS = {
  tripId: 128,
} as const;

export type FavoriteValidationResult =
  | { ok: true; value: { tripId: string } }
  | { ok: false; message: string };

export function validateFavoriteInput(body: unknown): FavoriteValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be a JSON object" };
  }

  const { tripId } = body as Record<string, unknown>;
  if (typeof tripId !== "string") {
    return { ok: false, message: "tripId is required" };
  }

  const trimmed = tripId.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "tripId is required" };
  }
  if (trimmed.length > FAVORITE_LIMITS.tripId) {
    return { ok: false, message: "tripId is too long" };
  }

  return { ok: true, value: { tripId: trimmed } };
}
