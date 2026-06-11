import { randomUUID } from "node:crypto";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/dynamo";
import { error, json, noContent } from "../shared/http";
import { getDisplayName, getUserSub } from "../shared/auth";
import { validateTripInput } from "./validate";
import type { Trip } from "../../lib/types";

// Single trips handler routing on the HTTP API routeKey. Public GET routes carry
// no authorizer; POST/PUT/DELETE sit behind the JWT authorizer (first auth
// layer) and additionally enforce ownership here (second layer): a caller may
// only edit/delete a trip whose authorId equals their Cognito `sub`.

const TABLE = process.env.TRIP_TABLE ?? "";

// Defensive cap for the small launch dataset (ASSUMPTION-001) so a runaway
// table can't return an unbounded payload. Pagination (Option B) is deferred.
const MAX_TRIPS = 200;

// Fields the free-text `q` matches against (REQ-008). Mirrors the client-side
// fallback in lib/search.ts (TASK-035), which does the authoritative
// case-insensitive pass — DynamoDB `contains` is case-sensitive, so the server
// pass is a coarse narrowing only.
const SEARCHABLE_FIELDS = [
  "name",
  "location",
  "city",
  "province",
  "country",
  "tripType",
  "vehicle",
] as const;

// Exact-match filters, each backed by a GSI (infra/modules/dynamodb). Ordered
// most→least selective so we Query the narrowest available partition instead of
// scanning; the remaining filters fall through to a FilterExpression.
const GSI_FILTERS = [
  { param: "city", index: "city-index" },
  { param: "province", index: "province-index" },
  { param: "country", index: "country-index" },
  { param: "tripType", index: "tripType-index" },
  { param: "vehicle", index: "vehicle-index" },
] as const;

type TripQuery = {
  q?: string;
  filters: Record<string, string>;
  group?: string;
};

function parseTripQuery(
  params: Record<string, string | undefined> | null | undefined,
): TripQuery {
  const qp = params ?? {};
  const trimmed = (v: string | undefined) => v?.trim() || undefined;

  const filters: Record<string, string> = {};
  for (const { param } of GSI_FILTERS) {
    const value = trimmed(qp[param]);
    if (value) filters[param] = value;
  }

  return { q: trimmed(qp.q), filters, group: trimmed(qp.group) };
}

// Builds the FilterExpression shared by the Scan and GSI Query paths: equality
// on each exact-match filter (skipping the one used as the Query key) plus an
// OR of `contains` across the searchable fields for `q`.
function buildFilterExpression(filters: Record<string, string>, q?: string) {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const clauses: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    clauses.push(`#${key} = :${key}`);
  }

  if (q) {
    values[":q"] = q;
    const orClauses = SEARCHABLE_FIELDS.map((field) => {
      names[`#${field}`] = field;
      return `contains(#${field}, :q)`;
    });
    clauses.push(`(${orClauses.join(" OR ")})`);
  }

  if (clauses.length === 0) return undefined;
  return {
    FilterExpression: clauses.join(" AND "),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

function parseBody(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function listTrips(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Search/filter/group (M5, Option A — CON-002): Query a GSI when an exact-match
  // filter is present (no Scan); otherwise Scan with an optional FilterExpression.
  // The client refines free text case-insensitively (lib/search.ts) and renders
  // grouping; the server `group` param just sorts so grouped output is contiguous.
  const { q, filters, group } = parseTripQuery(event.queryStringParameters);

  const primary = GSI_FILTERS.find(({ param }) => filters[param]);

  let items: Trip[];
  if (primary) {
    // Exclude the partition key from the residual filter — it's the key condition.
    const residual = { ...filters };
    delete residual[primary.param];
    const filter = buildFilterExpression(residual, q);
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: primary.index,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: {
          ...filter?.ExpressionAttributeNames,
          "#pk": primary.param,
        },
        ExpressionAttributeValues: {
          ...filter?.ExpressionAttributeValues,
          ":pk": filters[primary.param],
        },
        FilterExpression: filter?.FilterExpression,
      }),
    );
    items = (result.Items ?? []) as Trip[];
  } else {
    const filter = buildFilterExpression(filters, q);
    const result = await ddb.send(
      new ScanCommand({ TableName: TABLE, ...filter }),
    );
    items = (result.Items ?? []) as Trip[];
  }

  // Sort by the requested group field so the UI can render contiguous sections
  // (final grouping/headers happen client-side — TASK-036).
  if (group) {
    const groupValue = (t: Trip) =>
      String((t as unknown as Record<string, unknown>)[group] ?? "");
    items = [...items].sort((a, b) =>
      groupValue(a).localeCompare(groupValue(b)),
    );
  }

  return json(200, { trips: items.slice(0, MAX_TRIPS) });
}

async function getTrip(id: string): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { id } }),
  );
  if (!result.Item) return error(404, "Trip not found");
  return json(200, result.Item as Trip);
}

async function createTrip(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const sub = getUserSub(event);
  if (!sub) return error(401, "Unauthenticated");

  const validation = validateTripInput(parseBody(event.body));
  if (!validation.ok) return error(400, validation.message);

  const now = new Date().toISOString();
  const trip: Trip = {
    id: randomUUID(),
    ...validation.value,
    authorId: sub,
    authorName: getDisplayName(event),
    favoriteCount: 0,
    createdAt: now,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: trip }));
  return json(201, trip);
}

async function updateTrip(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  id: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const sub = getUserSub(event);
  if (!sub) return error(401, "Unauthenticated");

  const existing = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { id } }),
  );
  if (!existing.Item) return error(404, "Trip not found");

  const current = existing.Item as Trip;
  if (current.authorId !== sub) return error(403, "Not the trip owner");

  const validation = validateTripInput(parseBody(event.body));
  if (!validation.ok) return error(400, validation.message);

  // Preserve server-owned fields; only the editable input is overwritten.
  const updated: Trip = {
    ...current,
    ...validation.value,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return json(200, updated);
}

async function deleteTrip(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  id: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const sub = getUserSub(event);
  if (!sub) return error(401, "Unauthenticated");

  const existing = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { id } }),
  );
  if (!existing.Item) return error(404, "Trip not found");
  if ((existing.Item as Trip).authorId !== sub) {
    return error(403, "Not the trip owner");
  }

  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
  return noContent();
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const id = event.pathParameters?.id;

  try {
    switch (event.routeKey) {
      case "GET /trips":
        return await listTrips(event);
      case "GET /trips/{id}":
        return id ? await getTrip(id) : error(400, "Missing trip id");
      case "POST /trips":
        return await createTrip(event);
      case "PUT /trips/{id}":
        return id ? await updateTrip(event, id) : error(400, "Missing trip id");
      case "DELETE /trips/{id}":
        return id ? await deleteTrip(event, id) : error(400, "Missing trip id");
      default:
        return error(404, `Unsupported route: ${event.routeKey}`);
    }
  } catch (err) {
    console.error("trips handler error", err);
    return error(500, "Internal server error");
  }
}
