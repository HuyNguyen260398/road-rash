import { describe, expect, it } from "vitest";
import { buildFavoriteCountUpdate } from "./count";

describe("buildFavoriteCountUpdate", () => {
  it("increments with if_not_exists so a missing attribute can't throw", () => {
    const input = buildFavoriteCountUpdate("Trip", "trip-1", 1);
    expect(input.TableName).toBe("Trip");
    expect(input.Key).toEqual({ id: "trip-1" });
    expect(input.UpdateExpression).toBe(
      "SET favoriteCount = if_not_exists(favoriteCount, :zero) + :delta",
    );
    expect(input.ConditionExpression).toBe("attribute_exists(id)");
    expect(input.ExpressionAttributeValues).toEqual({ ":delta": 1, ":zero": 0 });
  });

  it("guards the decrement so the counter never goes below zero", () => {
    const input = buildFavoriteCountUpdate("Trip", "trip-1", -1);
    expect(input.UpdateExpression).toBe(
      "SET favoriteCount = if_not_exists(favoriteCount, :zero) + :delta",
    );
    expect(input.ConditionExpression).toBe(
      "attribute_exists(id) AND favoriteCount > :zero",
    );
    expect(input.ExpressionAttributeValues).toEqual({ ":delta": -1, ":zero": 0 });
  });
});
