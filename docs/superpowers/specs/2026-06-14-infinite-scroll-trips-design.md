# Infinite scroll + scroll-to-top for trip lists

Date: 2026-06-14
Status: Approved

## Goal

Improve browsing of long trip lists with three behaviors, modeled on
`https://skillsmp.com/search`:

1. **Auto load-more on scroll** — additional trips load automatically as the user
   scrolls toward the bottom (no "Load more" button).
2. **Default page size of 12** — only the first 12 trips render initially.
3. **Scroll-to-top button** — a floating button appears once the user has scrolled
   past the first batch, returning them to the top on click.

## Scope (decided)

- Applies to **all three trip lists**: Discover (home), Saved, and My Trips.
- When **grouping is active** (by country, city, etc.), show every group fully —
  infinite scroll applies only to the flat (ungrouped) list and to AI results.

## Non-goals

- No API/backend changes. All lists already fetch the full trip set server-side and
  hold it in memory; this is purely client-side pagination of an in-memory array.
- No server-side pagination, no virtualized list. Dataset is small (ASSUMPTION-001).
- Not a PWA / no URL-synced page state.

## Architecture

### 1. `lib/use-infinite-scroll.ts` — reusable hook

```
useInfiniteScroll<T>(items: T[], pageSize = 12)
  -> { visible: T[]; hasMore: boolean; sentinelRef: RefObject<HTMLDivElement> }
```

- Holds `count` (starts at `pageSize`); returns `items.slice(0, count)`.
- An `IntersectionObserver` on `sentinelRef` grows `count` by `pageSize` when the
  sentinel nears the viewport (`rootMargin: "200px"` so the next page loads just
  before the user reaches the bottom — seamless).
- **Scroll-gated:** the observer is only armed after the user's first scroll.
  Without this, when the first page doesn't fill the viewport (12 cards = 3 rows on
  a wide/tall desktop), the sentinel is on screen at mount and the observer fires
  immediately — cascading to load every page with zero scrolling. Gating keeps the
  "12 first" guarantee at every viewport size.
- **Fill fallback:** if the page is too short to scroll at all
  (`scrollHeight <= innerHeight`), load the next page regardless, so the remaining
  items never become unreachable.
- Resets `count` to `pageSize` whenever the `items` reference changes (new
  search/filter/group/AI results). Callers already pass stable/memoized arrays.
- SSR-safe: observer is created in `useEffect`; if `IntersectionObserver` is
  unavailable, the hook still returns the first page (no crash, no auto-load).

### 2. `components/ScrollToTopButton.tsx` — floating button

- Self-contained client component, `fixed` bottom-right.
- Subscribes to `window` scroll (passive listener); visible when
  `window.scrollY > threshold` (default 600px ≈ past the first batch), hidden near
  the top.
- Click → `window.scrollTo({ top: 0, behavior: "smooth" })`.
- Accessible: real `<button>` with `aria-label="Scroll to top"`; `ArrowUpIcon`
  from `lucide-react` to match existing iconography. Styled with the shared
  `Button` component / Tailwind tokens used elsewhere.

### 3. `components/TripGrid.tsx` — wire pagination into the flat view

- **Flat (ungrouped) branch:** use `useInfiniteScroll(trips)`, render the `visible`
  slice, then a `<div ref={sentinelRef} aria-hidden />` sentinel after the cards.
- **Grouped branch:** unchanged (render all groups fully).
- Empty-state behavior unchanged.

### 4. `components/TripBrowser.tsx` — AI results

- Apply the same hook to the AI-results array so that view also pages 12 at a time
  (sentinel after the AI cards). Plain-search flat view is already covered via
  `TripGrid`.

### 5. Pages

- Render `<ScrollToTopButton />` on the three list pages: `app/page.tsx`,
  `app/saved/page.tsx`, `app/my-trips/page.tsx` (client component rendered inside
  server components — allowed).

## Edge cases

- Fewer than 12 trips: sentinel never intersects → nothing extra loads; button never
  appears (user can't scroll past threshold).
- Grouped view: all shown, no sentinel.
- Resetting: changing search text, filters, grouping, or running AI resets the
  visible count back to 12.
- No layout shift: sentinel is an empty zero-height element.

## Testing / verification

The repo has no jsdom/testing-library setup (Vitest runs node-only, pure-logic
tests), so DOM-behavior unit tests are out of scope here. The pagination logic is a
trivial slice with no branching worth isolating. Verification:

- `pnpm build` (includes `tsc` typecheck), `pnpm lint`, `pnpm format:check`.
- Manual scroll test against staging (24 seeded trips): initial 12, auto-load on
  scroll, button appears/works, reset on filter/group/search change.
