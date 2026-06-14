import { describe, expect, it } from "vitest";
import { computeDrift } from "./reconcile-favorites";

describe("computeDrift", () => {
  it("flags a trip whose stored count is below the real favorite count", () => {
    const drift = computeDrift(
      [{ id: "t1", name: "Vung Tau", favoriteCount: 0 }],
      [{ tripId: "t1" }],
    );
    expect(drift).toEqual([
      { id: "t1", name: "Vung Tau", stored: 0, actual: 1 },
    ]);
  });

  it("returns nothing when every counter already matches", () => {
    const drift = computeDrift(
      [
        { id: "t1", name: "A", favoriteCount: 2 },
        { id: "t2", name: "B", favoriteCount: 0 },
      ],
      [{ tripId: "t1" }, { tripId: "t1" }],
    );
    expect(drift).toEqual([]);
  });

  it("flags an over-counted trip (stored higher than real)", () => {
    const drift = computeDrift(
      [{ id: "t1", name: "A", favoriteCount: 5 }],
      [{ tripId: "t1" }],
    );
    expect(drift).toEqual([{ id: "t1", name: "A", stored: 5, actual: 1 }]);
  });

  it("treats a missing favoriteCount attribute as 0", () => {
    const drift = computeDrift([{ id: "t1" }], [{ tripId: "t1" }]);
    expect(drift).toEqual([
      { id: "t1", name: "(unnamed)", stored: 0, actual: 1 },
    ]);
  });

  it("ignores orphan favorites that point at no existing trip", () => {
    const drift = computeDrift(
      [{ id: "t1", name: "A", favoriteCount: 0 }],
      [{ tripId: "ghost" }],
    );
    expect(drift).toEqual([]);
  });
});
