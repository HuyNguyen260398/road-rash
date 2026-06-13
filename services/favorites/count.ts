import type { UpdateCommandInput } from "@aws-sdk/lib-dynamodb";

// Builds the UpdateItem input that nudges a trip's denormalized favoriteCount.
// `if_not_exists` seeds the counter at 0 for trips that never had the attribute
// (e.g. seeded rows), so the increment can't raise a ValidationException. The
// decrement is guarded so the counter never drops below zero if it has drifted.
export function buildFavoriteCountUpdate(
  tableName: string,
  tripId: string,
  delta: 1 | -1,
): UpdateCommandInput {
  return {
    TableName: tableName,
    Key: { id: tripId },
    UpdateExpression:
      "SET favoriteCount = if_not_exists(favoriteCount, :zero) + :delta",
    ConditionExpression:
      delta > 0
        ? "attribute_exists(id)"
        : "attribute_exists(id) AND favoriteCount > :zero",
    ExpressionAttributeValues: { ":delta": delta, ":zero": 0 },
  };
}
