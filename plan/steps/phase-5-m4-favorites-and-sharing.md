# Phase 5 — M4: Favorites (denormalized count) + saved view + share page

**Goal (GOAL-005):** Favorites Lambda + routes with denormalized count; optimistic
UI; saved view; public share page.

**Source tasks:** TASK-029 … TASK-032
**Depends on:** Phase 4 (`Trip`/`TripCard`), Phase 3 (`Favorite` table + GSI).
**Unlocks:** the saved-trips view and shareable public trip pages.

---

## TASK-029 — `services/favorites/handler.ts` + routes

**Do:**
1. JWT-authenticated handler:
   - `POST /favorites` — create a `Favorite` keyed by JWT `sub` + `tripId` via a
     **conditional put** (prevents double-favorite — TEST-007); then
     `UpdateItem` `Trip.favoriteCount += 1` (atomic `ADD`).
   - `DELETE /favorites/{tripId}` — delete the `Favorite`; decrement
     `favoriteCount` (atomic, floored at 0).
   - `GET /favorites` — query the `userId` GSI for the caller's favorites.
2. **Document the race trade-off** in a comment: counter is denormalized and may
   drift slightly under concurrent toggles; accepted for MVP (GUD-003, RISK-005).

**Files:** `services/favorites/handler.ts`, `infra/modules/apigateway/` routes,
`infra/modules/iam/` (favorites role already covers `Trip` UpdateItem).

**Done check (TEST-007):** favoriting creates a `Favorite` and bumps the count;
unfavoriting reverses both; double-favorite is prevented.

**Commit:** `feat(m4): favorites Lambda + routes (TASK-029)` — one task, one commit,
before TASK-030.

---

## TASK-030 — Optimistic heart toggle in `TripCard`

**Do:**
1. On heart click: update local favorited state + count immediately; fire
   `POST/DELETE /favorites`; reconcile from the response; **revert on error**.
2. Reflect favorited state from `GET /favorites` when the user is signed in.

**Files:** `components/TripCard.tsx`.

**Done check:** the heart toggles instantly and self-corrects if the request fails.

**Commit:** `feat(m4): optimistic heart toggle (TASK-030)` — one task, one commit,
before TASK-031.

---

## TASK-031 — Saved view

**Do:**
1. `app/saved/page.tsx` — auth-gated; `GET /favorites` for the user, then
   batch-load the referenced trips (BatchGetItem or a batched API call) and render
   `TripGrid`.

**Files:** `app/saved/page.tsx`.

**Done check:** favorited trips show on `/saved`; unfavoriting removes them.

**Commit:** `feat(m4): /saved view (TASK-031)` — one task, one commit, before TASK-032.

---

## TASK-032 — Public shareable trip page

**Do:**
1. `app/trip/[id]/page.tsx` — public, SSR, shareable. Render trip detail content.
2. Add Open Graph metadata (title, description, image = thumbnail) from trip fields
   via Next.js `generateMetadata`.

**Files:** `app/trip/[id]/page.tsx`.

**Done check:** the page renders unauthenticated and produces correct OG tags when
shared (link preview shows name + thumbnail).

**Commit:** `feat(m4): public /trip/[id] share page + OG (TASK-032)` — final task of
the phase; one commit.

---

## Phase verification (M4 exit)

- [ ] Favorite/unfavorite updates `favoriteCount` atomically; no double-favorite.
- [ ] Heart is optimistic and reverts on failure.
- [ ] `/saved` lists the user's favorites.
- [ ] `/trip/[id]` is public, SSR, with OG metadata.

## Task checklist

- [ ] TASK-029 — favorites Lambda + routes (TEST-007)
- [ ] TASK-030 — optimistic heart toggle
- [ ] TASK-031 — `/saved` view
- [ ] TASK-032 — public `/trip/[id]` share page + OG
