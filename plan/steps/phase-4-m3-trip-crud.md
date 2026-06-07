# Phase 4 — M3: Trip CRUD + form + presigned upload + card grid

**Goal (GOAL-004):** Trip CRUD Lambda + routes; create/edit form with presigned
thumbnail upload and My Maps validation; card grid; My Trips.

**Source tasks:** TASK-022 … TASK-028
**Depends on:** Phase 3 (tables, S3, API Gateway, JWT authorizer, IAM, api-client).
**Unlocks:** the core product loop — create/browse trips; basis for M4–M7.

---

## Prerequisites

- Phase 3 complete; `Trip` table, thumbnails bucket, HTTP API, `lib/api-client.ts`.
- Pick the test runner now (Vitest recommended) — DEP-008/TASK-022 needs it.

---

## TASK-022 — `lib/validation.ts` + tests (the My Maps guard)

> This is the security spine of the My Maps constraint (CON-001, SEC-003).

**Do:**
1. `validateMyMapsUrl(url)` — accept **only** Google My Maps hosts/paths
   (`www.google.com/maps/d/` view + embed paths); reject everything else.
2. `toMyMapsEmbedUrl(url)` — convert a share/view URL to the `?mid=...` embed form.
3. Set up the test runner (`pnpm add -D vitest`) and add unit tests:
   - **TEST-001:** valid My Maps URLs accepted; arbitrary/malicious URLs rejected.
   - **TEST-002:** `toMyMapsEmbedUrl` yields a correct embed URL from share URLs.
4. Add a `test` script to `package.json` and document single-test invocation.

**Files:** `lib/validation.ts`, `lib/validation.test.ts`, `package.json`.

**Done check:** `pnpm test` passes; malicious hosts (e.g. `evil.com`, `javascript:`)
are rejected.

---

## TASK-023 — `services/trips/handler.ts` Lambda + routes

**Do:**
1. Implement a single handler routing on method/path:
   - `GET /trips` (public) — list (filters added in M5).
   - `GET /trips/{id}` (public) — fetch one.
   - `POST /trips` (JWT) — create; set `authorId` from JWT `sub`; init
     `favoriteCount: 0`; generate `id`; timestamps.
   - `PUT /trips/{id}` (JWT) — update; **owner check**: `sub == authorId` else 403.
   - `DELETE /trips/{id}` (JWT) — delete; same owner check.
2. Use `@aws-sdk/lib-dynamodb` `DocumentClient`.
3. Wire routes in the `apigateway` module — `GET` routes public, mutating routes
   attached to the JWT authorizer (SEC-002, PAT-002).

**Files:** `services/trips/handler.ts`, `infra/modules/apigateway/` route additions.

**Done check (also TEST-005/006):** public GETs work without a token; mutating
routes reject missing/invalid JWT; editing another user's trip returns 403.

---

## TASK-024 — `services/presign/handler.ts` + `POST /uploads/presign`

**Do:**
1. JWT-authenticated Lambda that:
   - Validates requested `contentType` (image/* allow-list) and `size` ≤ max
     (SEC-004).
   - Returns a presigned **PUT** URL (`@aws-sdk/s3-request-presigner`) + an object
     key scoped to the caller (e.g. `thumbnails/<sub>/<uuid>`).
2. Add the route (JWT) in the `apigateway` module.

**Files:** `services/presign/handler.ts`, `infra/modules/apigateway/`.

**Done check (TEST-008):** presign rejects oversized/non-image content-type;
returns a working PUT URL + key for valid requests.

---

## TASK-025 — `components/TripForm.tsx`

**Do:**
1. Form with all `Trip` fields: name, description, `tripType`/`vehicle` selects,
   `durationDays`, structured `city`/`province`/`country`, `myMapsUrl` (with inline
   validation via `validateMyMapsUrl` + help text — RISK-003), optional `googleMapsUrl`.
2. Thumbnail upload flow: request presign → `PUT` file to S3 → store the returned
   **key** on the trip (client also enforces size/type — SEC-004).
3. Submit calls `createTrip`/`updateTrip` via `lib/api-client.ts`.

**Files:** `components/TripForm.tsx`.

**Done check:** invalid My Maps URLs are blocked inline; a valid submit creates a
trip and uploads a thumbnail to S3.

---

## TASK-026 — Create/Edit pages

**Do:**
1. `app/trips/new/page.tsx` — auth-gated (guarded in M1) using `TripForm`.
2. `app/trips/[id]/edit/page.tsx` — owner-gated; load the trip, prefill `TripForm`,
   call `updateTrip`. Non-owners are blocked (server check + Lambda 403).

**Files:** `app/trips/new/page.tsx`, `app/trips/[id]/edit/page.tsx`.

**Done check:** owner can create and edit; a non-owner cannot reach/save the edit.

---

## TASK-027 — `TripCard` + `TripGrid`

**Do:**
1. `components/TripCard.tsx` — thumbnail via **presigned GET**, name, location,
   duration, vehicle icon, author, heart + count (toggle wired in M4).
2. `components/TripGrid.tsx` — responsive, mobile-first grid (REQ-001).

**Files:** `components/TripCard.tsx`, `components/TripGrid.tsx`.

**Done check:** cards render with thumbnails on phone/tablet/desktop widths.

---

## TASK-028 — Home/Discover + My Trips

**Do:**
1. `app/page.tsx` — SSR `GET /trips`, render `TripGrid` (public).
2. `app/my-trips/page.tsx` — auth-gated; show trips where `authorId == current sub`.

**Files:** `app/page.tsx`, `app/my-trips/page.tsx`.

**Done check:** newly created trips appear on Home and (for the author) on My Trips.

---

## Phase verification (M3 exit)

- [ ] Create → it appears on Home (SSR) and My Trips.
- [ ] Edit/delete enforce ownership (UI + Lambda 403).
- [ ] Thumbnail presign upload works; cards show images via presigned GET.
- [ ] My Maps URL validation blocks bad URLs; `pnpm test` green.

## Task checklist

- [ ] TASK-022 — `lib/validation.ts` + tests (TEST-001/002)
- [ ] TASK-023 — trips Lambda + routes (TEST-005/006)
- [ ] TASK-024 — presign Lambda + route (TEST-008)
- [ ] TASK-025 — `TripForm`
- [ ] TASK-026 — new/edit pages
- [ ] TASK-027 — `TripCard` + `TripGrid`
- [ ] TASK-028 — Home + My Trips
