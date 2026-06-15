# GSAP Motion Polish — Design

- **Status:** Approved (design)
- **Date:** 2026-06-15
- **Owner:** Huy Nguyen
- **Scope:** UI/UX enhancement — cohesive motion system layered onto the existing road-rash frontend

## Goal

Add refined, tasteful micro-interactions and transitions across the app's main
surfaces to make it feel premium, **without changing layout or features**. Motion
is introduced through a single, cohesive system (shared timing/easing tokens and
reusable helpers) so everything feels designed by one hand.

This is a **polish & delight** pass, not an overhaul. We **layer GSAP on top** of
the existing, working CSS animations rather than migrating them.

## Non-goals (out of scope)

- Migrating existing CSS animations (`float-up` card reveal, `shimmer` skeletons,
  hero `ken-burns`) to GSAP — they keep their own CSS `prefers-reduced-motion` guards.
- `SplitText` headline effects, `Observer`/smooth-scroll, route/page transitions.
- Any change to data flow, API, auth, or business logic.

These are reserved for a possible later phase.

## Approach (selected)

**Cohesive motion system.** `gsap` + `ScrollTrigger` + `Flip` + `@gsap/react`,
organized around a small central motion config and reusable hooks/helpers, covering
all four primary surfaces. One `prefers-reduced-motion` gate governs everything.

Rejected alternatives:
- **Minimal/targeted** (gsap core only, no scroll work) — too limited for "cohesive
  polish across all surfaces."
- **Maximal** (SplitText, smooth-scroll, page transitions) — drifts into a full
  overhaul, adds perf risk, fights Next.js SSR navigation.

## Architecture & integration

### Packages
- `gsap` (core)
- `@gsap/react` — provides `useGSAP()`; handles React 19 cleanup, SSR-safe.
- Plugins: `ScrollTrigger` (scroll reveal + parallax), `Flip` (card→modal).

Estimated client bundle: ~40 kb gzip, code-split into the islands that use it.

### Central motion config — `lib/motion.ts`
The heart of the system. Exports:
- `DURATION` tokens, e.g. `{ fast: 0.2, base: 0.4, slow: 0.7 }`.
- `EASE` tokens, e.g. `{ out: "power3.out", inOut: "power2.inOut", pop: "back.out(1.7)" }`.
- `registerGsap()` — registers plugins exactly once (idempotent).
- Reusable factory helpers: `revealOnScroll(targets, opts)`, `parallax(target, opts)`,
  so each surface composes the same primitives instead of hand-rolling tweens.

### Plugin registration — `components/GsapProvider.tsx`
A `"use client"` component mounted high in `app/layout.tsx`. Calls `registerGsap()`
on mount; renders no visual output. Keeps registration out of individual islands.

### Per-component usage pattern
Each animated component stays a client island and uses
`useGSAP(() => { ... }, { scope: ref })`. Scoping to a ref keeps selectors local and
makes cleanup automatic — no leaked ScrollTriggers across route changes.

### Reduced motion
Every animation is wrapped in `gsap.matchMedia()` with a
`(prefers-reduced-motion: no-preference)` query. Reduced-motion users get final
states instantly, with no separate code path. (Existing CSS animations keep their
own guards since we're layering, not migrating.)

## Per-surface motion spec

### Discover hero (`components/DiscoverHero.tsx`)
- Mount timeline: headline → subcopy → stats → CTAs stagger up + fade
  (`DURATION.base`, `EASE.out`, ~0.08s stagger).
- Background parallax: scrubbed `ScrollTrigger` `y` drift on the image wrapper so it
  moves slower than the page. Existing ken-burns CSS stays.

### Trip cards & grid (`components/TripCard.tsx`, `components/TripGrid.tsx`)
- Scroll reveal: cards `revealOnScroll` as they enter the viewport, so infinite-load
  batches and below-the-fold cards animate in. Existing CSS `float-up` stays for first
  paint.
- Hover (pointer-fine only): subtle lift + shadow + small thumbnail scale. No tilt.
- Favorite heart: `back.out` "pop" scale on toggle-on, layered over the existing
  optimistic toggle — no change to `FavoritesProvider` logic.

### Trip detail modal (`components/TripDetailModal.tsx`)
- Open: `Flip` transition from the tapped card's thumbnail into the modal + backdrop
  blur/opacity fade + content stagger.
- Close: reverse — content fades, card returns to grid position.
- Fallback: simple scale+fade when no source element is available (deep-link /
  `/trip/[id]` share page).
- **Plumbing change:** pass the tapped card's element ref (or `id`) through `onOpen`
  so `Flip` can read the start state. This is the only component-contract change.

### Header, search & filters (`components/AppHeader.tsx`, `SearchPill.tsx`, `FilterControls.tsx`, `TripBrowser.tsx`)
- Search pill: focus animation — subtle scale + ring ease on focus, settle on blur.
- Filter chips: enter/exit transitions (fade + slide) when filters change.
- Header: show/hide on scroll direction via `ScrollTrigger` (hide down, reveal up).
- AI suggest: loading flourish (pulse/shimmer) while the Gemini call is in flight;
  staggered reveal of ranked results when they return.

## Accessibility

- All motion behind `gsap.matchMedia()` `(prefers-reduced-motion: no-preference)`.
- Hover/scale gated to `(pointer: fine)` — no stuck hover states on touch.
- `Flip` modal: existing focus management + Esc-to-close stay; content is interactive
  on timeline complete and instantly available under reduced motion.
- No animation traps keyboard focus or delays content for screen readers.

## Performance

- Animate only `transform` and `opacity` (GPU-friendly); no layout-thrashing props.
- Plugins registered once via `GsapProvider`; per-component `useGSAP` scopes auto-kill
  ScrollTriggers on unmount.
- `ScrollTrigger` instances minimal and scoped; parallax uses `scrub`.

## Testing

Vitest is unit-focused and jsdom has no layout engine, so we do not assert pixel
motion.

- Unit-test `lib/motion.ts` pure exports: tokens present, `revealOnScroll`/`parallax`
  return configured instances, `registerGsap` idempotent.
- Keep existing component tests green — animations are additive. Update only the test(s)
  where a component now needs a ref/id through `onOpen`.
- Manual verification checklist (per surface): motion on; reduced-motion on; touch vs.
  pointer-fine.
- Gate: `pnpm build` (tsc) + `pnpm lint` + `pnpm test`.

## Risks

- **`Flip` modal complexity** — highest effort, only piece touching component plumbing.
  Mitigation: ship the scale+fade fallback first, then enhance to `Flip`.
- **ScrollTrigger leaks across route changes** — mitigated by `useGSAP` ref scoping.
- **Bundle growth** — mitigated by client-only code-splitting; revisit if it regresses.
