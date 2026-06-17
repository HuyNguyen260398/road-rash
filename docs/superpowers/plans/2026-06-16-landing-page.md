# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home route (`/`) with a marketing-style landing page and move trip browsing to a new `/discover` route.

**Architecture:** `/` becomes a server component that fetches trips (with graceful fallback), derives a live count + a "trending" subset via a new pure helper, and composes static + live sections (Hero → Trending → How it works → Features → Final CTA). The existing browse experience (`TripBrowser`) moves verbatim to `/discover` behind a slim header. Reuses the existing `TripCard`, `FavoritesProvider`, shadcn primitives, and the `lib/motion` GSAP layer so dark mode, optimistic favorites, and reduced-motion all keep working.

**Tech Stack:** Next.js 16 (App Router, SSR), React 19, Tailwind v4, shadcn/ui, GSAP (`@gsap/react`), lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-landing-page-design.md`

**Conventions for this repo:**
- pnpm only. Verification commands: `pnpm test`, `pnpm build` (runs the `tsc` typecheck), `pnpm lint`, `pnpm format:check`.
- One focused commit per task. Commit messages end with the `Co-Authored-By` trailer shown in the commit steps.
- Tests live next to source as `*.test.ts`. Only **pure helpers** get unit tests in this repo; React components are verified via `pnpm build` (typecheck) + `pnpm lint` + manual `pnpm dev`.
- Work happens on the `feature/landing-page` branch (already created).

---

### Task 1: `selectTrending` pure helper (TDD)

Picks the landing-page "trending" trips: most-favorited first, tie-broken by newest. Pure and dependency-free so it unit-tests in the node Vitest env.

**Files:**
- Create: `lib/trending.ts`
- Test: `lib/trending.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/trending.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { selectTrending } from "./trending";
import type { Trip } from "./types";

// Minimal Trip factory — only the fields selectTrending reads matter; the rest
// are filled with valid placeholders so the object satisfies the Trip type.
function makeTrip(overrides: Partial<Trip> & { id: string }): Trip {
  return {
    name: "Trip",
    description: undefined,
    location: "Somewhere",
    tripType: "ROAD_TRIP",
    city: "City",
    province: "Province",
    country: "Country",
    durationDays: 1,
    vehicle: "CAR",
    thumbnailKey: undefined,
    myMapsUrl: "https://www.google.com/maps/d/embed?mid=abc",
    authorId: "author",
    authorName: "Author",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: undefined,
    favoriteCount: 0,
    ...overrides,
  };
}

describe("selectTrending", () => {
  it("orders by favoriteCount descending", () => {
    const trips = [
      makeTrip({ id: "a", favoriteCount: 1 }),
      makeTrip({ id: "b", favoriteCount: 9 }),
      makeTrip({ id: "c", favoriteCount: 5 }),
    ];
    expect(selectTrending(trips, 3).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks favoriteCount ties by newest createdAt", () => {
    const trips = [
      makeTrip({ id: "old", favoriteCount: 5, createdAt: "2026-01-01T00:00:00.000Z" }),
      makeTrip({ id: "new", favoriteCount: 5, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(selectTrending(trips, 2).map((t) => t.id)).toEqual(["new", "old"]);
  });

  it("slices to n", () => {
    const trips = [
      makeTrip({ id: "a", favoriteCount: 3 }),
      makeTrip({ id: "b", favoriteCount: 2 }),
      makeTrip({ id: "c", favoriteCount: 1 }),
    ];
    expect(selectTrending(trips, 2).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(selectTrending([], 6)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const trips = [
      makeTrip({ id: "a", favoriteCount: 1 }),
      makeTrip({ id: "b", favoriteCount: 9 }),
    ];
    const before = trips.map((t) => t.id);
    selectTrending(trips, 2);
    expect(trips.map((t) => t.id)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/trending.test.ts`
Expected: FAIL — cannot resolve `./trending` / `selectTrending is not a function`.

- [ ] **Step 3: Write the minimal implementation**

`lib/trending.ts`:

```ts
import type { Trip } from "./types";

// Pick the "trending" trips for the landing-page strip: most-favorited first,
// ties broken by most-recently created. Pure and side-effect-free (no gsap / no
// DOM) so it unit-tests in the node Vitest env. Copies the input before sorting
// so callers' arrays are never mutated.
export function selectTrending(trips: Trip[], n: number): Trip[] {
  return [...trips]
    .sort((a, b) => {
      if (b.favoriteCount !== a.favoriteCount) {
        return b.favoriteCount - a.favoriteCount;
      }
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, Math.max(0, n));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/trending.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/trending.ts lib/trending.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): add selectTrending helper for the trending strip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `LandingHero` component

Full-bleed image hero with the outcome headline, dual CTA, and a live trip count. Mirrors the existing `DiscoverHero` GSAP/markup patterns. Client component because it animates and reads signed-in state.

**Files:**
- Create: `components/LandingHero.tsx`

- [ ] **Step 1: Create the component**

`components/LandingHero.tsx`:

```tsx
"use client";

import { useRef } from "react";
import Link from "next/link";
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
import { useFavorites } from "@/components/FavoritesProvider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

// Landing hero (replaces DiscoverHero on the marketing home page). Dual CTA is
// browse-first: "Explore trips" -> /discover; the secondary CTA swaps to
// "Create a trip" once the visitor is signed in (state from FavoritesProvider,
// the app-wide auth source). Animation + reduced-motion guard reuse lib/motion,
// matching the old DiscoverHero so dark mode / scroll behavior stay consistent.
export default function LandingHero({ tripCount }: { tripCount: number }) {
  const { signedIn } = useFavorites();
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

  const countLabel =
    tripCount > 0
      ? `${tripCount.toLocaleString()} trips shared by the community`
      : "Community road trips";

  return (
    <section ref={root} className="relative isolate overflow-hidden bg-muted">
      <div
        aria-hidden
        className="hero-bg absolute inset-x-0 -inset-y-[12%] -z-10"
      >
        <div
          className="hero-kenburns absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-road.jpg')" }}
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/65 to-black/45 lg:via-black/55 lg:to-black/30"
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <Badge
          variant="outline"
          className="hero-stagger w-fit border-white/40 bg-white/10 text-white"
        >
          {countLabel}
        </Badge>
        <h1 className="hero-stagger max-w-3xl text-4xl leading-tight font-semibold text-balance text-white sm:text-5xl lg:text-6xl">
          Real road trips, mapped by the people who rode them.
        </h1>
        <p className="hero-stagger max-w-2xl text-lg leading-8 text-white/85">
          Discover ride-ready routes backed by real Google My Maps, save the
          ones you love, and let AI narrow the community map down to your next
          trip.
        </p>
        <div className="hero-stagger flex flex-col gap-3 sm:flex-row">
          <Link href="/discover" className={buttonVariants({ size: "lg" })}>
            Explore trips
          </Link>
          <Link
            href={signedIn ? "/trips/new" : "/login"}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {signedIn ? "Create a trip" : "Sign in to share yours"}
          </Link>
        </div>
        <p className="hero-stagger text-sm text-white/70">
          Free to browse · No account needed to explore
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS (no errors for `components/LandingHero.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/LandingHero.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add LandingHero with dual browse-first CTA

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `TrendingTrips` component

Renders up to 6 real `TripCard`s in a responsive grid with a "See all trips" link. Plain server component — `TripCard` is a client island and works as a child; with no `onOpen` prop a click navigates to `/trip/[id]` (no modal needed here). Renders nothing when there are no trips, so the section disappears gracefully when the API is down.

**Files:**
- Create: `components/TrendingTrips.tsx`

- [ ] **Step 1: Create the component**

`components/TrendingTrips.tsx`:

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import TripCard from "@/components/TripCard";
import type { Trip } from "@/lib/types";

// "Popular right now" strip on the landing page: real TripCards (reused as-is)
// so the optimistic-favorite hearts keep working via the app-wide
// FavoritesProvider. No onOpen prop -> a card click navigates to /trip/[id]
// rather than opening the modal (the modal lives on /discover). Returns null
// when empty so the section is omitted if there are no trips / the fetch failed.
export default function TrendingTrips({ trips }: { trips: Trip[] }) {
  if (trips.length === 0) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Popular right now</h2>
            <p className="text-sm text-muted-foreground">
              The community&apos;s most-loved routes.
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            See all trips
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </header>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/TrendingTrips.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add TrendingTrips strip reusing TripCard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `HowItWorks` component

Static three-step section that sets the My Maps expectation. Server component (no interactivity).

**Files:**
- Create: `components/HowItWorks.tsx`

- [ ] **Step 1: Create the component**

`components/HowItWorks.tsx`:

```tsx
import { MapIcon, LinkIcon, Share2Icon, type LucideIcon } from "lucide-react";

// The My Maps workflow, stated up front. Google My Maps has no public API, so
// the user builds the map by hand and pastes the share link — these three steps
// set that expectation before someone tries to create a trip.
const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MapIcon,
    title: "Build your route in Google My Maps",
    body: "Drop pins, draw your route, and add stops in the My Maps editor you already know.",
  },
  {
    icon: LinkIcon,
    title: "Paste the share link",
    body: "Copy your My Maps share link into the trip form, then add the details: vehicle, duration, and where it goes.",
  },
  {
    icon: Share2Icon,
    title: "Share & discover",
    body: "Publish your trip for the community and explore map-backed routes other riders have shared.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-muted">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <p className="mt-2 text-muted-foreground">
            Road Rash is built around the Google My Maps you already make — three
            steps from idea to a shared trip.
          </p>
        </header>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="relative rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <p className="mb-1 text-sm font-medium text-muted-foreground">
                Step {i + 1}
              </p>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS. (If lint flags `LinkIcon`/`Share2Icon` as missing, the lucide-react export name is wrong — but these `*Icon` aliases match the codebase convention, e.g. `MapIcon` in `DiscoverHero.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add components/HowItWorks.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add HowItWorks section explaining the My Maps flow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `FeatureHighlights` component

Static three-card feature section (map-backed plans, favorites, AI discovery). Server component.

**Files:**
- Create: `components/FeatureHighlights.tsx`

- [ ] **Step 1: Create the component**

`components/FeatureHighlights.tsx`:

```tsx
import { MapIcon, HeartIcon, SparklesIcon, type LucideIcon } from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MapIcon,
    title: "Map-backed plans",
    body: "Every trip embeds a real Google My Maps route — no vague itineraries, just the actual path on the map.",
  },
  {
    icon: HeartIcon,
    title: "Save your favorites",
    body: "Heart any route to build your own shortlist, then come back to it from your saved trips.",
  },
  {
    icon: SparklesIcon,
    title: "AI trip discovery",
    body: "Describe the trip you want and let AI rank the community's routes down to the best matches.",
  },
];

export default function FeatureHighlights() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Everything you need to plan the next ride
          </h2>
        </header>
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/FeatureHighlights.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add FeatureHighlights section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `LandingCta` component

Final call-to-action band on the primary color, repeating the dual CTA. Client component because the secondary CTA depends on signed-in state.

**Files:**
- Create: `components/LandingCta.tsx`

- [ ] **Step 1: Create the component**

`components/LandingCta.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useFavorites } from "@/components/FavoritesProvider";
import { buttonVariants } from "@/components/ui/button";

// Closing CTA band. Mirrors the hero's browse-first dual CTA; the secondary
// action swaps to "Create a trip" once signed in (state from FavoritesProvider).
export default function LandingCta() {
  const { signedIn } = useFavorites();

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold text-balance sm:text-4xl">
          Your next route is waiting
        </h2>
        <p className="max-w-2xl text-lg text-primary-foreground/90">
          Browse community trips or share your own map-backed plan — it only
          takes a My Maps link.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/discover"
            className={buttonVariants({ size: "lg", variant: "secondary" })}
          >
            Explore trips
          </Link>
          <Link
            href={signedIn ? "/trips/new" : "/login"}
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            {signedIn ? "Create a trip" : "Sign in to share yours"}
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/LandingCta.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add closing LandingCta band

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Move the browse experience to `/discover`

Create the new `/discover` route with a slim header + the existing `TripBrowser`. This is the current `app/page.tsx` body, plus a compact header that replaces the big `DiscoverHero`. Leave `app/page.tsx` untouched in this task — Task 8 replaces it.

**Files:**
- Create: `app/discover/page.tsx`

- [ ] **Step 1: Create the route**

`app/discover/page.tsx`:

```tsx
import { AlertTriangleIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import TripBrowser from "@/components/TripBrowser";
import EmptyState from "@/components/EmptyState";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { api } from "@/lib/api-client";
import type { Trip } from "@/lib/types";

// Discover (browse) page. Public, server-rendered: fetch all trips and hand them
// to the client TripBrowser, which runs instant search/filter/group (M5). Moved
// here from the home route when `/` became the marketing landing page; the big
// image hero was replaced by the slim header below.
export const dynamic = "force-dynamic";

export default async function Discover() {
  let trips: Trip[] = [];
  let loadError: string | null = null;

  try {
    const result = await api.getTrips();
    trips = result.trips;
  } catch {
    // API not reachable/configured yet — render the shell with an empty grid
    // rather than crashing.
    loadError = "Please try again in a moment.";
  }

  return (
    <AppShell>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold">Discover trips</h1>
          <p className="mt-2 text-muted-foreground">
            Browse {trips.length.toLocaleString()} travel plan
            {trips.length === 1 ? "" : "s"} shared by the community.
          </p>
        </div>
      </section>
      <section id="trip-browser" className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          {loadError ? (
            <EmptyState
              icon={<AlertTriangleIcon className="size-6" aria-hidden />}
              title="Trips are unavailable right now"
              description={loadError}
            />
          ) : (
            <TripBrowser
              trips={trips}
              emptyMessage="No trips yet — be the first to share one."
            />
          )}
        </div>
      </section>
      <ScrollToTopButton />
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/discover/page.tsx
git commit -m "$(cat <<'EOF'
feat(discover): add /discover route with the trip browser

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Replace the home route with the landing page

Rewrite `app/page.tsx` to compose the landing sections. Fetches trips for the live count + trending set; degrades gracefully (empty trips → static hero + omitted trending strip).

**Files:**
- Modify (full rewrite): `app/page.tsx`

- [ ] **Step 1: Replace the file contents**

`app/page.tsx`:

```tsx
import AppShell from "@/components/AppShell";
import LandingHero from "@/components/LandingHero";
import TrendingTrips from "@/components/TrendingTrips";
import HowItWorks from "@/components/HowItWorks";
import FeatureHighlights from "@/components/FeatureHighlights";
import LandingCta from "@/components/LandingCta";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { api } from "@/lib/api-client";
import { selectTrending } from "@/lib/trending";
import type { Trip } from "@/lib/types";

// Marketing landing page (home). Public, server-rendered: fetch trips for the
// live count + a "trending" strip, then compose the static sections. The browse
// experience lives at /discover. Fetch failures degrade gracefully — the hero
// shows a static label and TrendingTrips renders nothing for an empty set.
export const dynamic = "force-dynamic";

export default async function Home() {
  let trips: Trip[] = [];

  try {
    const result = await api.getTrips();
    trips = result.trips;
  } catch {
    // API not reachable/configured yet (e.g. before terraform apply) — render
    // the static landing shell rather than crashing.
  }

  const trending = selectTrending(trips, 6);

  return (
    <AppShell>
      <LandingHero tripCount={trips.length} />
      <TrendingTrips trips={trending} />
      <HowItWorks />
      <FeatureHighlights />
      <LandingCta />
      <ScrollToTopButton />
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(landing): compose landing page as the home route

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Add a "Discover" nav link and retire `DiscoverHero`

Add a top-level Discover link to the header (desktop + mobile) pointing at `/discover`, and delete the now-unused `DiscoverHero` component. `AppLogo` already links to `/`, which is now the landing page — no change needed there.

**Files:**
- Modify: `components/AppHeader.tsx`
- Delete: `components/DiscoverHero.tsx`

- [ ] **Step 1: Confirm `DiscoverHero` has no remaining references**

Run: `grep -rn "DiscoverHero" app components lib`
Expected: matches only in `components/DiscoverHero.tsx` itself (its old import was removed from `app/page.tsx` in Task 8). If any other file imports it, stop and update that file first.

- [ ] **Step 2: Add the Discover link to the desktop nav**

In `components/AppHeader.tsx`, find the desktop controls block:

```tsx
        <div className="hidden items-center gap-3 lg:flex">
          <ModeToggle />
```

Replace it with (adds the Discover link before `ModeToggle`):

```tsx
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/discover"
            className={navLinkClass(isActive("/discover"))}
          >
            Discover
          </Link>
          <ModeToggle />
```

- [ ] **Step 3: Add the Discover link to the mobile menu**

In `components/AppHeader.tsx`, find the mobile nav list:

```tsx
          <nav
            className="mx-auto flex max-w-7xl flex-col gap-2"
            aria-label="Mobile"
          >
            {ACCOUNT_LINKS.map((item) => (
```

Replace it with (adds a Discover link above the account links):

```tsx
          <nav
            className="mx-auto flex max-w-7xl flex-col gap-2"
            aria-label="Mobile"
          >
            <Link
              href="/discover"
              className={navLinkClass(isActive("/discover"))}
              onClick={closeMenu}
            >
              Discover
            </Link>
            {ACCOUNT_LINKS.map((item) => (
```

- [ ] **Step 4: Delete the unused `DiscoverHero`**

Run: `git rm components/DiscoverHero.tsx`

- [ ] **Step 5: Verify it compiles and lints**

Run: `pnpm lint`
Expected: PASS (no unresolved `DiscoverHero` import, `Link` already imported in `AppHeader.tsx`).

- [ ] **Step 6: Commit**

```bash
git add components/AppHeader.tsx
git commit -m "$(cat <<'EOF'
feat(nav): add Discover link and retire DiscoverHero

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Full verification

Run the complete gate (typecheck via build, tests, lint, format) and a manual visual pass.

- [ ] **Step 1: Tests**

Run: `pnpm test`
Expected: PASS (includes `lib/trending.test.ts`).

- [ ] **Step 2: Build / typecheck**

Run: `pnpm build`
Expected: SUCCESS — `/` and `/discover` both compile; no type errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Format check (CI gate)**

Run: `pnpm format:check`
Expected: PASS. If it reports issues, run `pnpm format` and amend/commit the formatting in the relevant task's files.

- [ ] **Step 5: Manual visual pass**

Run: `pnpm dev`, open `http://localhost:3000`, and confirm:
- Hero renders over `hero-road.jpg` with both CTAs; "Explore trips" → `/discover`, secondary → `/login` when signed out.
- Trending strip shows real cards (or is absent if the API isn't wired locally — expected without backend env).
- How it works, Features, and the CTA band render in order; dark-mode toggle works; header "Discover" link navigates to `/discover`.
- `/discover` shows the slim header + the search/filter browser.

- [ ] **Step 6: Commit any formatting fixes (only if Step 4 required them)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(landing): apply prettier formatting

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Routing `/` → landing, `/discover` → browse — Tasks 7, 8.
- `DiscoverHero` retired; slim discover header — Tasks 7, 9.
- Nav (`AppLogo` → `/`, Discover link, mobile) — Task 9 (AppLogo already at `/`, noted).
- Hero with dual browse-first CTA + live count + social proof above fold — Task 2.
- Trending strip of real TripCards w/ graceful omission — Task 3 (+ helper Task 1, wired in Task 8).
- How it works (My Maps 3 steps) — Task 4.
- Feature highlights — Task 5.
- Final CTA band — Task 6.
- `selectTrending` pure helper + test — Task 1.
- Reuse theme/motion/shadcn; reduced-motion — Tasks 2, 3, 4, 5, 6 (reuse `lib/motion`, shadcn primitives).
- Testing/verification gates — Task 10.
- Out of scope items — none implemented (correct).

**Placeholder scan:** No TBD/TODO; every code step shows full content. No "handle edge cases" hand-waving.

**Type consistency:** `selectTrending(trips: Trip[], n: number): Trip[]` defined in Task 1 and called as `selectTrending(trips, 6)` in Task 8. `LandingHero` takes `{ tripCount: number }` (Task 2) and is called with `tripCount={trips.length}` (Task 8). `TrendingTrips` takes `{ trips: Trip[] }` (Task 3), called `trips={trending}` (Task 8). `useFavorites()` `signedIn` field matches existing usage in `AppHeader.tsx`/`TripCard.tsx`. `navLinkClass`/`isActive`/`closeMenu` referenced in Task 9 all exist in `AppHeader.tsx`.
