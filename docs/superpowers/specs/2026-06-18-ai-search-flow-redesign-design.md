# AI Search Flow Redesign — Design

**Date:** 2026-06-18
**Status:** Approved (brainstorm)
**Area:** `components/TripBrowser.tsx`, `services/suggest-trips/handler.ts`, `messages/{en,vi}.json`
**Builds on:** 2026-06-18-ai-search-summary-design.md (branch `feature/ai-search-summary`)

## Problem / requests

1. The AI **summary section** is not visible in the deployed app — root cause is that staging still runs the pre-summary Lambda; no code fix needed (deploy-gated).
2. Remove the **per-trip AI description** (the `reason` caption under each ranked card). Only the single main summary section is wanted.
3. Change the **search/filter flow**: typing free text should no longer filter the grid live. The user types, clicks **Ask AI**, AI returns the suggestion (summary), and only then is the grid narrowed to the AI-selected trips.

## Decisions (from brainstorm)

- Dropdown filters (tripType/vehicle/country/province/city) and grouping **stay live** — only free-text gating changes.
- On AI failure: **plain text-match fallback** over the query, plus an "AI unavailable" note in the summary section.
- Before any AI search: grid shows **all trips** (narrowable by dropdowns).

## Design

### TripBrowser (primary change)

1. **Free text no longer filters.** The displayed set is computed as
   `filterTrips(aiActive ? aiResults : trips, "", filters)` — the empty query
   means the typed prompt never narrows the grid; only the dropdown `filters`
   apply. `groupTrips` runs on that result when `groupBy` is set.
2. **Unify rendering through `TripGrid`.** Delete the bespoke AI grid block and
   its duplicate `useInfiniteScroll(aiResults)` / `LoadMoreIndicator` plumbing.
   AI results flow through the same `TripGrid` that already handles grouping and
   load-more. The bespoke grid was the only place the per-trip `reason` caption
   rendered, so removing it satisfies request #2.
3. **`AiResult` becomes `Trip[]`** (ranked order); drop the `reason` field.
   `askAi` maps returned suggestion IDs → trips (ranked); the catch path still
   falls back to `filterTrips(trips, q, {})` (plain text match) mapped to trips.
4. **Editing the query resets the AI view** (existing `resetAi` on change), so the
   grid returns to all-trips until Ask AI is clicked again. The `requestIdRef`
   superseded-guard is unchanged.
5. Result-count badge reflects the displayed set; `aiActive` still gates whether
   the base set is `aiResults` vs `trips`.

### Backend (minor)

- Remove the `reason` request from the Gemini prompt in `buildPrompt`
  (`services/suggest-trips/handler.ts`) — reasons are now unused; the summary
  carries the explanation. The parser (`parseEntries`) and types keep `reason`
  optional/tolerant, so existing tests need no changes.

### i18n (minor)

- Update the `search.placeholder` string in `messages/{en,vi}.json` to reflect
  the AI-only intent (e.g. EN "Describe your trip, then tap Ask AI"). Dropdown
  filter labels are unchanged.

## Out of scope

- No backend type/parser removal of `reason` (kept tolerant to avoid churn).
- No change to SearchPill (it already submits only via the Ask AI button / Enter).
- Request #1 needs only a deploy, not a code change.

## Testing

- `lib/search.test.ts` unchanged (filterTrips/groupTrips behavior is reused).
- `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build:lambdas`.
- Manual after deploy: type a query, confirm the grid does NOT change until Ask AI;
  click Ask AI, confirm summary appears and grid narrows to AI picks with no
  per-card captions; dropdowns still filter; verify the AI-unavailable fallback.
