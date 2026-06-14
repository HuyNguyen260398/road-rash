# Phase 6 — M5: Search / filter / group (DynamoDB Option A)

**Goal (GOAL-006):** Search/filter/group via `GET /trips` query params (DynamoDB
Option A); empty/no-result states.

**Source tasks:** TASK-033 … TASK-037
**Depends on:** Phase 4 (`GET /trips`, `TripGrid`), Phase 3 (`Trip` GSIs).
**Unlocks:** discovery UX; the candidate set that feeds AI suggestions in M6.

> **Constraint (CON-002):** DynamoDB only — GSI queries + `contains` + client-side
> substring fallback. **No OpenSearch** unless scale demands it (ALT-005).

---

## TASK-033 — Extend `GET /trips` with query params

**Do:**
1. Accept params: `q` (free text), `tripType`, `country`, `province`, `city`,
   `vehicle`, `group`.
2. Strategy:
   - When a filter maps to a GSI (`country`/`province`/`city`/`tripType`/`vehicle`),
     **Query the GSI** rather than scanning.
   - For `q`, apply DynamoDB `contains` on searchable fields where feasible, with
     the client-side substring pass (TASK-035) as the final filter.
   - `group` returns data the UI can group by (e.g. by `country`).
3. Keep responses paginated/bounded for the small launch dataset (ASSUMPTION-001).

**Files:** `services/trips/handler.ts`.

**Done check:** each filter narrows results via the matching GSI; combined
filters + `q` return the expected trips.

**Commit:** `feat(m5): GET /trips query params (GSI + contains) (TASK-033)` — one task,
one commit, before TASK-034.

---

## TASK-034 — `SearchBar` + `FilterControls`

**Do:**
1. `components/SearchBar.tsx` — debounced text input driving `q`. (Debounce is for
   plain search responsiveness; **AI** is submit-only and lives in M6 — CON-003.)
2. `components/FilterControls.tsx` — selects for `tripType`, `country`, `province`,
   `city`, `vehicle`; sync state to the query (URL params or client state).

**Files:** `components/SearchBar.tsx`, `components/FilterControls.tsx`.

**Done check:** typing/selecting updates results; filters compose with search.

**Commit:** `feat(m5): SearchBar + FilterControls (TASK-034)` — one task, one commit,
before TASK-035.

---

## TASK-035 — `lib/search.ts` client-side fallback

**Do:**
1. Case-insensitive substring matching over the candidate set across searchable
   fields (`name`, `location`, `city`, `province`, `country`, `tripType`, `vehicle`).
2. Add **TEST-003** (case-insensitive matching across fields).

**Files:** `lib/search.ts`, `lib/search.test.ts`.

**Done check:** `pnpm test` covers case-insensitive matching; results match the
server filter for the loaded set.

**Commit:** `feat(m5): client search fallback + TEST-003 (TASK-035)` — one task, one
commit, before TASK-036.

---

## TASK-036 — Grouping toggle

**Do:**
1. Add a grouping toggle (e.g. group by `country`) that renders grouped section
   headers within `TripGrid`.

**Files:** `components/TripGrid.tsx` (+ a small grouping helper if useful).

**Done check:** toggling grouping renders section headers with the right trips
under each group.

**Commit:** `feat(m5): grouping toggle (TASK-036)` — one task, one commit, before
TASK-037.

---

## TASK-037 — Empty / no-result states

**Do:**
1. Reusable empty-state + "no results" components for **Home, My Trips, Saved, and
   search**.

**Files:** `components/EmptyState.tsx` (+ wiring into each page).

**Done check:** each surface shows a sensible message when it has no items / no
matches.

**Commit:** `feat(m5): empty / no-result states (TASK-037)` — final task of the phase;
one commit.

---

## Phase verification (M5 exit)

- [x] Filters use GSIs; free text works via `contains` + client fallback.
- [x] Search + filters + grouping compose correctly.
- [x] Empty/no-result states wired into Home, My Trips, and search (Saved page
      ships in M4 — `EmptyState` is ready and documented for that wiring).
- [x] `pnpm test` green (incl. TEST-003).

## Task checklist

- [x] TASK-033 — `GET /trips` query params (GSI + contains)
- [x] TASK-034 — `SearchBar` + `FilterControls`
- [x] TASK-035 — `lib/search.ts` + TEST-003
- [x] TASK-036 — grouping toggle
- [x] TASK-037 — empty / no-result states
