# Road-Rash UX Update — Design Spec

**Date:** 2026-06-13
**Status:** Approved (ready for implementation plan)
**Branch context:** `design/ux-ui-rebuild`

## Summary

A batch of user-facing improvements to the road-rash discovery app: an
auth-aware profile menu with an initial-based avatar, an interactive
favorite/like count on the trip detail view (plus a backend hardening), a
unified search control that merges plain search and AI suggestions, collapsible
filters, a travel-themed animated hero background, a visible owner-only Edit
entry point, and a seed script that loads 12 example trips into staging.

These build on the existing architecture (Next.js App Router SSR, REST Lambdas,
Cognito, DynamoDB). No new architectural patterns or dependencies are introduced.

## Context / current state

Several pieces the requirements imply are already on disk and work:

- **Edit:** `app/trips/[id]/edit/page.tsx` + owner-gated `PUT /trips/{id}`
  (`services/trips/handler.ts`) exist. The gap is only that **nothing links to
  the edit page** — there is no visible Edit affordance for owners.
- **Favorite count:** `services/favorites/handler.ts` already atomically
  increments `Trip.favoriteCount` on favorite (and decrements on unfavorite).
  `TripCard` renders it with an optimistic delta from `FavoritesProvider`. The
  visible "count doesn't go up" comes from **`components/TripDetail.tsx:87`**,
  which renders `trip.favoriteCount` **statically** with no toggle and no
  `countDelta`.
- **Auth client-side:** `fetchAuthSession` (and `signOut`) from
  `aws-amplify/auth` already work in client components (used in
  `lib/api-client.ts`). The navbar (`components/AppHeader.tsx`) does **not**
  currently reflect sign-in state at all.
- **Search/AI:** `components/SearchBar.tsx` (instant, debounced plain search via
  `lib/search.ts`) and `components/AiSuggestBox.tsx` (submit-only `POST /suggest`
  with plain-search fallback) are **separate** components on `app/page.tsx`.
  `components/FilterControls.tsx` is always expanded inside
  `components/TripBrowser.tsx`.

**Not deployed locally:** no live AWS. Staging is deployed from `main` via CI.
Verification is `pnpm test` + `pnpm build`, plus `pnpm dev` for UI and staging
for the seed script.

## Locked decisions (from brainstorming)

1. **Favorite = like.** One concept; favoriting is the like. Make it reliable
   end-to-end and fix where it doesn't show. No separate "like" action.
2. **Seed via script → staging API.** A script POSTs trips to the deployed
   staging `POST /trips` using an `ID_TOKEN` copied from a signed-in browser
   session (the Google-OAuth flow cannot be scripted headlessly).
3. **Unified search:** one input, with an explicit **Ask AI** button *inside*
   the search pill (layout B). AI stays submit-only.
4. **Hero:** full-bleed background image + left→right dark gradient scrim
   (treatment A), with a subtle CSS slow-zoom (Ken-Burns) gated by
   `prefers-reduced-motion`.
5. **Nav:** top nav reduces to **Discover**; **Liked trips** (`/saved`,
   relabeled from "Saved") and **My trips** move into the avatar dropdown.

## Workstreams

### 1. Profile menu + avatar

Make `components/AppHeader.tsx` auth-aware on the client.

- New `components/UserMenu.tsx`: a dropdown button.
  - Reads the session client-side via `fetchAuthSession()`; derives the email
    and the avatar letter = `email[0].toUpperCase()`.
  - Renders a circular avatar button (initial). Click opens a menu containing:
    the email as a non-interactive header, **Liked trips** → `/saved`,
    **My trips** → `/my-trips`, and **Sign out**.
  - **Sign out** calls `signOut()` then routes to `/` and refreshes so SSR
    pages re-render signed-out.
  - Closes on outside click / Escape; keyboard accessible
    (`aria-expanded`, `aria-haspopup`, focusable items).
- `AppHeader`:
  - **Signed out:** unchanged (`Sign in` + `Create trip`).
  - **Signed in:** avatar/`UserMenu` replaces the `Sign in` link; `Create trip`
    stays.
  - Desktop nav `NAV_ITEMS` reduces to `Discover` only. Mobile menu keeps
    Discover + Liked trips + My trips + (signed-in) Sign out so small screens
    keep all destinations reachable.

**Boundaries:** `UserMenu` owns only menu UI + session read + sign-out.
Avatar is initial-based (no Google profile photo) per requirement.

### 2. Favorite = like, count fix

- **`components/TripDetail.tsx`:** replace the static favorite badge with an
  interactive control mirroring `TripCard`'s heart: `useFavorites()`,
  `favorited`, `favoriteCount = max(0, trip.favoriteCount + countDelta(id))`,
  optimistic `toggle`, signed-out → `/login`. Detail is rendered inside
  `TripDetailModal` and on `/trip/[id]`; both are already wrapped by
  `FavoritesProvider` (verify the share page wraps it — wrap if not).
- **`services/favorites/handler.ts`:** change the increment expression to
  `SET favoriteCount = if_not_exists(favoriteCount, :zero) + :delta` so a trip
  whose `favoriteCount` attribute is absent can't throw and break the bump.
  Keep the decrement guard. Add/extend a unit test asserting the expression and
  the idempotent-favorite path.

### 3. Unified search pill + collapsible filters

Rework `components/TripBrowser.tsx` and fold in `AiSuggestBox`.

- One search control (refactor `SearchBar` or a new `SearchPill`):
  - Instant plain filtering as the user types (existing `q` →
    `filterTrips`).
  - An **Ask AI** button inside the pill submits the current text to
    `api.suggestTrips(...)` (submit-only; never per-keystroke). On success,
    show ranked results in place with their reasons; on failure, fall back to
    plain search over the same candidates (preserve current `AiSuggestBox`
    fallback behavior). A clear/reset returns to plain results.
  - State for "AI mode vs plain" lives in `TripBrowser` (or the pill) so the
    grid renders either the filtered set or the AI-ranked set.
- **Filters + Group** move behind a **Show filters** toggle: wrap
  `FilterControls` (and the Group selector) in a collapsible panel, collapsed by
  default, expandable on click. Result count stays visible at all times.
- `app/page.tsx`: remove the standalone `<AiSuggestBox>`; the combined control
  in `TripBrowser` replaces it.
- Keep `lib/search.ts` and `POST /suggest` contracts unchanged.

### 4. Hero background

- `components/DiscoverHero.tsx`: add a full-bleed background image behind the
  section with a left→right dark gradient overlay for legibility. Preserve the
  current two-column layout (headline + CTAs left, stat cards right); recolor
  text/badges for contrast over the image.
- Subtle CSS slow-zoom (Ken-Burns) animation, disabled under
  `@media (prefers-reduced-motion: reduce)`.
- **Image sourcing:** during implementation, find a free-license
  (Unsplash/Pexels) travel/road-trip image, optimize it, and commit it under
  `public/`. Reference it via CSS `background-image` (or `next/image` if
  layered). Static photo + CSS motion — no video.

### 5. Edit entry point

- `components/TripDetail.tsx`: when the viewer is the owner
  (`trip.authorId === session.sub`), show an **Edit** link → `/trips/[id]/edit`.
  - Detail is a client component; obtain the current user's `sub` client-side
    (e.g. `fetchAuthSession()`), or pass an `isOwner`/`currentSub` prop from the
    server pages that render it. Prefer passing from the server where the
    session is already known (`/trip/[id]`, modal host) to avoid an extra client
    call; decide during implementation based on the render path.
  - This is UX only; the Lambda `PUT` ownership check remains the security
    boundary.

### 6. Seed 12 trips

- `scripts/seed-trips.ts`, run with `tsx` (add a `pnpm` script if convenient):
  - Inputs via env: `API_BASE_URL` (staging API base) and `ID_TOKEN` (bearer
    copied from a signed-in browser session — documented steps to grab it from
    `fetchAuthSession()` / network tab).
  - Strategy: fetch the user's existing trip from the public `GET /trips` (or
    use an inline template if none), then construct 11 variations with varied
    `name`, `location`/`city`/`province`/`country`, `tripType`, `vehicle`,
    `durationDays`, `description`, and a valid My Maps URL, and `POST /trips`
    each with the bearer. Total = 12.
  - Trips are authored under the user's account, so they also populate
    My trips.
  - Idempotency note: re-running creates duplicates (no upsert); documented.
  - A short README/run note covers token retrieval and usage.

## Testing & verification

- **Unit (`pnpm test`):** favorites increment `if_not_exists` behavior; any
  extracted search/AI-mode logic if it becomes testable. Existing tests stay
  green.
- **Build (`pnpm build`):** full `tsc` typecheck passes.
- **UI (`pnpm dev`):** profile menu (signed in/out, sign-out), interactive
  detail heart + count, unified search pill + Ask AI + collapsible filters, hero
  background + reduced-motion, owner-only Edit button.
- **Seed:** run against staging; confirm 12 trips appear on Discover and in
  My trips, and that favoriting one increments the count on the detail view and
  persists across reload.

## Out of scope

- Separate "like" vs "favorite" actions (explicitly rejected).
- Looping-video hero, Google profile-photo avatars.
- Pagination/OpenSearch, ratings, PWA, and other deferred items in
  `docs/road-rash-plan.md` §7.
- `terraform apply` / new infra — no new AWS resources are required; all
  workstreams use existing tables, routes, and the deployed staging stack.
