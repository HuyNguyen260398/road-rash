# AI Search Summary — Design

**Date:** 2026-06-18
**Status:** Approved (brainstorm)
**Area:** AI suggestions (`services/suggest-trips`, `components/TripBrowser`, `lib`)

## Problem

Today, clicking **Ask AI** sends the user's query plus a compact candidate set to
`POST /suggest`; Gemini returns a ranked JSON array of `{id, reason}` and the trip
grid is replaced with those reordered cards. There is no natural-language answer —
the user gets reordered cards but no plain-language explanation of what the AI
found or recommends.

We want to add a **short text summary** that Gemini writes in response to the
query, shown in a dismissible section between the search bar and the trip cards,
**while keeping** the existing ranked-card behavior.

## Goals

- Gemini produces a short (1–2 sentence) text recommendation answering the query,
  naming the best-matching trips by name.
- The summary is written in the user's active UI locale (English on `/en`,
  Vietnamese on `/vi`).
- The summary renders in a section that is hidden until the user asks AI, then
  appears above the cards and is dismissible (× button); editing/clearing the
  query also resets it.
- The existing ranked-card grid behavior is preserved unchanged.

## Non-goals (YAGNI)

- No streaming responses.
- No chat history / multi-turn conversation.
- No changes to per-card `reason` rendering.
- No server- or client-side caching of summaries.
- No translation of user-supplied trip content (only the generated summary +
  surrounding UI chrome are localized).

## Approach

Extend the **existing single Gemini call** rather than adding a second call. The
prompt changes from requesting a bare JSON array to a JSON object:

```json
{
  "summary": "<1–2 sentences, in the requested locale, naming top trips>",
  "results": [{ "id": "<id>", "reason": "<short why-it-fits>" }]
}
```

One call keeps cost and latency flat — important given the hard API Gateway
throttle and Gemini spend constraint (RISK-006). The summary stays consistent
with the ranking because the model produces both in one pass. A two-call design
(separate summary + ranking requests) would double cost and latency and is
rejected.

## Detailed design

### 1. Backend — `services/suggest-trips/`

**`select.ts`**

- `parseSuggestRequest` accepts an optional `locale` field, normalized to
  `"en" | "vi"`, defaulting to `"en"` when absent or unrecognized.
- Add `MAX_SUMMARY_CHARS` (e.g. `600`).
- Replace `parseSuggestions(text)` with `parseSuggestResponse(text)` returning
  `{ summary: string; suggestions: Suggestion[] }`:
  - Strips a ```` ```json ```` code fence as today.
  - If the parsed value is an **object** with `results`, read `summary` (string,
    trimmed, capped at `MAX_SUMMARY_CHARS`) and parse `results` with the existing
    per-entry logic.
  - If the parsed value is a **bare array** (backward/tolerant case), treat it as
    `results` with `summary = ""`.
  - Anything unusable yields `{ summary: "", suggestions: [] }`.
- `filterToCandidates` is unchanged and still runs over `suggestions`.

**`handler.ts`**

- `buildPrompt(req)` updated to:
  - Instruct the model to respond with ONLY the JSON object shown above.
  - Instruct it to write `summary` as 1–2 sentences answering the user request,
    naming the best-matching trips, **in the request's locale** (map `"vi"` →
    "Vietnamese", `"en"` → "English" in the instruction text).
  - Keep all existing `results` rules (ids only from candidates, max items, `[]`
    when nothing fits, one-sentence reasons).
- After `callGemini`, use `parseSuggestResponse`; keep `filterToCandidates` →
  `slice(0, MAX_SUGGESTIONS)` → `validateAgainstTable` for `suggestions`.
- Return `json(200, { summary, suggestions })`. On Gemini error/timeout, the
  existing `502` fallback is unchanged (no summary).

**Tests** — `select.test.ts`: cover `parseSuggestResponse` for the object shape,
bare-array tolerance, summary capping, malformed input, and `locale` parsing
(valid `vi`, default for missing/unknown).

### 2. Types & client

**`lib/types.ts`**

- `SuggestRequest` gains `locale?: "en" | "vi"`.
- `SuggestResponse` gains `summary: string` (alongside `suggestions`).

**`lib/api-client.ts`**

- `suggestTrips(prompt, candidates, locale?)` includes `locale` in the POST body.

### 3. Frontend — `components/TripBrowser.tsx` + new `components/AiSummary.tsx`

- Add `aiSummary` state (`string | null`).
- `askAi()` reads the active locale via `useLocale()` (next-intl) and passes it to
  `api.suggestTrips`; on success stores `summary` (when non-empty). The existing
  `requestIdRef` guard still discards superseded responses.
- `resetAi()` clears `aiSummary` too, so editing the query / clearing / a new
  search hides it.
- New **`AiSummary`** component: a small card rendered between the search-bar
  block and the grid. Behavior:
  - Hidden when idle with nothing to show.
  - On Ask AI it shows a brief loading state ("thinking…") while `aiStatus ===
    "loading"`.
  - When the summary arrives, shows the text with a section title and a `×`
    dismiss button. Dismissing hides only the text; ranked cards remain.
  - This section also hosts the existing fallback/no-match messages
    (`aiUnavailable`, `aiUnavailableNoMatch`, `aiNoMatch`) so there is one "AI
    says" area rather than a loose `<p>`. The standalone `aiMessage` `<p>` in
    TripBrowser is removed in favor of this.
- Local dismiss state lives in `AiSummary` (or a `summaryDismissed` flag in
  TripBrowser, reset by `resetAi`).

### 4. i18n — `messages/{en,vi}.json`

Add keys under `search` (or a new `ai` group):

- summary section title (e.g. EN "AI suggestion" / VI equivalent)
- dismiss button aria-label
- loading label ("Thinking…")

## Data flow

1. User types a query, clicks **Ask AI**.
2. `TripBrowser.askAi()` → `api.suggestTrips(prompt, candidates, locale)` →
   `POST /suggest` with `{ prompt, candidates, locale }`.
3. Handler builds the prompt, calls Gemini once, parses `{ summary, suggestions }`,
   filters + revalidates `suggestions`, returns both.
4. Client renders `summary` in the AiSummary section and the ranked cards in the
   grid (existing behavior).
5. Editing/clearing the query, or a new Ask AI, resets summary + cards via the
   existing `resetAi` / `requestIdRef` machinery.

## Error handling

- Gemini error/timeout → handler returns `502`; client falls back to plain search
  over the candidate set (unchanged) and the AiSummary section shows the
  `aiUnavailable` message instead of a summary.
- Empty/malformed model output → `parseSuggestResponse` yields empty summary +
  empty suggestions; client shows `aiNoMatch`.
- Superseded responses discarded via `requestIdRef` (unchanged).

## Testing

- Unit (Vitest): `parseSuggestResponse` shapes + summary cap + locale parsing in
  `select.test.ts`; existing `filterToCandidates` tests unchanged.
- `pnpm build` (tsc typecheck) for the type + client + component changes.
- Manual: ask AI on `/en` and `/vi`, confirm localized summary, dismiss behavior,
  and the fallback path when Gemini is unavailable.
