import { DynamoDBClient, type AttributeValue } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// Reconciles the denormalized Trip.favoriteCount against the true number of
// rows in the Favorite table (the source of truth). favoriteCount is maintained
// by the favorites Lambda as a separate write from the Favorite row, so a crash
// between the two writes — or a favorite created during a Lambda redeploy — can
// leave the counter drifted (RISK-005). This script recomputes every counter
// from the Favorite table and (with --apply) corrects the drifted trips.
//
// Dry-run by default: it prints the drift and writes nothing unless --apply is
// passed. See scripts/README-reconcile.md.

type TripRow = { id: string; name?: string; favoriteCount?: number };
type FavoriteRow = { tripId: string };

export type Drift = {
  id: string;
  name: string;
  stored: number;
  actual: number;
};

// Pure core (unit-tested): given the Trip rows and Favorite rows, return the
// trips whose stored favoriteCount disagrees with the real favorite count.
// Favorites whose tripId no longer matches a Trip are ignored (orphans).
export function computeDrift(
  trips: TripRow[],
  favorites: FavoriteRow[],
): Drift[] {
  const actualByTrip = new Map<string, number>();
  for (const { tripId } of favorites) {
    actualByTrip.set(tripId, (actualByTrip.get(tripId) ?? 0) + 1);
  }

  const drift: Drift[] = [];
  for (const trip of trips) {
    const stored = trip.favoriteCount ?? 0;
    const actual = actualByTrip.get(trip.id) ?? 0;
    if (stored !== actual) {
      drift.push({
        id: trip.id,
        name: trip.name ?? "(unnamed)",
        stored,
        actual,
      });
    }
  }
  return drift;
}

// --- Script entrypoint ----------------------------------------------------

const TRIP_TABLE = process.env.TRIP_TABLE ?? "road-rash-staging-Trip";
const FAVORITE_TABLE =
  process.env.FAVORITE_TABLE ?? "road-rash-staging-Favorite";
const REGION = process.env.AWS_REGION ?? "ap-southeast-1";

async function scanAll<T>(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  projection?: { expr: string; names?: Record<string, string> },
): Promise<T[]> {
  const items: T[] = [];
  let key: Record<string, AttributeValue> | undefined;
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: key,
        ProjectionExpression: projection?.expr,
        ExpressionAttributeNames: projection?.names,
      }),
    );
    items.push(...((result.Items ?? []) as T[]));
    key = result.LastEvaluatedKey as Record<string, AttributeValue> | undefined;
  } while (key);
  return items;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION }),
  );

  const [trips, favorites] = await Promise.all([
    scanAll<TripRow>(ddb, TRIP_TABLE, {
      expr: "id, #n, favoriteCount",
      names: { "#n": "name" },
    }),
    scanAll<FavoriteRow>(ddb, FAVORITE_TABLE, { expr: "tripId" }),
  ]);

  const drift = computeDrift(trips, favorites);

  console.log(
    `Scanned ${trips.length} trips and ${favorites.length} favorites.`,
  );
  if (drift.length === 0) {
    console.log("All favoriteCount values are in sync — nothing to do.");
    return;
  }

  console.log(`Found ${drift.length} trip(s) with drifted favoriteCount:`);
  for (const d of drift) {
    console.log(
      `  ${d.id} "${d.name}": stored=${d.stored} → actual=${d.actual}`,
    );
  }

  if (!apply) {
    console.log("\nDry run — pass --apply to write these corrections.");
    return;
  }

  for (const d of drift) {
    await ddb.send(
      new UpdateCommand({
        TableName: TRIP_TABLE,
        Key: { id: d.id },
        // Guard on existence so a trip deleted mid-run isn't recreated.
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: "SET favoriteCount = :actual",
        ExpressionAttributeValues: { ":actual": d.actual },
      }),
    );
    console.log(`  corrected ${d.id} → ${d.actual}`);
  }
  console.log(`\nDone — corrected ${drift.length} trip(s).`);
}

// `import.meta.url` matches the invoked file only when run directly via tsx.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
