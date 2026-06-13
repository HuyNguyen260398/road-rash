import { describe, expect, it } from "vitest";
import { avatarInitial } from "./avatar";

describe("avatarInitial", () => {
  it("returns the uppercased first letter of the email", () => {
    expect(avatarInitial("huy@example.com")).toBe("H");
  });

  it("trims surrounding whitespace before taking the first letter", () => {
    expect(avatarInitial("  zoe@example.com  ")).toBe("Z");
  });

  it("falls back to a placeholder for empty or missing input", () => {
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial(undefined)).toBe("?");
    expect(avatarInitial(null)).toBe("?");
  });
});
