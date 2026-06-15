import { describe, expect, it } from "vitest";
import {
  DURATION,
  EASE,
  STAGGER,
  REDUCED_MOTION_QUERY,
  POINTER_FINE_QUERY,
  revealFrom,
  revealTo,
  parallaxTo,
} from "./motion";

describe("motion tokens", () => {
  it("exposes ordered duration tokens", () => {
    expect(DURATION.fast).toBeLessThan(DURATION.base);
    expect(DURATION.base).toBeLessThan(DURATION.slow);
  });

  it("exposes named eases", () => {
    expect(EASE.out).toBe("power3.out");
    expect(EASE.inOut).toBe("power2.inOut");
    expect(EASE.pop).toBe("back.out(1.7)");
  });

  it("exposes stagger tokens", () => {
    expect(STAGGER.base).toBeGreaterThan(0);
  });

  it("exposes media-query constants", () => {
    expect(REDUCED_MOTION_QUERY).toBe(
      "(prefers-reduced-motion: no-preference)",
    );
    expect(POINTER_FINE_QUERY).toBe("(pointer: fine)");
  });
});

describe("motion config-builders", () => {
  it("revealFrom starts hidden and offset down", () => {
    expect(revealFrom()).toEqual({ autoAlpha: 0, y: 24 });
  });

  it("revealTo lands at rest with defaults, overridable", () => {
    expect(revealTo()).toMatchObject({
      autoAlpha: 1,
      y: 0,
      duration: DURATION.base,
      ease: EASE.out,
    });
    expect(revealTo({ duration: 1 }).duration).toBe(1);
  });

  it("parallaxTo moves with no ease for scrubbing", () => {
    expect(parallaxTo(10)).toEqual({ yPercent: 10, ease: "none" });
  });
});
