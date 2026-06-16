# Landing Page — Design Spec

- **Date:** 2026-06-16
- **Status:** Approved (design); ready for implementation planning
- **Scope:** Replace the current home route (`/`) with a marketing-style landing page and move trip browsing to `/discover`.

## 1. Goal & context

road-rash's home route (`app/page.tsx`) currently doubles as the discover page: a big image hero (`DiscoverHero`) followed immediately by the live `TripBrowser`. We want a true marketing **landing page** at `/` that sells the product before showing the grid, and a dedicated **`/discover`** route for browsing.

The page must respect the project's central constraint: **Google My Maps has no public API.** Trips are user-supplied — the user builds the map by hand in My Maps and pastes the share link. The landing page must communicate this workflow up front so visitors form correct expectations.

### Locked decisions (from brainstorming)

- **A) Replace `/`** with the landing page; move browsing to `/discover`.
- **Primary action: dual CTA, browse-first** — "Explore trips" (primary) + "Sign in to share yours" (secondary).
- **Live data: show real featured trips** — a "Trending routes" strip of real `TripCard`s plus a live trip count, with graceful fallback when the API is unreachable.
- **Structure: classic conversion stack** — Hero → Trending → How it works → Features → Final CTA → Footer.

### Research basis

Current (2025–2026) landing-page UX consensus, used to shape the section order:

- Hero with an **outcome-focused** headline, a product/destination visual (~73% of top pages), **social proof above the fold** (81% of best-in-class), and a risk-reducer near the CTA.
- **Social proof early** — live counts and real content, not just claims.
- A short **"how it works"** (usually 3 steps) — doubly important here to set the My Maps expectation.
- **Feature highlights**, then a **final CTA band**, then footer.
- Keep it **fast** (compressed hero image, minimal JS).

Sources: Web Anatomy (hero/landing anatomy), Framer (2025 best practices), Landingi (2026 best practices), Zoho (2025 examples), LaunchSignal (social proof).

## 2. Routing & structure changes

- **`/` (new landing page)** — server component, `export const dynamic = "force-dynamic"`. Fetches trips for the live count + trending strip; wraps content in `AppShell`. Same try/catch resilience pattern as today's home page (never crashes when the API is down).
- **`/discover` (moved browse experience)** — the current `app/page.tsx` body (the `TripBrowser` section) moves here, fronted by a **slim page header** (title, subtitle, live trip count) instead of the full image hero.
- **`DiscoverHero`** — its big image-hero treatment graduates to the landing page (`LandingHero`). `DiscoverHero` is either retired or slimmed into the compact discover header; no full image hero remains on `/discover`.
- **Navigation** — `AppLogo` repoints from the discover view to `/` (landing). The header gains an "Explore"/"Discover" link → `/discover`. The mobile menu is adjusted to include the same destination. Active-state logic in `AppHeader.isActive` continues to work for the new routes.

## 3. Landing page sections (top → bottom)

1. **Hero (`LandingHero`)** — full-bleed background image, outcome-focused headline, supporting subhead, and a **dual CTA**:
   - Primary: "Explore trips" → `/discover`.
   - Secondary: "Sign in to share yours" → `/login`; swaps to "Create trip" → `/trips/new` when the visitor is signed in (read via `useFavorites()` like the header does).
   - A live **"N trips shared by the community"** count and a one-line trust cue placed near the CTA (social proof above the fold).
   - Reveal animation via the existing `lib/motion` helpers + `gsap.matchMedia` reduced-motion guard (same pattern as `DiscoverHero`).
2. **Trending routes (`TrendingTrips`)** — "Popular right now": up to 6 real `TripCard`s sorted by `favoriteCount`, with a "See all trips →" link to `/discover`. Reuses the existing `TripCard` and the app-wide `FavoritesProvider` (optimistic hearts keep working). Section is omitted gracefully when there are no trips or the fetch failed.
3. **How it works (`HowItWorks`)** — three numbered steps that set the My Maps expectation:
   1. Build your route in Google My Maps.
   2. Paste the share link and add trip details.
   3. Share it and discover others'.
   Numbered cards with lucide icons.
4. **Feature highlights (`FeatureHighlights`)** — three cards: map-backed plans (embedded My Maps), save favorites, AI trip discovery.
5. **Final CTA band (`LandingCta`)** — repeats the dual CTA on a primary-colored band.
6. **Footer** — existing `AppFooter`, rendered by `AppShell`.

## 4. Components & data flow

- **New components** (`components/`): `LandingHero`, `TrendingTrips`, `HowItWorks`, `FeatureHighlights`, `LandingCta`. Static copy (steps, features) lives in small local config arrays.
- **New pure helper** `lib/trending.ts` → `selectTrending(trips, n)`: sort by `favoriteCount` descending, tiebreak by `createdAt` (newest first), slice to `n`. Co-located `lib/trending.test.ts` (Vitest), matching the repo's "pure helper + test" convention.
- **Data flow:** the `/` server component calls `api.getTrips()`, derives the total count and the trending set (`selectTrending(trips, 6)`), and passes them to `LandingHero` (count) and `TrendingTrips` (trips). `try/catch`: on failure the hero shows a static fallback count/copy and the trending strip is omitted. No new backend routes.

## 5. Styling, performance, accessibility

- Reuses the existing orange/cyan theme tokens, shadcn/ui primitives (`Button`/`buttonVariants`, `Badge`, `Card`), and `lib/motion` — so dark mode, reduced-motion, and the sticky-header behavior all keep working unchanged.
- Optimized/compressed hero image; minimal added client JS (GSAP is already bundled). Client islands limited to what needs interactivity/animation; static sections stay server-rendered where possible.
- Semantic section landmarks and a single `h1` in the hero; the existing skip-link and focus-visible styles cover the new page.

## 6. Testing & verification

- **Unit:** `lib/trending.test.ts` for `selectTrending` (sort order, tiebreak, slice, empty input).
- **Verification gates:** `pnpm test`, `pnpm build` (runs `tsc` typecheck), `pnpm lint`, and `pnpm format:check` before pushing (the PR CI gate). Visual check via `pnpm dev`.

## 7. Out of scope (YAGNI)

Testimonials / FAQ (no real testimonials yet), newsletter signup, blog, PWA, A/B testing, and any new backend routes.
