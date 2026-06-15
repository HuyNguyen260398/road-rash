# GSAP Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer a cohesive GSAP motion system onto the existing road-rash frontend — entrance/parallax, card hover + heart pop, a rect-anchored modal transition, and search/filter/header micro-interactions — without changing layout, features, or data flow.

**Architecture:** Pure motion tokens + config-builders live in `lib/motion.ts` (unit-tested in node). A separate `lib/gsap.ts` owns the gsap import + plugin registration. A `GsapProvider` client component registers plugins once at the app root. Each animated component stays a client island using `@gsap/react`'s `useGSAP({ scope })`, with all motion gated behind `gsap.matchMedia()` for `prefers-reduced-motion` (and `pointer: fine` for hover). Existing CSS animations (`float-up`, `shimmer`, `ken-burns`) stay as-is — we layer, not migrate.

**Tech Stack:** Next.js 16 (App Router, SSR), React 19, TypeScript, Tailwind v4, `gsap` + `@gsap/react` + `ScrollTrigger`, Vitest (node).

**Conventions:**
- **One commit per completed task.** Each task below ends in a commit. Don't batch.
- Every commit must leave the build green: `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build`.
- `@/` maps to repo root (tsconfig paths).

---

### Task 1: Install GSAP dependencies

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
pnpm add gsap @gsap/react
```
Expected: `gsap` and `@gsap/react` appear under `dependencies` in `package.json`; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify install + typecheck still passes**

Run: `pnpm build`
Expected: build succeeds (no usage yet, just dependency resolution).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(motion): add gsap + @gsap/react dependencies"
```

---

### Task 2: Pure motion tokens and config-builders

Pure module: tokens + plain gsap-vars builders, **no gsap import**, so it runs in the node Vitest env. This is the single source of timing/easing.

**Files:**
- Create: `lib/motion.ts`
- Test: `lib/motion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/motion.test.ts`:
```ts
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
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: no-preference)");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/motion.test.ts`
Expected: FAIL — cannot resolve `./motion`.

- [ ] **Step 3: Write the implementation**

Create `lib/motion.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/motion.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Format, then commit**

```bash
pnpm format
git add lib/motion.ts lib/motion.test.ts
git commit -m "feat(motion): add pure motion tokens + config builders"
```

---

### Task 3: GSAP runtime + plugin registration provider

Isolate the gsap import and one-time plugin registration, then mount a no-output provider at the app root.

**Files:**
- Create: `lib/gsap.ts`
- Create: `components/GsapProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the runtime module**

Create `lib/gsap.ts`:
```ts
// Runtime gsap surface: the single place that imports gsap + plugins and
// registers them exactly once. Components import { gsap } from here (never from
// "gsap" directly) so registration is guaranteed before use.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** Idempotent — safe to call from every island and from GsapProvider. */
export function registerGsap(): void {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export { gsap, ScrollTrigger };
```

- [ ] **Step 2: Create the provider component**

Create `components/GsapProvider.tsx`:
```tsx
"use client";

import { useEffect } from "react";
import { registerGsap } from "@/lib/gsap";

// Registers gsap plugins once for the whole app. Renders nothing.
export default function GsapProvider() {
  useEffect(() => {
    registerGsap();
  }, []);
  return null;
}
```

- [ ] **Step 3: Mount it in the root layout**

In `app/layout.tsx`, add the import alongside the others:
```tsx
import GsapProvider from "@/components/GsapProvider";
```
Then render it inside `<body>` just after `<ConfigureAmplifyClientSide />`:
```tsx
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <ConfigureAmplifyClientSide />
        <GsapProvider />
        <ThemeProvider>
          <FavoritesProvider>{children}</FavoritesProvider>
        </ThemeProvider>
      </body>
```

- [ ] **Step 4: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 5: Format, then commit**

```bash
pnpm format
git add lib/gsap.ts components/GsapProvider.tsx app/layout.tsx
git commit -m "feat(motion): add gsap runtime + plugin registration provider"
```

---

### Task 4: Discover hero entrance + background parallax

Make `DiscoverHero` a client island; stagger the content in on mount and add a scrubbed parallax wrapper around the ken-burns background (the ken-burns CSS stays — parallax lives on a separate overscan wrapper so the two transforms don't fight).

**Files:**
- Modify: `components/DiscoverHero.tsx`

- [ ] **Step 1: Convert to a client island and add refs/markers**

At the very top of `components/DiscoverHero.tsx`, add the directive and imports:
```tsx
"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import {
  DURATION,
  EASE,
  STAGGER,
  REDUCED_MOTION_QUERY,
  revealFrom,
  parallaxTo,
} from "@/lib/motion";
```
(Keep the existing `Link` / lucide / ui imports.)

- [ ] **Step 2: Wrap the background in an overscan parallax wrapper**

Replace the current background block:
```tsx
      <div
        aria-hidden
        className="hero-kenburns absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-road.jpg')" }}
      />
```
with a wrapper (`.hero-bg`) that is taller than the section so the parallax shift never reveals an edge:
```tsx
      <div aria-hidden className="hero-bg absolute -inset-y-[12%] inset-x-0 -z-10">
        <div
          className="hero-kenburns absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-road.jpg')" }}
        />
      </div>
```

- [ ] **Step 3: Add the section ref + stagger markers**

Change the `<section ...>` opening tag to capture a ref:
```tsx
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.from(".hero-stagger", {
          ...revealFrom(),
          duration: DURATION.base,
          ease: EASE.out,
          stagger: STAGGER.base,
        });
        gsap.to(".hero-bg", {
          ...parallaxTo(12),
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });
    },
    { scope: root },
  );
```
Place the `const root`/`useGSAP` block right after the existing `const stats = [...]` array and before the `return`.

Then add `ref={root}` to the `<section>` and the class `hero-stagger` to each element you want to cascade in: the `Badge` ("Community road trips"), the `<div className="space-y-4">` (headline + subcopy), and the CTA `<div className="flex flex-col gap-3 sm:flex-row">`. Example for the badge:
```tsx
          <Badge
            variant="outline"
            className="hero-stagger w-fit border-white/40 bg-white/10 text-white"
          >
```

- [ ] **Step 4: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 5: Manual check**

Run `pnpm dev`, load `/`. Expected: hero badge → headline/subcopy → CTAs cascade up on load; the background drifts slower than the page on scroll. Toggle OS "reduce motion" → content appears instantly, no parallax.

- [ ] **Step 6: Format, then commit**

```bash
pnpm format
git add components/DiscoverHero.tsx
git commit -m "feat(motion): hero entrance stagger + background parallax"
```

---

### Task 5: Trip card hover lift + favorite heart pop

Pointer-fine hover lift on the card, and a `back.out` pop on the heart when it toggles on. No logic changes to `FavoritesProvider`.

**Files:**
- Modify: `components/TripCard.tsx`

- [ ] **Step 1: Add imports + refs**

Add to the imports at the top of `components/TripCard.tsx`:
```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import {
  DURATION,
  EASE,
  POINTER_FINE_QUERY,
  REDUCED_MOTION_QUERY,
} from "@/lib/motion";
```
(Merge `useRef` into the existing `react` import if you prefer.)

- [ ] **Step 2: Add hover lift (pointer-fine only)**

Inside the component body, before `return`, add a ref and hover setup:
```tsx
  const cardRef = useRef<HTMLAnchorElement>(null);
  const heartRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(POINTER_FINE_QUERY, () => {
        const el = cardRef.current;
        if (!el) return;
        const lift = gsap.quickTo(el, "y", {
          duration: DURATION.fast,
          ease: EASE.out,
        });
        const onEnter = () => lift(-6);
        const onLeave = () => lift(0);
        el.addEventListener("pointerenter", onEnter);
        el.addEventListener("pointerleave", onLeave);
        return () => {
          el.removeEventListener("pointerenter", onEnter);
          el.removeEventListener("pointerleave", onLeave);
        };
      });
    },
    { scope: cardRef },
  );
```
Attach the ref to the `<Link>`: `ref={cardRef}` (alongside its existing props).

- [ ] **Step 3: Add the heart pop on toggle-on**

Add a second hook keyed to `favorited` (skips the first render and respects reduced motion):
```tsx
  const heartReady = useRef(false);
  useGSAP(
    () => {
      if (!heartReady.current) {
        heartReady.current = true;
        return;
      }
      if (!favorited || !heartRef.current) return;
      if (!window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      gsap.fromTo(
        heartRef.current,
        { scale: 0.5 },
        { scale: 1, duration: DURATION.base, ease: EASE.pop },
      );
    },
    { dependencies: [favorited], scope: cardRef },
  );
```
Attach the ref to the `HeartIcon` in the favorite button: `ref={heartRef}` (lucide icons forward refs).

- [ ] **Step 4: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 5: Manual check**

`pnpm dev`, hover a card on desktop → it lifts slightly and settles. Click the heart while signed in → it pops. Reduced-motion → no lift/pop, favorite still toggles.

- [ ] **Step 6: Format, then commit**

```bash
pnpm format
git add components/TripCard.tsx
git commit -m "feat(motion): trip card hover lift + favorite heart pop"
```

---

### Task 6: Scroll-reveal for grouped sections

Grouped view renders every card at once, so lower groups finish their CSS `float-up` long before they're scrolled to. Reveal grouped cards as they enter the viewport instead. The flat paginated list keeps CSS `float-up` (those cards mount as you scroll). To avoid double animation, grouped cards render with `animate={false}` and get GSAP reveal.

**Files:**
- Modify: `components/TripGrid.tsx`

- [ ] **Step 1: Add imports**

At the top of `components/TripGrid.tsx`:
```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { revealFrom, revealTo, REDUCED_MOTION_QUERY } from "@/lib/motion";
```
(Merge `useRef` with the existing `useState` import from react.)

- [ ] **Step 2: Add a reveal wrapper around the grouped sections**

Replace the grouped-branch body. Change:
```tsx
  } else if (groups) {
    body = (
      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.label}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{group.label}</h2>
              <Badge variant="outline" className="bg-background">
                {group.trips.length}
              </Badge>
            </div>
            <Cards trips={group.trips} onOpen={setSelected} animate />
          </section>
        ))}
      </div>
    );
  } else {
```
to use a new `RevealGroups` component (defined next) with `animate` off:
```tsx
  } else if (groups) {
    body = <RevealGroups groups={groups} onOpen={setSelected} />;
  } else {
```

- [ ] **Step 3: Define the `RevealGroups` component**

Add this component above `export default function TripGrid`:
```tsx
// Grouped sections render all cards at once, so we reveal each card as it enters
// the viewport (ScrollTrigger.batch) rather than letting the CSS float-up fire on
// mount for cards far below the fold. Reduced-motion users see them immediately.
function RevealGroups({
  groups,
  onOpen,
}: {
  groups: TripGridGroup[];
  onOpen: (trip: Trip) => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const cards = gsap.utils.toArray<HTMLElement>(
          root.current!.querySelectorAll("[data-reveal]"),
        );
        gsap.set(cards, revealFrom());
        ScrollTrigger.batch(cards, {
          start: "top 90%",
          onEnter: (batch) =>
            gsap.to(batch, { ...revealTo(), stagger: 0.06, overwrite: true }),
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xl font-semibold">{group.label}</h2>
            <Badge variant="outline" className="bg-background">
              {group.trips.length}
            </Badge>
          </div>
          <Cards trips={group.trips} onOpen={onOpen} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Mark grouped cards as reveal targets**

In the `Cards` component, add a `reveal` flag and stamp `data-reveal` on each card so `ScrollTrigger.batch` can find them. Update the `Cards` signature and the `TripCard` usage:
```tsx
function Cards({
  trips,
  onOpen,
  animate,
  reveal,
}: {
  trips: Trip[];
  onOpen: (trip: Trip) => void;
  animate?: boolean;
  reveal?: boolean;
}) {
  return (
    <div className={GRID_CLASS}>
      {trips.map((trip, i) => (
        <TripCard
          key={trip.id}
          trip={trip}
          onOpen={onOpen}
          data-reveal={reveal ? "" : undefined}
          className={animate ? "animate-float-up" : undefined}
          style={
            animate
              ? {
                  animationDelay: `${Math.min(i, STAGGER_CAP) * STAGGER_STEP_MS}ms`,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
```
In `RevealGroups`, pass `reveal`: change `<Cards trips={group.trips} onOpen={onOpen} />` to `<Cards trips={group.trips} onOpen={onOpen} reveal />`.

- [ ] **Step 5: Forward `data-reveal` through TripCard**

In `components/TripCard.tsx`, accept and spread arbitrary `data-*` attributes. Add `...rest` to the props and spread it on the `<Link>`:
```tsx
export default function TripCard({
  trip,
  onOpen,
  className,
  style,
  ...rest
}: {
  trip: Trip;
  onOpen?: (trip: Trip) => void;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLAnchorElement>) {
```
Then on the `<Link>` add `{...rest}` (after the existing props).

- [ ] **Step 6: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 7: Manual check**

`pnpm dev`, open the browser, pick a "Group by" option. Scroll down → cards in lower groups fade/rise in as they enter view. Reduced-motion → all visible immediately.

- [ ] **Step 8: Format, then commit**

```bash
pnpm format
git add components/TripGrid.tsx components/TripCard.tsx
git commit -m "feat(motion): scroll-reveal grouped trip sections"
```

---

### Task 7: Rect-anchored trip detail modal transition

The modal grows from the clicked card's screen position on open and shrinks back on close (with a content stagger), all gated on reduced motion. This requires passing the clicked card's `DOMRect` through `onOpen`, and a short delayed unmount for the exit animation.

**Files:**
- Modify: `components/TripCard.tsx`
- Modify: `components/TripGrid.tsx`
- Modify: `components/TripDetailModal.tsx`
- Modify: `components/TripDetail.tsx`

- [ ] **Step 1: Pass the card rect through `onOpen` (TripCard)**

In `components/TripCard.tsx`, change the `onOpen` prop type and `handleClick`:
```tsx
  onOpen?: (trip: Trip, rect: DOMRect) => void;
```
```tsx
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!onOpen) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();
    onOpen(trip, e.currentTarget.getBoundingClientRect());
  }
```

- [ ] **Step 2: Store the rect in TripGrid**

In `components/TripGrid.tsx`, change the selection state to hold the rect and update the open handler + modal render. Replace:
```tsx
  const [selected, setSelected] = useState<Trip | null>(null);
```
with:
```tsx
  const [selected, setSelected] = useState<{
    trip: Trip;
    rect: DOMRect;
  } | null>(null);
  const openTrip = (trip: Trip, rect: DOMRect) => setSelected({ trip, rect });
```
Replace every `onOpen={setSelected}` and `onOpen={onOpen}` chain so the grid passes `openTrip` down. Specifically: in the grouped branch `<RevealGroups groups={groups} onOpen={openTrip} />`, in `PaginatedCards` the prop is already named `onOpen` (pass `openTrip` from `TripGrid` into `PaginatedCards`), and `RevealGroups`/`Cards`/`PaginatedCards` `onOpen` types become `(trip: Trip, rect: DOMRect) => void`. Update the modal render at the bottom:
```tsx
      {selected ? (
        <TripDetailModal
          trip={selected.trip}
          sourceRect={selected.rect}
          onClose={() => setSelected(null)}
        />
      ) : null}
```
Update the three helper components' `onOpen` prop types from `(trip: Trip) => void` to `(trip: Trip, rect: DOMRect) => void`.

- [ ] **Step 3: Rewrite TripDetailModal with the animated open/close**

Replace the contents of `components/TripDetailModal.tsx` with:
```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { XIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { DURATION, EASE, REDUCED_MOTION_QUERY } from "@/lib/motion";
import TripDetail from "./TripDetail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Trip } from "@/lib/types";

// Trip detail modal (TASK-043). The card grows from the tapped card's screen
// position (sourceRect) on open and shrinks back on close; reduced-motion users
// get an instant open/close. Esc + overlay click play the exit, then unmount.

export default function TripDetailModal({
  trip,
  sourceRect,
  onClose,
}: {
  trip: Trip;
  sourceRect?: DOMRect;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const animate = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    if (!animate || !cardRef.current || !overlayRef.current) {
      onClose();
      return;
    }
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(
      cardRef.current,
      {
        autoAlpha: 0,
        scale: 0.92,
        duration: DURATION.fast,
        ease: EASE.inOut,
      },
      0,
    ).to(
      overlayRef.current,
      { autoAlpha: 0, duration: DURATION.fast },
      0,
    );
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.from(overlayRef.current, {
          autoAlpha: 0,
          duration: DURATION.fast,
          ease: EASE.out,
        });
        const card = cardRef.current!;
        const cr = card.getBoundingClientRect();
        let fromVars: gsap.TweenVars = {
          autoAlpha: 0,
          scale: 0.92,
          transformOrigin: "center center",
        };
        if (sourceRect) {
          const originX =
            ((sourceRect.left + sourceRect.width / 2 - cr.left) / cr.width) *
            100;
          const originY =
            ((sourceRect.top + sourceRect.height / 2 - cr.top) / cr.height) *
            100;
          fromVars = {
            autoAlpha: 0,
            scale: Math.max(0.2, sourceRect.width / cr.width),
            transformOrigin: `${originX}% ${originY}%`,
          };
        }
        gsap.from(card, {
          ...fromVars,
          duration: DURATION.base,
          ease: EASE.out,
        });
        gsap.from(card.querySelectorAll("[data-stagger]"), {
          autoAlpha: 0,
          y: 12,
          duration: DURATION.base,
          ease: EASE.out,
          stagger: 0.06,
          delay: 0.08,
        });
      });
    },
    { scope: overlayRef },
  );

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={trip.name}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
      onClick={close}
    >
      <Card
        ref={cardRef}
        className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto shadow-2xl sm:max-h-[calc(100dvh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex justify-end bg-card/90 p-3 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close trip details"
            className="size-9"
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        <div className="-mt-3">
          <TripDetail key={trip.id} trip={trip} />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Add stagger markers in TripDetail**

In `components/TripDetail.tsx`, add `data-stagger` to the top-level children of the `<article>`: the `<header>`, the `<dl>`, the description `<p>` (when rendered), and the map `<section>`. Example:
```tsx
    <article className="flex flex-col gap-6 p-5 sm:p-6">
      <header data-stagger className="flex flex-col gap-3">
```
Repeat for `<dl data-stagger ...>`, `<p data-stagger ...>` (description), and `<section data-stagger ...>` (map). These are decorative hooks; they don't change layout.

- [ ] **Step 5: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed (watch for the `onOpen` signature change propagating through `TripGrid` helpers).

- [ ] **Step 6: Manual check**

`pnpm dev`. Click a card → modal grows from that card and content staggers in. Esc / click-outside / X → modal shrinks back, then unmounts. Open `/trip/[id]` directly → centered scale+fade (no source rect). Reduced-motion → instant open/close, Esc/overlay still close.

- [ ] **Step 7: Format, then commit**

```bash
pnpm format
git add components/TripCard.tsx components/TripGrid.tsx components/TripDetailModal.tsx components/TripDetail.tsx
git commit -m "feat(motion): rect-anchored trip detail modal transition"
```

---

### Task 8: Search pill focus + AI loading flourish

Subtle focus emphasis on the search field, and a pulsing flourish on the Ask-AI button while a suggestion request is in flight.

**Files:**
- Modify: `components/SearchPill.tsx`

- [ ] **Step 1: Add imports + refs**

At the top of `components/SearchPill.tsx`:
```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { DURATION, EASE, REDUCED_MOTION_QUERY } from "@/lib/motion";
```

- [ ] **Step 2: Focus emphasis on the form wrapper**

Add a ref to the `<form>` and a focus/blur scale via `useGSAP`. In the component body:
```tsx
  const formRef = useRef<HTMLFormElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const el = formRef.current;
        if (!el) return;
        const input = el.querySelector("#trip-search");
        const to = gsap.quickTo(el, "scale", {
          duration: DURATION.fast,
          ease: EASE.out,
        });
        const onFocus = () => to(1.01);
        const onBlur = () => to(1);
        input?.addEventListener("focus", onFocus);
        input?.addEventListener("blur", onBlur);
        return () => {
          input?.removeEventListener("focus", onFocus);
          input?.removeEventListener("blur", onBlur);
        };
      });
    },
    { scope: formRef },
  );
```
Add `ref={formRef}` to the `<form>`.

- [ ] **Step 3: AI loading pulse keyed to `loading`**

Add a second hook that pulses the submit button while `loading` is true:
```tsx
  const aiBtnRef = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      if (!loading || !aiBtnRef.current) return;
      if (!window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      const tween = gsap.to(aiBtnRef.current, {
        opacity: 0.6,
        duration: DURATION.slow,
        ease: EASE.inOut,
        repeat: -1,
        yoyo: true,
      });
      return () => {
        tween.kill();
        gsap.set(aiBtnRef.current, { opacity: 1 });
      };
    },
    { dependencies: [loading], scope: formRef },
  );
```
Add `ref={aiBtnRef}` to the submit `<Button>` (the "Ask AI" button).

- [ ] **Step 4: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 5: Manual check**

`pnpm dev`, focus the search field → it subtly scales. Type a query and click "Ask AI" → the button pulses while "Asking…", stops when results return. Reduced-motion → no scale/pulse, search/AI still work.

- [ ] **Step 6: Format, then commit**

```bash
pnpm format
git add components/SearchPill.tsx
git commit -m "feat(motion): search pill focus + AI loading flourish"
```

---

### Task 9: Filter chip enter/exit transitions

When active filters appear/clear, animate the active-filter row in instead of popping. (Implemented in `FilterControls`'s active-filter summary region.)

**Files:**
- Modify: `components/FilterControls.tsx`

- [ ] **Step 1: Read the active-filter region**

Open `components/FilterControls.tsx` and locate where active filters / the clear control render (the `hasFilters` branch). Identify the container element that holds the active-filter chips/summary.

- [ ] **Step 2: Add imports + a reveal hook**

At the top:
```tsx
"use client"; // already present — keep the single directive at the top
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { DURATION, EASE, REDUCED_MOTION_QUERY } from "@/lib/motion";
```

- [ ] **Step 3: Animate the active-filter container keyed to the active values**

Wrap the active-filter container with a ref and reveal it when filters change. Add in the component body:
```tsx
  const activeRef = useRef<HTMLDivElement>(null);
  const activeKey = Object.values(filters).filter(Boolean).join("|");

  useGSAP(
    () => {
      if (!activeRef.current) return;
      if (!window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      gsap.from(activeRef.current.children, {
        autoAlpha: 0,
        y: -6,
        duration: DURATION.fast,
        ease: EASE.out,
        stagger: 0.04,
      });
    },
    { dependencies: [activeKey], scope: activeRef },
  );
```
Attach `ref={activeRef}` to the container that wraps the active-filter chips/clear button. If no such dedicated container exists, wrap the chips in a `<div ref={activeRef} className="flex flex-wrap items-center gap-2">…</div>`.

- [ ] **Step 4: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 5: Manual check**

`pnpm dev`, open Show filters, pick a Country/Vehicle → the active-filter chips slide/fade in. Change filters → they re-animate. Reduced-motion → instant.

- [ ] **Step 6: Format, then commit**

```bash
pnpm format
git add components/FilterControls.tsx
git commit -m "feat(motion): filter chip enter transitions"
```

---

### Task 10: Header hide-on-scroll-down

Hide the sticky header when scrolling down, reveal it when scrolling up, using `ScrollTrigger`'s scroll direction. Always visible at the top of the page and under reduced motion.

**Files:**
- Modify: `components/AppHeader.tsx`

- [ ] **Step 1: Add imports + a ref**

At the top of `components/AppHeader.tsx`:
```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { DURATION, EASE, REDUCED_MOTION_QUERY } from "@/lib/motion";
```

- [ ] **Step 2: Add the scroll-direction ScrollTrigger**

In the component body, before `return`:
```tsx
  const headerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_MOTION_QUERY, () => {
        const el = headerRef.current!;
        const show = () =>
          gsap.to(el, { yPercent: 0, duration: DURATION.fast, ease: EASE.out });
        const hide = () =>
          gsap.to(el, {
            yPercent: -100,
            duration: DURATION.fast,
            ease: EASE.inOut,
          });
        ScrollTrigger.create({
          start: "top top-=80", // don't hide until scrolled past the header
          end: "max",
          onUpdate: (self) => {
            // keep the mobile menu reachable while it's open
            if (self.direction === 1) hide();
            else show();
          },
        });
      });
    },
    { scope: headerRef },
  );
```

- [ ] **Step 3: Attach the ref + guard menu-open**

Add `ref={headerRef}` to the `<header>`. To avoid hiding while the mobile menu is open, ensure the hide call is skipped when `menuOpen`: change `if (self.direction === 1) hide();` to `if (self.direction === 1 && !menuOpen) hide();` and add `menuOpen` is read via a ref to stay current inside the ScrollTrigger callback:
```tsx
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
```
then use `!menuOpenRef.current` in the callback. Add `menuOpenRef` near the other refs.

- [ ] **Step 4: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 5: Manual check**

`pnpm dev`. Scroll down → header slides up out of view; scroll up → it slides back. At the very top it's always visible. Open the mobile menu and scroll → header stays. Reduced-motion → header stays put (sticky as before).

- [ ] **Step 6: Format, then commit**

```bash
pnpm format
git add components/AppHeader.tsx
git commit -m "feat(motion): header hide-on-scroll-down"
```

---

### Task 11: Full verification + manual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run:
```bash
pnpm test && pnpm lint && pnpm format:check && pnpm build
```
Expected: all pass. Fix anything that fails (then re-run).

- [ ] **Step 2: Manual QA matrix**

In `pnpm dev`, verify each surface in three conditions — motion on, OS reduced-motion on, and (where relevant) touch vs. pointer-fine:
- Hero entrance + parallax
- Card hover lift + heart pop
- Grouped scroll reveal
- Modal open/close (from card, and via `/trip/[id]`)
- Search focus + AI pulse
- Filter chip transitions
- Header hide/show on scroll

Confirm: no console errors, no layout shift, no stuck states on touch, and content is always present under reduced motion.

- [ ] **Step 3: Commit (only if Step 1/2 required fixes)**

```bash
git add -A
git commit -m "fix(motion): QA pass adjustments"
```
(Skip if nothing changed.)

---

## Self-review notes (spec coverage)

- **Architecture & integration** → Tasks 1–3 (deps, `lib/motion.ts`, `lib/gsap.ts`, `GsapProvider`, layout mount).
- **Reduced motion via `gsap.matchMedia()`** → every animated task wraps motion in `matchMedia(REDUCED_MOTION_QUERY)` (or `window.matchMedia` for one-shots).
- **Pointer-fine hover** → Task 5.
- **Hero entrance + parallax** → Task 4.
- **Cards hover + heart pop** → Task 5; **scroll reveal** → Task 6.
- **Modal transition (rect-anchored scale+fade per refined spec)** → Task 7.
- **Search focus + AI flourish** → Task 8; **filter chips** → Task 9; **header show/hide** → Task 10.
- **Performance** → transform/opacity only; `useGSAP` scope auto-kills ScrollTriggers; plugins registered once.
- **Testing** → `lib/motion.test.ts` (Task 2); component motion verified manually (no jsdom infra); full gate in Task 11.
- **Out of scope** (SplitText, smooth-scroll, page transitions, migrating CSS) → not present in any task.
