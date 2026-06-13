import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("omits false conditional values", () => {
    expect(cn("base", false && "hidden", null, undefined, "visible")).toBe(
      "base visible",
    );
  });

  it("keeps the later conflicting Tailwind class", () => {
    expect(cn("rounded-sm px-2 text-sm", "px-4 text-lg")).toBe(
      "rounded-sm px-4 text-lg",
    );
  });
});
