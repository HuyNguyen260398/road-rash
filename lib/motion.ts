// Central motion config for the GSAP polish layer. Pure tokens + plain
// gsap-"vars" builders only — no gsap import — so this module is unit-testable
// in the node Vitest env and is the single source of timing/easing across every
// animated surface. Runtime helpers that actually create tweens live in
// lib/gsap.ts and consume these objects.

export const DURATION = { fast: 0.2, base: 0.4, slow: 0.7 } as const;

export const EASE = {
  out: "power3.out",
  inOut: "power2.inOut",
  pop: "back.out(1.7)",
} as const;

export const STAGGER = { tight: 0.06, base: 0.08 } as const;

// Animate only when the user has NOT asked for reduced motion.
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: no-preference)";
// Hover effects only on devices with a precise pointer (no stuck touch states).
export const POINTER_FINE_QUERY = "(pointer: fine)";

type Vars = Record<string, unknown>;

/** Start state for a reveal: hidden + nudged down. */
export function revealFrom(): Vars {
  return { autoAlpha: 0, y: 24 };
}

/** End state for a reveal: visible at rest, with default timing (overridable). */
export function revealTo(overrides: Vars = {}): Vars {
  return {
    autoAlpha: 1,
    y: 0,
    duration: DURATION.base,
    ease: EASE.out,
    ...overrides,
  };
}

/** Scrubbed parallax drift — linear ease so it tracks scroll 1:1. */
export function parallaxTo(yPercent: number): Vars {
  return { yPercent, ease: "none" };
}
