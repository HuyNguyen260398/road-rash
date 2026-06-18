# AI Search Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short, localized AI text summary to the "Ask AI" flow, shown in a dismissible section above the trip cards, while keeping the existing ranked-card behavior.

**Architecture:** Extend the single `POST /suggest` Gemini call to return a JSON object `{ summary, results }` instead of a bare array. The handler parses both, re-validates `results` against DynamoDB as today, and returns `{ summary, suggestions }`. The frontend stores the summary and renders it in a new dismissible `AiSummary` card; the locale is passed through so Gemini writes the summary in the user's UI language.

**Tech Stack:** TypeScript Lambda (`services/suggest-trips`), Vitest, Next.js App Router + next-intl, Tailwind.

---

## File structure

- `lib/types.ts` — add `locale?` to `SuggestRequest`, `summary` to `SuggestResponse` (modify).
- `services/suggest-trips/select.ts` — locale in `parseSuggestRequest`; new `parseSuggestResponse` envelope parser; `MAX_SUMMARY_CHARS` (modify).
- `services/suggest-trips/select.test.ts` — tests for locale + `parseSuggestResponse` (modify).
- `services/suggest-trips/handler.ts` — new prompt, use `parseSuggestResponse`, return `summary` (modify).
- `lib/api-client.ts` — `suggestTrips(prompt, candidates, locale?)` (modify).
- `components/AiSummary.tsx` — new dismissible summary card (create).
- `components/TripBrowser.tsx` — summary state, pass locale, render `AiSummary`, drop loose message `<p>` (modify).
- `messages/en.json`, `messages/vi.json` — summary section strings (modify).

---

### Task 1: Types + locale request parsing

**Files:**
- Modify: `lib/types.ts:58-72`
- Modify: `services/suggest-trips/select.ts`
- Test: `services/suggest-trips/select.test.ts`

- [ ] **Step 1: Update types**

In `lib/types.ts`, replace the `SuggestRequest` and `SuggestResponse` interfaces (lines 58-72) with:

```ts
export type SuggestLocale = "en" | "vi";

export interface SuggestRequest {
  prompt: string;
  candidates: SuggestCandidate[];
  locale?: SuggestLocale;
}

// A ranked suggestion: a trip id (always from the candidate set, validated
// server-side) plus an optional "why it fits" blurb from the model.
export interface SuggestionResult {
  id: string;
  reason?: string;
}

export interface SuggestResponse {
  // Short natural-language recommendation written in the request locale. May be
  // "" when the model returns only ranked results (or on the fallback path).
  summary: string;
  suggestions: SuggestionResult[];
}
```

- [ ] **Step 2: Write the failing test for locale parsing**

In `services/suggest-trips/select.test.ts`, add inside the existing `describe("parseSuggestRequest", ...)` block (or a new block if none exists):

```ts
describe("parseSuggestRequest locale", () => {
  const candidates = [{ id: "1", name: "A" }];

  it("parses a valid vi locale", () => {
    const raw = JSON.stringify({ prompt: "coast", candidates, locale: "vi" });
    expect(parseSuggestRequest(raw)?.locale).toBe("vi");
  });

  it("defaults to en when locale is missing", () => {
    const raw = JSON.stringify({ prompt: "coast", candidates });
    expect(parseSuggestRequest(raw)?.locale).toBe("en");
  });

  it("defaults to en for an unknown locale", () => {
    const raw = JSON.stringify({ prompt: "coast", candidates, locale: "fr" });
    expect(parseSuggestRequest(raw)?.locale).toBe("en");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test services/suggest-trips/select.test.ts`
Expected: FAIL — `locale` is `undefined` (not yet parsed).

- [ ] **Step 4: Implement locale parsing**

In `services/suggest-trips/select.ts`, update the import and `parseSuggestRequest` return. Change the import line to include the locale type:

```ts
import type {
  SuggestCandidate,
  SuggestLocale,
  SuggestRequest,
} from "../../lib/types";
```

Add a helper above `parseSuggestRequest`:

```ts
// Normalize the optional UI locale; anything we don't ship falls back to en so
// the prompt always has a defined language to write the summary in.
function parseLocale(value: unknown): SuggestLocale {
  return value === "vi" ? "vi" : "en";
}
```

Then change the final return of `parseSuggestRequest` from:

```ts
  return { prompt, candidates };
```

to:

```ts
  return { prompt, candidates, locale: parseLocale(b.locale) };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test services/suggest-trips/select.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts services/suggest-trips/select.ts services/suggest-trips/select.test.ts
git commit -m "feat(suggest): parse optional locale in suggest request"
```

---

### Task 2: `parseSuggestResponse` envelope parser

**Files:**
- Modify: `services/suggest-trips/select.ts`
- Test: `services/suggest-trips/select.test.ts`

Keep the existing `parseSuggestions` (array-of-entries parser) intact — `parseSuggestResponse` delegates to it so entry parsing stays DRY and the existing tests keep passing.

- [ ] **Step 1: Write the failing test**

In `services/suggest-trips/select.test.ts`, add a new block and add `parseSuggestResponse`, `MAX_SUMMARY_CHARS` to the import from `./select`:

```ts
describe("parseSuggestResponse", () => {
  it("parses an object with summary and results", () => {
    const text = JSON.stringify({
      summary: "Try the coastal loop.",
      results: [{ id: "1", reason: "coastal" }],
    });
    expect(parseSuggestResponse(text)).toEqual({
      summary: "Try the coastal loop.",
      suggestions: [{ id: "1", reason: "coastal" }],
    });
  });

  it("strips a code fence around the object", () => {
    const text = '```json\n{"summary":"Hi","results":[{"id":"1"}]}\n```';
    expect(parseSuggestResponse(text)).toEqual({
      summary: "Hi",
      suggestions: [{ id: "1" }],
    });
  });

  it("tolerates a bare array as results with empty summary", () => {
    const text = '[{"id":"1","reason":"x"}]';
    expect(parseSuggestResponse(text)).toEqual({
      summary: "",
      suggestions: [{ id: "1", reason: "x" }],
    });
  });

  it("caps the summary at MAX_SUMMARY_CHARS", () => {
    const long = "a".repeat(MAX_SUMMARY_CHARS + 50);
    const text = JSON.stringify({ summary: long, results: [] });
    expect(parseSuggestResponse(text).summary).toHaveLength(MAX_SUMMARY_CHARS);
  });

  it("returns empty summary + suggestions for malformed input", () => {
    expect(parseSuggestResponse("not json")).toEqual({
      summary: "",
      suggestions: [],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test services/suggest-trips/select.test.ts`
Expected: FAIL — `parseSuggestResponse` / `MAX_SUMMARY_CHARS` not exported.

- [ ] **Step 3: Implement the parser**

In `services/suggest-trips/select.ts`, add the constant next to the other caps:

```ts
export const MAX_SUMMARY_CHARS = 600;
```

Add this function directly below the existing `parseSuggestions`:

```ts
// Envelope parser for the model's response. The prompt asks for an object
// { summary, results }, but we tolerate a bare array (older shape / model drift)
// by treating it as results with no summary. Strips a ```json code fence first,
// like parseSuggestions. Entry parsing is delegated to parseSuggestions so the
// id/reason rules stay in one place.
export function parseSuggestResponse(text: string): {
  summary: string;
  suggestions: Suggestion[];
} {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { summary: "", suggestions: [] };
  }

  if (Array.isArray(parsed)) {
    return { summary: "", suggestions: parseSuggestions(JSON.stringify(parsed)) };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { summary: "", suggestions: [] };
  }

  const obj = parsed as Record<string, unknown>;
  const summary =
    typeof obj.summary === "string"
      ? obj.summary.trim().slice(0, MAX_SUMMARY_CHARS)
      : "";
  const suggestions = Array.isArray(obj.results)
    ? parseSuggestions(JSON.stringify(obj.results))
    : [];

  return { summary, suggestions };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test services/suggest-trips/select.test.ts`
Expected: PASS (new block + all existing `parseSuggestions` tests still green).

- [ ] **Step 5: Commit**

```bash
git add services/suggest-trips/select.ts services/suggest-trips/select.test.ts
git commit -m "feat(suggest): add parseSuggestResponse envelope parser"
```

---

### Task 3: Wire the handler (prompt + summary response)

**Files:**
- Modify: `services/suggest-trips/handler.ts`

No new unit test — the handler is integration glue over already-tested pure helpers; verification is `pnpm build:lambdas` + the existing suite.

- [ ] **Step 1: Update the import from `./select`**

In `services/suggest-trips/handler.ts`, change the `./select` import to use the new parser:

```ts
import {
  filterToCandidates,
  parsePositiveInt,
  parseSuggestRequest,
  parseSuggestResponse,
} from "./select";
```

- [ ] **Step 2: Update `buildPrompt` to request the object + localized summary**

Replace the `return [ ... ].join("\n");` body of `buildPrompt` with:

```ts
  const language = req.locale === "vi" ? "Vietnamese" : "English";

  return [
    "You are a travel trip recommender. From the candidate trips below, pick the",
    "ones that best match the user's request and rank them best-first.",
    "",
    "Rules:",
    "- Respond with ONLY a strict JSON object of the form:",
    '  {"summary": "<text>", "results": [{"id": "<id>", "reason": "<short why-it-fits>"}]}.',
    `- Write "summary" as 1-2 sentences in ${language}, answering the request and`,
    "  naming the best-matching trips. If nothing fits, say so briefly.",
    "- In \"results\", use ONLY ids from the candidate list. Never invent ids.",
    `- Return at most ${MAX_SUGGESTIONS} results. If nothing fits, use [].`,
    "- Keep each reason to one short sentence.",
    "",
    `User request: ${req.prompt}`,
    "",
    "Candidate trips:",
    ...lines,
  ].join("\n");
```

- [ ] **Step 3: Use the envelope parser and return the summary**

In the `suggest` function, replace this block:

```ts
  // Parse → keep only candidate-set ids → cap → re-validate against the table.
  const parsed = parseSuggestions(text);
  const inSet = filterToCandidates(parsed, candidateIds).slice(
    0,
    MAX_SUGGESTIONS,
  );
  const suggestions = await validateAgainstTable(inSet);

  return json(200, { suggestions });
```

with:

```ts
  // Parse → keep only candidate-set ids → cap → re-validate against the table.
  const { summary, suggestions: parsed } = parseSuggestResponse(text);
  const inSet = filterToCandidates(parsed, candidateIds).slice(
    0,
    MAX_SUGGESTIONS,
  );
  const suggestions = await validateAgainstTable(inSet);

  return json(200, { summary, suggestions });
```

- [ ] **Step 4: Verify build + full suite**

Run: `pnpm build:lambdas && pnpm test services/suggest-trips/`
Expected: bundle succeeds; all suggest-trips tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/suggest-trips/handler.ts
git commit -m "feat(suggest): return localized AI summary alongside ranked results"
```

---

### Task 4: API client locale passthrough

**Files:**
- Modify: `lib/api-client.ts:186-190`

- [ ] **Step 1: Update `suggestTrips`**

In `lib/api-client.ts`, update the import to include `SuggestLocale`:

```ts
import type {
  // ...existing imports...
  SuggestCandidate,
  SuggestLocale,
  SuggestResponse,
  // ...existing imports...
} from "@/lib/types";
```

(Insert `SuggestLocale` alphabetically among the existing type imports near `SuggestCandidate`.)

Then replace the `suggestTrips` method:

```ts
  suggestTrips: (
    prompt: string,
    candidates: SuggestCandidate[],
    locale?: SuggestLocale,
  ) =>
    apiFetch<SuggestResponse>("/suggest", {
      method: "POST",
      body: { prompt, candidates, locale },
    }),
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm build`
Expected: PASS (TripBrowser still compiles — `locale` is optional).

- [ ] **Step 3: Commit**

```bash
git add lib/api-client.ts
git commit -m "feat(api): pass locale to suggestTrips"
```

---

### Task 5: i18n strings for the summary section

**Files:**
- Modify: `messages/en.json:118-121`
- Modify: `messages/vi.json` (same `search` block)

- [ ] **Step 1: Add English strings**

In `messages/en.json`, inside the `"search"` object, add these keys (next to the existing `ai*` keys after line 121):

```json
    "aiSummaryTitle": "AI suggestion",
    "aiSummaryLoading": "Thinking…",
    "aiSummaryDismiss": "Dismiss AI suggestion",
```

- [ ] **Step 2: Add Vietnamese strings**

In `messages/vi.json`, inside the `"search"` object, add alongside the existing `ai*` keys:

```json
    "aiSummaryTitle": "Gợi ý từ AI",
    "aiSummaryLoading": "Đang suy nghĩ…",
    "aiSummaryDismiss": "Đóng gợi ý AI",
```

- [ ] **Step 3: Verify JSON is valid**

Run: `pnpm build`
Expected: PASS (next-intl loads both message files).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/vi.json
git commit -m "i18n(search): add AI summary section strings"
```

---

### Task 6: `AiSummary` component

**Files:**
- Create: `components/AiSummary.tsx`

This is presentational: it renders the loading state, the summary text with a dismiss button, or a fallback message. State (what to show, whether dismissed) is owned by `TripBrowser` and passed in.

- [ ] **Step 1: Create the component**

Create `components/AiSummary.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dismissible "AI says" card shown between the search bar and the trip grid.
// TripBrowser owns the state and only mounts this when there is something to
// show (loading, a summary, or a fallback message).
export default function AiSummary({
  loading,
  summary,
  message,
  onDismiss,
}: {
  loading: boolean;
  summary: string | null;
  message: string | null;
  onDismiss: () => void;
}) {
  const t = useTranslations("search");

  const body = loading
    ? t("aiSummaryLoading")
    : (summary ?? message ?? "");

  return (
    <div className="flex animate-float-up items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("aiSummaryTitle")}
        </p>
        <p
          className={`mt-1 text-sm ${loading ? "animate-pulse text-muted-foreground" : "text-foreground"}`}
        >
          {body}
        </p>
      </div>
      {!loading ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          aria-label={t("aiSummaryDismiss")}
          onClick={onDismiss}
        >
          <XIcon className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm build`
Expected: PASS. If `Button` has no `size="icon"` variant, use `size="sm"` instead (check `components/ui/button.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/AiSummary.tsx
git commit -m "feat(ui): add dismissible AiSummary card"
```

---

### Task 7: Wire `AiSummary` into `TripBrowser`

**Files:**
- Modify: `components/TripBrowser.tsx`

- [ ] **Step 1: Add imports**

At the top of `components/TripBrowser.tsx`, add `useLocale` to the next-intl import and import the component:

```tsx
import { useLocale, useTranslations } from "next-intl";
```

```tsx
import AiSummary from "./AiSummary";
```

Also import the locale type alongside the existing `lib/types` import:

```tsx
import type { SuggestCandidate, SuggestLocale, Trip } from "@/lib/types";
```

- [ ] **Step 2: Add summary + dismiss state and read the locale**

Just after `const t = useTranslations("search");`, add:

```tsx
  const locale = useLocale() as SuggestLocale;
```

Add state next to `aiMessage`:

```tsx
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
```

- [ ] **Step 3: Reset summary in `resetAi`**

Update `resetAi` to also clear the summary state:

```tsx
  const resetAi = useCallback(() => {
    requestIdRef.current += 1;
    setAiStatus("idle");
    setAiResults([]);
    setAiMessage(null);
    setAiSummary(null);
    setSummaryDismissed(false);
  }, []);
```

- [ ] **Step 4: Set summary in `askAi`**

In `askAi`, after `setAiStatus("loading");` add `setSummaryDismissed(false);`. Then update the request to pass the locale and capture the summary. Replace:

```tsx
      const { suggestions } = await api.suggestTrips(
        prompt,
        toCandidates(trips),
      );
```

with:

```tsx
      const { summary, suggestions } = await api.suggestTrips(
        prompt,
        toCandidates(trips),
        locale,
      );
```

Then, immediately after the `if (requestId !== requestIdRef.current) return;` guard in the success path, add:

```tsx
      setAiSummary(summary || null);
```

- [ ] **Step 5: Render `AiSummary`, remove the loose message `<p>`**

Replace this block:

```tsx
      {aiMessage ? (
        <p className="text-sm text-muted-foreground">{aiMessage}</p>
      ) : null}
```

with:

```tsx
      {(aiStatus === "loading" ||
        ((aiSummary || aiMessage) && !summaryDismissed)) ? (
        <AiSummary
          loading={aiStatus === "loading"}
          summary={aiSummary}
          message={aiMessage}
          onDismiss={() => setSummaryDismissed(true)}
        />
      ) : null}
```

- [ ] **Step 6: Verify typecheck + existing tests**

Run: `pnpm build && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/TripBrowser.tsx
git commit -m "feat(search): show localized AI summary above trip results"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full check (format, lint, test, build)**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build && pnpm build:lambdas`
Expected: all PASS. (Per the CI format-check gate — run these before pushing.)

- [ ] **Step 2: Manual smoke (optional, local)**

If wired to a backend: on `/en` ask AI with a query — confirm a summary card appears above ranked cards, dismiss works, editing the query hides it. Repeat on `/vi` and confirm the summary is in Vietnamese.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feature/ai-search-summary
```
