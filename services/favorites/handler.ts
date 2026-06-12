import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/dynamo";
import { error, json, noContent } from "../shared/http";
import { getUserSub } from "../shared/auth";
import { validateFavoriteInput } from "./validate";

// Favorites handler (M4 / TASK-029). All three routes sit behind the JWT
// authorizer (first auth layer); the favorite is keyed by the verified Cognito
// `sub` (second layer), so a caller can only ever read/write their own
// favorites. Favoriting also bumps Trip.favoriteCount — a *denormalized* counter
// (GUD-003): it's maintained here with atomic UpdateItem rather than recomputed
// by scanning Favorite at read time.
//
// Race trade-off (RISK-005): the counter and the Favorite row are written in two
// separate calls, so a crash between them — or concurrent toggles on the same
// trip — can let favoriteCount drift slightly from the true Favorite count. This
// is accepted for the MVP; a stream-driven reconciler is the deferred fix.

const FAVORITE_TABLE = process.env.FAVORITE_TABLE ?? "";
const TRIP_TABLE = process.env.TRIP_TABLE ?? "";
const USER_INDEX = "userId-index";

function parseBody(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "ConditionalCheckFailedException"
  );
}

// Atomically nudge a trip's denormalized favoriteCount. delta is +1 on favorite
// and -1 on unfavorite; the decrement is guarded so the counter never goes
// negative if it has already drifted to 0.
async function adjustFavoriteCount(
  tripId: string,
  delta: 1 | -1,
): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TRIP_TABLE,
        Key: { id: tripId },
        UpdateExpression: "SET favoriteCount = favoriteCount + :delta",
        // Only touch existing trips, and never decrement below zero.
        ConditionExpression:
          delta > 0
            ? "attribute_exists(id)"
            : "attribute_exists(id) AND favoriteCount > :zero",
        ExpressionAttributeValues: { ":delta": delta, ":zero": 0 },
      }),
    );
  } catch (err) {
    // The trip may have been deleted, or the count already floored at 0 — the
    // favorite row is still the source of truth, so don't fail the request.
    if (!isConditionalCheckFailed(err)) throw err;
  }
}

async function addFavorite(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const userId = getUserSub(event);
  if (!userId) return error(401, "Unauthenticated");

  const validation = validateFavoriteInput(parseBody(event.body));
  if (!validation.ok) return error(400, validation.message);

  const { tripId } = validation.value;
  const item = { tripId, userId, createdAt: new Date().toISOString() };

  try {
    await ddb.send(
      new PutCommand({
        TableName: FAVORITE_TABLE,
        Item: item,
        // Dedupe: one favorite per (tripId, userId). A repeat favorite fails the
        // condition instead of silently double-counting (TEST-007).
        ConditionExpression: "attribute_not_exists(tripId)",
      }),
    );
  } catch (err) {
    if (isConditionalCheckFailed(err)) {
      // Already favorited — idempotent from the client's perspective.
      return json(200, { tripId, alreadyFavorited: true });
    }
    throw err;
  }

  await adjustFavoriteCount(tripId, 1);
  return json(201, item);
}

async function removeFavorite(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  tripId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const userId = getUserSub(event);
  if (!userId) return error(401, "Unauthenticated");

  // The path param is user-controlled and becomes a DynamoDB key — bound it the
  // same way POST does (rejects oversized/junk keys with a clean 400 instead of
  // letting DynamoDB raise a ValidationException → 500).
  const validation = validateFavoriteInput({ tripId });
  if (!validation.ok) return error(400, validation.message);
  const normalizedTripId = validation.value.tripId;

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: FAVORITE_TABLE,
        Key: { tripId: normalizedTripId, userId },
        // Only decrement if a row actually existed, so a repeat/no-op delete
        // can't drag favoriteCount below the true value.
        ConditionExpression: "attribute_exists(tripId)",
      }),
    );
  } catch (err) {
    if (isConditionalCheckFailed(err)) {
      // Not favorited (or already removed) — idempotent success, no decrement.
      return noContent();
    }
    throw err;
  }

  await adjustFavoriteCount(normalizedTripId, -1);
  return noContent();
}

async function listFavorites(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const userId = getUserSub(event);
  if (!userId) return error(401, "Unauthenticated");

  // Query the userId GSI (KEYS_ONLY) for the caller's favorites; returns the
  // tripIds the saved-trips view hydrates from the Trip table client-side.
  const result = await ddb.send(
    new QueryCommand({
      TableName: FAVORITE_TABLE,
      IndexName: USER_INDEX,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    }),
  );

  const favorites = (result.Items ?? []).map((item) => ({
    tripId: String(item.tripId),
  }));
  return json(200, { favorites });
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const tripId = event.pathParameters?.tripId;

  try {
    switch (event.routeKey) {
      case "GET /favorites":
        return await listFavorites(event);
      case "POST /favorites":
        return await addFavorite(event);
      case "DELETE /favorites/{tripId}":
        return tripId
          ? await removeFavorite(event, tripId)
          : error(400, "Missing trip id");
      default:
        return error(404, `Unsupported route: ${event.routeKey}`);
    }
  } catch (err) {
    console.error("favorites handler error", err);
    return error(500, "Internal server error");
  }
}
