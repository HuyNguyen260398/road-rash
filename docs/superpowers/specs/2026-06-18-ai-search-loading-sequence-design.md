# AI Search Loading Sequence — Design

**Date:** 2026-06-18
**Status:** Approved (brainstorm)
**Area:** `components/TripBrowser.tsx`, `components/AiSummary.tsx`, `messages/{en,vi}.json`
**Builds on:** the merged AI search summary + flow redesign (PR #38)

## Requests

1. Remove all text-based trip filtering. The only remaining text filter is the
   AI-failure fallback (`filterTrips(trips, prompt, {})`); remove it.
2. On an AI search: show a loading **spinner**, then the AI **suggestion**, and
   only after that load the **filtered trips**.

## Decisions (from brainstorm)

- On AI failure: **show all trips** (no filtering) plus an "AI unavailable" notice
  in the suggestion card.
- While loading: **hide the trip grid**; the spinner/suggestion area is the only
  thing shown, then the suggestion appears, then the filtered trips load.

## Design

### Status model

Replace `aiStatus: "idle" | "loading" | "done"` with
`"idle" | "loading" | "success" | "error"`. Define `aiActive = aiStatus ===
"success"` — only a successful search switches the grid to the AI subset.

| State | Suggestion card | Trip grid |
|-------|-----------------|-----------|
| idle | hidden | all trips (dropdown filters apply) |
| loading | spinner + "Thinking…" | hidden |
| success | summary text | AI-selected trips |
| error | "AI unavailable" notice | all trips |

### Remove text filtering (request 1)

- Delete the `catch`-path `filterTrips(trips, prompt, {})` fallback. No trip list
  is filtered by raw search text anymore.
- On failure: `setAiStatus("error")`, `setAiResults([])`, set the
  `aiUnavailable` message. With `aiActive` false, the grid shows all trips.
- Remove the now-unused `search.aiUnavailableNoMatch` key from `en`/`vi`.

### Loading sequence (request 2)

- **Spinner:** `AiSummary` loading state shows a spinning `Loader2` icon
  (`animate-spin`) in place of the Sparkles icon, next to the "Thinking…" label.
- **Hide grid while loading:** `TripGrid` is not rendered when `aiStatus ===
  "loading"`; the result-count badge is also hidden during loading so it can't
  show a stale count.
- **Suggestion then trips:** when the response lands, status becomes `success` —
  the summary text renders and the grid mounts with the AI subset. `TripGrid`'s
  existing skeleton→reveal phase (`useCardReveal`, ~450 ms shimmer) makes the
  suggestion appear first and the trips fill in just after, with no artificial
  delay added.

### askAi control flow

```
setAiStatus("loading"); setSummaryDismissed(false);
setAiMessage(null); setAiSummary(null);
try {
  const { summary, suggestions } = await api.suggestTrips(prompt, candidates, locale);
  if (superseded) return;
  const mapped = suggestions.map(s => byId.get(s.id)).filter(Boolean);
  setAiSummary(summary || null);
  setAiResults(mapped);
  setAiMessage(mapped.length === 0 ? aiNoMatch : null);
  setAiStatus("success");
} catch {
  if (superseded) return;
  setAiResults([]);
  setAiMessage(aiUnavailable);
  setAiStatus("error");
}
```

The superseded-request guard (`requestIdRef`), dropdown filters, grouping, and the
empty-AI-result handling (`aiActive && aiResults.length === 0` → hide grid, summary
shows `aiNoMatch`) all stay as-is.

## Files

- `components/AiSummary.tsx` — spinner icon in the loading state.
- `components/TripBrowser.tsx` — status enum, remove fallback, hide grid + badge
  while loading, error → all trips.
- `messages/{en,vi}.json` — remove `aiUnavailableNoMatch`.

## Testing

- `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build:lambdas`.
- Manual: type + Ask AI → spinner shows, grid hidden; suggestion appears, then
  trips; verify error path shows all trips + notice; dropdowns still filter.
