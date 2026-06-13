# Road-Rash UX Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auth-aware profile menu with an initial avatar, make the trip-detail like/favorite count interactive (and harden its backend increment), merge plain + AI search into one control with collapsible filters, give the hero an animated travel background, expose an owner-only Edit button, and seed 12 example trips.

**Architecture:** Builds on the existing Next.js App Router (SSR) frontend + REST Lambda backend. No new dependencies and no new AWS resources. Client auth uses the existing `aws-amplify/auth` (`fetchAuthSession`, `signOut`). `FavoritesProvider` already wraps the whole app (`app/layout.tsx:38`), so any client component can call `useFavorites()`. Pure logic is extracted into small testable helpers; UI changes are verified with `pnpm build` (typecheck) and `pnpm dev`.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19, Tailwind v4, lucide-react, aws-amplify v6, AWS SDK v3 (lib-dynamodb), Vitest.

---

## Spec reference

`docs/superpowers/specs/2026-06-13-app-ux-update-design.md`

## File map

- `services/favorites/count.ts` — **create** — pure builder for the `favoriteCount` UpdateCommand input.
- `services/favorites/count.test.ts` — **create** — unit tests for the builder.
- `services/favorites/handler.ts` — **modify** — use the builder (hardened `if_not_exists`).
- `components/TripDetail.tsx` — **modify** — interactive favorite heart + owner-only Edit button.
- `lib/avatar.ts` — **create** — pure `avatarInitial(email)` helper.
- `lib/avatar.test.ts` — **create** — unit tests.
- `components/UserMenu.tsx` — **create** — avatar dropdown (email, Liked trips, My trips, Sign out).
- `components/AppHeader.tsx` — **modify** — mount UserMenu when signed in; trim nav.
- `components/SearchPill.tsx` — **create** — unified search input + inline Ask AI button.
- `components/TripBrowser.tsx` — **modify** — own AI mode + collapsible filters; render via SearchPill.
- `components/AiSuggestBox.tsx` — **delete** — folded into TripBrowser/SearchPill.
- `components/SearchBar.tsx` — **delete** — replaced by SearchPill.
- `app/page.tsx` — **modify** — drop the standalone `<AiSuggestBox>`.
- `components/DiscoverHero.tsx` — **modify** — full-bleed background image + scrim.
- `app/globals.css` — **modify** — Ken-Burns keyframes + reduced-motion guard.
- `public/hero-road.jpg` — **create** — sourced travel image.
- `scripts/seed-trips.ts` — **create** — staging seed script + `buildSeedTrips` helper.
- `scripts/seed-trips.test.ts` — **create** — unit tests for `buildSeedTrips`.
- `scripts/README-seed.md` — **create** — how to run the seed.

---

## Task 1: Harden the favoriteCount increment (backend)

**Why:** The favorite Lambda increments with `SET favoriteCount = favoriteCount + :delta`, which throws if a trip row lacks the `favoriteCount` attribute. Use `if_not_exists` so the bump is robust. Extract the command-input builder into a pure function so it can be unit-tested without a DynamoDB client.

**Files:**
- Create: `services/favorites/count.ts`
- Create: `services/favorites/count.test.ts`
- Modify: `services/favorites/handler.ts`

- [ ] **Step 1: Write the failing test**

Create `services/favorites/count.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildFavoriteCountUpdate } from "./count";

describe("buildFavoriteCountUpdate", () => {
  it("increments with if_not_exists so a missing attribute can't throw", () => {
    const input = buildFavoriteCountUpdate("Trip", "trip-1", 1);
    expect(input.TableName).toBe("Trip");
    expect(input.Key).toEqual({ id: "trip-1" });
    expect(input.UpdateExpression).toBe(
      "SET favoriteCount = if_not_exists(favoriteCount, :zero) + :delta",
    );
    expect(input.ConditionExpression).toBe("attribute_exists(id)");
    expect(input.ExpressionAttributeValues).toEqual({ ":delta": 1, ":zero": 0 });
  });

  it("guards the decrement so the counter never goes below zero", () => {
    const input = buildFavoriteCountUpdate("Trip", "trip-1", -1);
    expect(input.ConditionExpression).toBe(
      "attribute_exists(id) AND favoriteCount > :zero",
    );
    expect(input.ExpressionAttributeValues).toEqual({ ":delta": -1, ":zero": 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test services/favorites/count.test.ts`
Expected: FAIL — cannot find module `./count`.

- [ ] **Step 3: Write the minimal implementation**

Create `services/favorites/count.ts`:

```ts
import type { UpdateCommandInput } from "@aws-sdk/lib-dynamodb";

// Builds the UpdateItem input that nudges a trip's denormalized favoriteCount.
// `if_not_exists` seeds the counter at 0 for trips that never had the attribute
// (e.g. seeded rows), so the increment can't raise a ValidationException. The
// decrement is guarded so the counter never drops below zero if it has drifted.
export function buildFavoriteCountUpdate(
  tableName: string,
  tripId: string,
  delta: 1 | -1,
): UpdateCommandInput {
  return {
    TableName: tableName,
    Key: { id: tripId },
    UpdateExpression:
      "SET favoriteCount = if_not_exists(favoriteCount, :zero) + :delta",
    ConditionExpression:
      delta > 0
        ? "attribute_exists(id)"
        : "attribute_exists(id) AND favoriteCount > :zero",
    ExpressionAttributeValues: { ":delta": delta, ":zero": 0 },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test services/favorites/count.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the builder into the handler**

In `services/favorites/handler.ts`, add the import near the other local imports (after line 14, the `validateFavoriteInput` import):

```ts
import { buildFavoriteCountUpdate } from "./count";
```

Then replace the body of `adjustFavoriteCount` (the `new UpdateCommand({ ... })` block, lines ~57-68) so the `ddb.send` call uses the builder:

```ts
  try {
    await ddb.send(
      new UpdateCommand(buildFavoriteCountUpdate(TRIP_TABLE, tripId, delta)),
    );
  } catch (err) {
    // The trip may have been deleted, or the count already floored at 0 — the
    // favorite row is still the source of truth, so don't fail the request.
    if (!isConditionalCheckFailed(err)) throw err;
  }
```

- [ ] **Step 6: Typecheck and run the full test suite**

Run: `pnpm test && pnpm build`
Expected: all tests pass; build (incl. `tsc`) succeeds.

- [ ] **Step 7: Commit**

```bash
git add services/favorites/count.ts services/favorites/count.test.ts services/favorites/handler.ts
git commit -m "fix(favorites): harden favoriteCount increment with if_not_exists"
```

---

## Task 2: Interactive favorite heart on the trip detail view

**Why:** `components/TripDetail.tsx:87` renders `trip.favoriteCount` statically with no toggle, so favoriting never appears to move the count on the detail modal / share page. Mirror `TripCard`'s heart using the global `FavoritesProvider`.

**Files:**
- Modify: `components/TripDetail.tsx`

- [ ] **Step 1: Add the client hooks and imports**

In `components/TripDetail.tsx`, extend the imports. Add `useRouter` and the favorites import:

```ts
import { useRouter } from "next/navigation";
import { useFavorites } from "@/components/FavoritesProvider";
```

Then change the existing button import (line 16) from `import { buttonVariants } from "@/components/ui/button";` to pull in `Button` too (one line, no duplicate import):

```ts
import { Button, buttonVariants } from "@/components/ui/button";
```

(`HeartIcon`, `cn`, `buttonVariants`, `useEffect`, `useRef`, `useState` are already imported.)

- [ ] **Step 2: Compute favorite state inside the component**

Inside `TripDetail`, just after `const VehicleIcon = VEHICLE_ICON[trip.vehicle];` (line ~70), add:

```ts
  const router = useRouter();
  const { isFavorited, countDelta, toggle, signedIn } = useFavorites();
  const favorited = isFavorited(trip.id);
  const favoriteCount = Math.max(0, trip.favoriteCount + countDelta(trip.id));

  function handleFavorite() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    void toggle(trip.id);
  }
```

- [ ] **Step 3: Replace the static count badge with an interactive button**

In the header `<div className="flex items-start justify-between gap-4">`, replace the `<span ... title="Favorites">…</span>` block (lines ~82-91) with:

```tsx
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFavorite}
            aria-pressed={favorited}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            title={favorited ? "Remove from favorites" : "Add to favorites"}
            className="shrink-0 gap-1.5"
          >
            <HeartIcon
              aria-hidden
              className={cn("size-4", favorited ? "fill-current text-destructive" : "")}
            />
            <span aria-hidden>{favoriteCount}</span>
            <span className="sr-only">
              {favoriteCount} favorite{favoriteCount === 1 ? "" : "s"}
            </span>
          </Button>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm build`
Expected: build succeeds (no type errors).

- [ ] **Step 5: Manually verify in dev**

Run: `pnpm dev`, open a trip (card → modal, and `/trip/[id]`). Expected: signed out, tapping the heart routes to `/login`; signed in, the heart fills and the count increments optimistically. (Persistence across reload is verified against staging in Task 8.)

- [ ] **Step 6: Commit**

```bash
git add components/TripDetail.tsx
git commit -m "feat(trips): make the detail favorite heart interactive"
```

---

## Task 3: Owner-only Edit button on the trip detail view

**Why:** The edit page (`app/trips/[id]/edit/page.tsx`) and owner-gated `PUT /trips/{id}` already exist, but nothing links to them. Show an Edit link to the trip's owner. Detail renders in both the client modal and the server share page, so detect ownership client-side via `fetchAuthSession` for one uniform path.

**Files:**
- Modify: `components/TripDetail.tsx`

- [ ] **Step 1: Add imports for the owner check and link**

In `components/TripDetail.tsx`, add:

```ts
import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
```

(Add `PencilIcon` to the existing `lucide-react` import list rather than a second import if you prefer.)

- [ ] **Step 2: Resolve the current user's sub and derive ownership**

Inside `TripDetail`, add state and an effect (place near the other `useState`/`useEffect` calls):

```ts
  const [currentSub, setCurrentSub] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAuthSession()
      .then((session) => {
        const sub = session.tokens?.idToken?.payload.sub;
        if (active && typeof sub === "string") setCurrentSub(sub);
      })
      .catch(() => {
        // Signed out / no session — no owner controls.
      });
    return () => {
      active = false;
    };
  }, []);

  const isOwner = currentSub !== null && currentSub === trip.authorId;
```

- [ ] **Step 3: Render the Edit link for owners**

In the map `<section>` header row (the `<div className="flex items-center justify-between gap-3">` that holds the "Map" heading and the "Open in Google Maps" link, lines ~136-150), wrap the right-hand actions so the Edit link sits next to "Open in Google Maps". Replace the single `<a … >Open in Google Maps</a>` with:

```tsx
          <div className="flex shrink-0 items-center gap-2">
            {isOwner ? (
              <Link
                href={`/trips/${trip.id}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <PencilIcon aria-hidden />
                Edit
              </Link>
            ) : null}
            <a
              href={googleMapsLink(trip)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <NavigationIcon aria-hidden />
              Open in Google Maps
            </a>
          </div>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Manually verify in dev**

Run: `pnpm dev`. Expected: the Edit button appears only on trips authored by the signed-in user; clicking it opens `/trips/[id]/edit`. (Non-owners and signed-out users see no Edit button; the Lambda `PUT` still enforces ownership regardless.)

- [ ] **Step 6: Commit**

```bash
git add components/TripDetail.tsx
git commit -m "feat(trips): show owner-only Edit button on trip detail"
```

---

## Task 4: avatarInitial helper + UserMenu component

**Why:** The navbar needs an initial-based avatar and a dropdown. Extract the initial logic as a pure, tested helper; build the menu as a self-contained client component.

**Files:**
- Create: `lib/avatar.ts`
- Create: `lib/avatar.test.ts`
- Create: `components/UserMenu.tsx`

- [ ] **Step 1: Write the failing test for the helper**

Create `lib/avatar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avatarInitial } from "./avatar";

describe("avatarInitial", () => {
  it("returns the uppercased first letter of the email", () => {
    expect(avatarInitial("huy@example.com")).toBe("H");
  });

  it("trims surrounding whitespace before taking the first letter", () => {
    expect(avatarInitial("  zoe@example.com  ")).toBe("Z");
  });

  it("falls back to a placeholder for empty or missing input", () => {
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial(undefined)).toBe("?");
    expect(avatarInitial(null)).toBe("?");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/avatar.test.ts`
Expected: FAIL — cannot find module `./avatar`.

- [ ] **Step 3: Implement the helper**

Create `lib/avatar.ts`:

```ts
// Initial-based avatar label: the uppercase first character of the user's email
// (no Google profile photo). Falls back to "?" when there is no email.
export function avatarInitial(email?: string | null): string {
  const trimmed = email?.trim() ?? "";
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/avatar.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the UserMenu component**

Create `components/UserMenu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { HeartIcon, LogOutIcon, RouteIcon } from "lucide-react";
import { avatarInitial } from "@/lib/avatar";
import { cn } from "@/lib/utils";

// Signed-in account control for the navbar. Reads the email client-side to
// render an initial avatar, and opens a dropdown with the saved/authored views
// and sign-out. Renders nothing until a session is confirmed, so signed-out
// visitors keep the plain "Sign in" link in AppHeader.

const MENU_LINKS = [
  { href: "/saved", label: "Liked trips", icon: HeartIcon },
  { href: "/my-trips", label: "My trips", icon: RouteIcon },
] as const;

export default function UserMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchAuthSession()
      .then((session) => {
        const value = session.tokens?.idToken?.payload.email;
        if (active && typeof value === "string") setEmail(value);
      })
      .catch(() => {
        // Signed out — leave email null so the component renders nothing.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    try {
      await signOut();
    } finally {
      // Refresh so SSR pages re-render in the signed-out state.
      router.replace("/");
      router.refresh();
    }
  }

  // Not signed in (yet): render nothing; AppHeader shows the Sign in link.
  if (!email) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {avatarInitial(email)}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <p className="truncate border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {email}
          </p>
          {MENU_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className={cn(
              "flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <LogOutIcon className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck and run tests**

Run: `pnpm test lib/avatar.test.ts && pnpm build`
Expected: helper tests pass; build succeeds. (`bg-popover`/`text-popover-foreground` are standard shadcn tokens; if `pnpm build` reports them missing, substitute `bg-card`/`text-card-foreground`, which the project already uses.)

- [ ] **Step 7: Commit**

```bash
git add lib/avatar.ts lib/avatar.test.ts components/UserMenu.tsx
git commit -m "feat(shell): add avatar helper and UserMenu dropdown"
```

---

## Task 5: Mount UserMenu in AppHeader + trim the nav

**Why:** Wire the menu into the header for signed-in users and reduce the top nav to Discover (Liked trips / My trips now live in the dropdown). The mobile menu keeps all destinations.

**Files:**
- Modify: `components/AppHeader.tsx`

- [ ] **Step 1: Add the UserMenu import and trim NAV_ITEMS**

In `components/AppHeader.tsx`:

Add the import after the `AppLogo` import:

```ts
import UserMenu from "@/components/UserMenu";
```

Replace the `NAV_ITEMS` constant (lines 12-16) with Discover only:

```ts
const NAV_ITEMS = [{ href: "/", label: "Discover" }] as const;

// Destinations that move into the avatar dropdown on desktop but stay in the
// mobile menu so every view is reachable on small screens.
const ACCOUNT_LINKS = [
  { href: "/saved", label: "Liked trips" },
  { href: "/my-trips", label: "My trips" },
] as const;
```

- [ ] **Step 2: Render UserMenu beside the desktop actions**

In the desktop actions block (`<div className="hidden items-center gap-3 lg:flex">`, lines 55-66), keep `ModeToggle`, `Sign in`, and `Create trip`, and add `<UserMenu />` after the `Create trip` link:

```tsx
        <div className="hidden items-center gap-3 lg:flex">
          <ModeToggle />
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Sign in
          </Link>
          <Link href="/trips/new" className={buttonVariants()}>
            Create trip
          </Link>
          <UserMenu />
        </div>
```

(`UserMenu` renders nothing when signed out, so the `Sign in` link is the visible control then; when signed in, the avatar appears alongside. This needs no client session check in `AppHeader` itself.)

- [ ] **Step 3: Add the account links to the mobile menu**

In the mobile menu `<nav … aria-label="Mobile">`, after the `NAV_ITEMS.map(...)` block (line ~102) and before the `ModeToggle` divider, add the account links:

```tsx
            {ACCOUNT_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(isActive(item.href))}
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Manually verify in dev**

Run: `pnpm dev`. Expected: signed out → top nav shows only "Discover" + "Sign in" + "Create trip"; signed in → an initial avatar appears, its dropdown shows the email, Liked trips, My trips, Sign out; Sign out returns to a signed-out Discover page. Mobile menu lists Discover, Liked trips, My trips.

- [ ] **Step 6: Commit**

```bash
git add components/AppHeader.tsx
git commit -m "feat(shell): mount UserMenu and slim the primary nav"
```

---

## Task 6: Unified search pill + collapsible filters

**Why:** Merge plain search and AI ranking into one control (Ask AI inside the pill, submit-only) and hide filters/group behind a toggle. Folds `AiSuggestBox` into `TripBrowser` and replaces `SearchBar` with `SearchPill`.

**Files:**
- Create: `components/SearchPill.tsx`
- Modify: `components/TripBrowser.tsx`
- Modify: `app/page.tsx`
- Delete: `components/AiSuggestBox.tsx`
- Delete: `components/SearchBar.tsx`

- [ ] **Step 1: Create the SearchPill component**

Create `components/SearchPill.tsx`:

```tsx
"use client";

import { type FormEvent } from "react";
import { SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One control for both modes: typing drives instant plain search (onChange),
// and the inline "Ask AI" button submits the same text for AI ranking
// (submit-only — never per-keystroke, per CON-003). The parent (TripBrowser)
// owns the value and decides which result set to render.

export default function SearchPill({
  value,
  onChange,
  onAskAi,
  onClear,
  loading,
  aiActive,
}: {
  value: string;
  onChange: (q: string) => void;
  onAskAi: () => void;
  onClear: () => void;
  loading: boolean;
  aiActive: boolean;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || !value.trim()) return;
    onAskAi();
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <label htmlFor="trip-search" className="sr-only">
        Search trips or describe your ride
      </label>
      <SearchIcon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="trip-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search trips, or describe your ride…"
        className="h-12 pl-9 pr-44"
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {(value || aiActive) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            className="size-9"
            onClick={onClear}
          >
            <XIcon aria-hidden />
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={loading || !value.trim()}
          className="gap-1.5"
        >
          <SparklesIcon aria-hidden />
          {loading ? "Asking…" : "Ask AI"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite TripBrowser to own AI mode + collapsible filters**

Replace the entire contents of `components/TripBrowser.tsx` with:

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import SearchPill from "./SearchPill";
import FilterControls from "./FilterControls";
import TripCard from "./TripCard";
import TripGrid from "./TripGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
  filterTrips,
  groupTrips,
  type GroupField,
  type TripFilters,
} from "@/lib/search";
import { formatEnum } from "@/lib/format";
import type { SuggestCandidate, Trip } from "@/lib/types";

// Client-side discovery shell. Typing filters the loaded set instantly
// (lib/search.ts); the inline "Ask AI" button submits the same text to
// POST /suggest (submit-only) and the grid switches to the ranked results until
// cleared. Filters + grouping collapse behind a toggle.

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: "country", label: "Country" },
  { value: "province", label: "Province" },
  { value: "city", label: "City" },
  { value: "tripType", label: "Trip type" },
  { value: "vehicle", label: "Vehicle" },
];

const ENUM_GROUPS: ReadonlySet<GroupField> = new Set(["tripType", "vehicle"]);

// Compact projection sent as the AI candidate set — never the full record.
function toCandidates(trips: Trip[]): SuggestCandidate[] {
  return trips.map((t) => ({
    id: t.id,
    name: t.name,
    location: t.location,
    city: t.city,
    province: t.province,
    country: t.country,
    tripType: t.tripType,
    vehicle: t.vehicle,
    durationDays: t.durationDays,
    description: t.description,
  }));
}

type AiResult = { trip: Trip; reason?: string };
type AiStatus = "idle" | "loading" | "done";

export default function TripBrowser({
  trips,
  emptyMessage = "No trips yet.",
}: {
  trips: Trip[];
  emptyMessage?: string;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<TripFilters>({});
  const [groupBy, setGroupBy] = useState<GroupField | "">("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiResults, setAiResults] = useState<AiResult[]>([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const handleChange = useCallback((value: string) => {
    setQ(value);
    // Editing the query drops back to plain search.
    setAiStatus("idle");
    setAiResults([]);
    setAiMessage(null);
  }, []);

  const visible = useMemo(
    () => filterTrips(trips, q, filters),
    [trips, filters, q],
  );

  const groups = useMemo(() => {
    if (!groupBy) return undefined;
    return groupTrips(visible, groupBy).map((g) => ({
      label: ENUM_GROUPS.has(groupBy) ? formatEnum(g.key) : g.key,
      trips: g.trips,
    }));
  }, [visible, groupBy]);

  async function askAi() {
    const prompt = q.trim();
    if (!prompt) return;
    setAiStatus("loading");
    setAiMessage(null);

    const byId = new Map(trips.map((t) => [t.id, t]));
    try {
      const { suggestions } = await api.suggestTrips(prompt, toCandidates(trips));
      const mapped = suggestions
        .map((s): AiResult | undefined => {
          const trip = byId.get(s.id);
          return trip ? { trip, reason: s.reason } : undefined;
        })
        .filter((r): r is AiResult => r !== undefined);
      setAiResults(mapped);
      setAiMessage(
        mapped.length === 0
          ? "No trips matched that — try a different description, or browse below."
          : null,
      );
    } catch {
      // Gemini unavailable/timed out — fall back to plain search over the same
      // candidate set so the user still gets results.
      const fallback = filterTrips(trips, prompt, {}).map(
        (trip): AiResult => ({ trip }),
      );
      setAiResults(fallback);
      setAiMessage(
        fallback.length === 0
          ? `AI is unavailable and no trips matched “${prompt}”. Try another search.`
          : "AI is unavailable right now — showing plain search results instead.",
      );
    } finally {
      setAiStatus("done");
    }
  }

  function clearSearch() {
    setQ("");
    setAiStatus("idle");
    setAiResults([]);
    setAiMessage(null);
  }

  const aiActive = aiStatus === "done";
  const resultCount = aiActive ? aiResults.length : visible.length;
  const resultLabel = `${resultCount} route${resultCount === 1 ? "" : "s"}`;
  const hasActiveFilters = Object.values(filters).some(Boolean) || Boolean(groupBy);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <SearchPill
          value={q}
          onChange={handleChange}
          onAskAi={askAi}
          onClear={clearSearch}
          loading={aiStatus === "loading"}
          aiActive={aiActive}
        />
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-primary"
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontalIcon className="size-4" aria-hidden />
            {filtersOpen ? "Hide filters" : "Show filters"}
            {hasActiveFilters ? (
              <span className="ml-1 size-2 rounded-full bg-primary" aria-hidden />
            ) : null}
          </Button>
          <Badge variant="outline" className="bg-background">
            {resultLabel}
          </Badge>
        </div>

        {filtersOpen ? (
          <div id="filter-panel" className="flex flex-col gap-3">
            <FilterControls trips={trips} filters={filters} onChange={setFilters} />
            <div className="flex items-center gap-2">
              <label
                htmlFor="trip-group-by"
                className="text-sm font-medium text-muted-foreground"
              >
                Group
              </label>
              <Select
                id="trip-group-by"
                aria-label="Group trips by"
                className="min-w-48"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupField | "")}
              >
                <option value="">No grouping</option>
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    By {g.label.toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      {aiMessage ? (
        <p className="text-sm text-muted-foreground">{aiMessage}</p>
      ) : null}

      {aiActive ? (
        aiResults.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {aiResults.map(({ trip, reason }) => (
              <div key={trip.id} className="flex flex-col gap-1">
                <TripCard trip={trip} />
                {reason ? (
                  <p className="px-1 text-xs italic text-muted-foreground">
                    {reason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null
      ) : (
        <TripGrid
          trips={visible}
          groups={groups}
          emptyMessage={
            trips.length === 0
              ? emptyMessage
              : "No trips match your search and filters."
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Remove the standalone AiSuggestBox from the home page**

In `app/page.tsx`, delete the import line `import AiSuggestBox from "@/components/AiSuggestBox";` (line 5) and replace the results block (lines 45-53) so only `TripBrowser` renders:

```tsx
          ) : (
            <TripBrowser
              trips={trips}
              emptyMessage="No trips yet — be the first to share one."
            />
          )}
```

- [ ] **Step 4: Delete the folded-in components**

```bash
git rm components/AiSuggestBox.tsx components/SearchBar.tsx
```

- [ ] **Step 5: Confirm nothing else imports the deleted files**

Run: `grep -rn "AiSuggestBox\|SearchBar" app components lib`
Expected: no matches.

- [ ] **Step 6: Typecheck and run tests**

Run: `pnpm test && pnpm build`
Expected: all tests pass; build succeeds.

- [ ] **Step 7: Manually verify in dev**

Run: `pnpm dev` on Discover. Expected: typing filters cards instantly; "Ask AI" runs once on click/Enter and the grid switches to ranked results with reason captions; clearing returns to the full list; "Show filters" reveals filters + group and "Hide filters" collapses them; the result count reflects the active set.

- [ ] **Step 8: Commit**

```bash
git add components/SearchPill.tsx components/TripBrowser.tsx app/page.tsx
git commit -m "feat(discover): unify search + AI into one pill with collapsible filters"
```

---

## Task 7: Animated hero background

**Why:** Put a travel-themed image behind the hero headline with a gradient scrim and a subtle slow-zoom, respecting reduced-motion.

**Files:**
- Create: `public/hero-road.jpg`
- Modify: `app/globals.css`
- Modify: `components/DiscoverHero.tsx`

- [ ] **Step 1: Source and add the hero image**

Find a free-license (Unsplash or Pexels) landscape road-trip / winding-road photo. Download it, resize to ~1600px wide, compress to keep it under ~300 KB, and save it as `public/hero-road.jpg`. (Suggested search: WebSearch "unsplash winding coastal road landscape free" — verify the license permits use and attribution is not required, or note the credit in the PR description.)

Verify: `ls -lh public/hero-road.jpg` shows a reasonably sized JPEG.

- [ ] **Step 2: Add Ken-Burns keyframes to globals.css**

Append to `app/globals.css`:

```css
/* Subtle slow-zoom for the discover hero background (disabled for users who
   prefer reduced motion). */
@keyframes hero-kenburns {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.08);
  }
}

.hero-kenburns {
  animation: hero-kenburns 20s ease-in-out infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  .hero-kenburns {
    animation: none;
  }
}
```

- [ ] **Step 3: Layer the background image in DiscoverHero**

In `components/DiscoverHero.tsx`, replace the opening `<section className="bg-muted">` element (line 30) and its inner wrapper so the image sits behind a gradient scrim. Change the `<section>` to be relative and add two absolutely-positioned layers before the existing `<div className="mx-auto …">` content wrapper:

```tsx
  return (
    <section className="relative isolate overflow-hidden bg-muted">
      <div
        aria-hidden
        className="hero-kenburns absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-road.jpg')" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/20"
      />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
```

- [ ] **Step 4: Recolor the hero text for contrast over the image**

In the same file, adjust the foreground text so it reads on the dark scrim:

- The headline `<h1 …>`: change its class to `text-4xl leading-tight font-semibold text-balance text-white sm:text-5xl`.
- The paragraph `<p className="max-w-2xl text-lg leading-8 text-muted-foreground">`: change to `text-lg leading-8 text-white/85`.
- The badge `<Badge variant="outline" className="w-fit bg-background/70">`: change to `w-fit border-white/40 bg-white/10 text-white`.

(The right-hand stat cards already use `bg-background/80 … backdrop-blur`, which reads fine over the image — leave them.)

- [ ] **Step 5: Typecheck**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 6: Manually verify in dev**

Run: `pnpm dev`. Expected: the hero shows the photo behind a left-dark gradient; the headline/sub/badge are legible in white; a slow zoom is visible; enabling "Reduce motion" in the OS stops the animation; stat cards remain readable.

- [ ] **Step 7: Commit**

```bash
git add public/hero-road.jpg app/globals.css components/DiscoverHero.tsx
git commit -m "feat(discover): add animated travel background to the hero"
```

---

## Task 8: Seed 12 example trips into staging

**Why:** Provide 12 trips for testing. A pure `buildSeedTrips` helper (testable) generates 11 variations from a template; the script POSTs them to the staging API using a bearer token copied from a signed-in browser session.

**Files:**
- Create: `scripts/seed-trips.ts`
- Create: `scripts/seed-trips.test.ts`
- Create: `scripts/README-seed.md`

- [ ] **Step 1: Write the failing test for the generator**

Create `scripts/seed-trips.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSeedTrips } from "./seed-trips";
import type { TripInput } from "../lib/types";

const template: TripInput = {
  name: "Hai Van Pass Loop",
  location: "Hai Van Pass, Da Nang",
  tripType: "ROAD_TRIP",
  city: "Da Nang",
  province: "Da Nang",
  country: "Vietnam",
  durationDays: 2,
  vehicle: "MOTORBIKE",
  myMapsUrl: "https://www.google.com/maps/d/edit?mid=EXAMPLE",
};

describe("buildSeedTrips", () => {
  it("produces 11 variations", () => {
    expect(buildSeedTrips(template)).toHaveLength(11);
  });

  it("gives every variation a distinct, non-empty name", () => {
    const names = buildSeedTrips(template).map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.trim().length > 0)).toBe(true);
  });

  it("reuses the template's My Maps URL so each trip embeds a valid map", () => {
    expect(
      buildSeedTrips(template).every((t) => t.myMapsUrl === template.myMapsUrl),
    ).toBe(true);
  });

  it("only emits known trip types and vehicles", () => {
    const types = new Set([
      "ROAD_TRIP", "CITY", "BEACH", "MOUNTAIN", "FOOD", "CAMPING", "OTHER",
    ]);
    const vehicles = new Set(["MOTORBIKE", "CAR", "BICYCLE", "OTHER"]);
    for (const t of buildSeedTrips(template)) {
      expect(types.has(t.tripType)).toBe(true);
      expect(vehicles.has(t.vehicle)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test scripts/seed-trips.test.ts`
Expected: FAIL — cannot find module `./seed-trips`.

- [ ] **Step 3: Implement the generator + script**

Create `scripts/seed-trips.ts`:

```ts
import type { Trip, TripInput, TripType, Vehicle } from "../lib/types";

// Seeds example trips into the staging API for testing. Eleven variations are
// derived from a template trip (the one the user already created) so they all
// embed a valid, real My Maps URL. Run with a bearer token copied from a
// signed-in browser session — see scripts/README-seed.md.

type Variation = {
  name: string;
  location: string;
  city: string;
  province: string;
  country: string;
  tripType: TripType;
  vehicle: Vehicle;
  durationDays: number;
  description: string;
};

const VARIATIONS: Variation[] = [
  { name: "Ha Giang Loop Adventure", location: "Ha Giang Loop", city: "Ha Giang", province: "Ha Giang", country: "Vietnam", tripType: "MOUNTAIN", vehicle: "MOTORBIKE", durationDays: 4, description: "Limestone peaks and switchback passes on the northern frontier loop." },
  { name: "Da Lat Coffee Country Ride", location: "Da Lat Highlands", city: "Da Lat", province: "Lam Dong", country: "Vietnam", tripType: "FOOD", vehicle: "MOTORBIKE", durationDays: 3, description: "Pine forests, waterfalls, and highland coffee farms." },
  { name: "Mui Ne Coastal Cruise", location: "Mui Ne Beach", city: "Phan Thiet", province: "Binh Thuan", country: "Vietnam", tripType: "BEACH", vehicle: "CAR", durationDays: 2, description: "Red sand dunes and a long quiet coastal road." },
  { name: "Mekong Delta Slow Roll", location: "Mekong Delta", city: "Can Tho", province: "Can Tho", country: "Vietnam", tripType: "ROAD_TRIP", vehicle: "CAR", durationDays: 3, description: "Floating markets, river ferries, and orchard backroads." },
  { name: "Sapa Terraces Trek Drive", location: "Sapa Rice Terraces", city: "Sapa", province: "Lao Cai", country: "Vietnam", tripType: "MOUNTAIN", vehicle: "CAR", durationDays: 3, description: "Terraced valleys and the climb toward Fansipan." },
  { name: "Hoi An Old Town Pedal", location: "Hoi An Ancient Town", city: "Hoi An", province: "Quang Nam", country: "Vietnam", tripType: "CITY", vehicle: "BICYCLE", durationDays: 1, description: "Lantern-lit lanes and rice-paddy bike paths." },
  { name: "Phong Nha Cave Country", location: "Phong Nha-Ke Bang", city: "Dong Hoi", province: "Quang Binh", country: "Vietnam", tripType: "CAMPING", vehicle: "MOTORBIKE", durationDays: 3, description: "Jungle karst and the world's biggest caves." },
  { name: "Nha Trang Bay Drive", location: "Nha Trang Bay", city: "Nha Trang", province: "Khanh Hoa", country: "Vietnam", tripType: "BEACH", vehicle: "CAR", durationDays: 2, description: "Island-dotted bay and a breezy coastal highway." },
  { name: "Pleiku Highland Crossing", location: "Central Highlands", city: "Pleiku", province: "Gia Lai", country: "Vietnam", tripType: "ROAD_TRIP", vehicle: "MOTORBIKE", durationDays: 4, description: "Volcanic crater lakes and red-earth plantations." },
  { name: "Cat Ba Island Explorer", location: "Cat Ba Island", city: "Cat Ba", province: "Hai Phong", country: "Vietnam", tripType: "BEACH", vehicle: "OTHER", durationDays: 2, description: "Limestone islets, hidden coves, and a national park ride." },
  { name: "Saigon Street Food Spin", location: "Ho Chi Minh City", city: "Ho Chi Minh City", province: "Ho Chi Minh City", country: "Vietnam", tripType: "FOOD", vehicle: "MOTORBIKE", durationDays: 1, description: "A loop of the city's best street-food corners." },
];

// Eleven TripInputs derived from the template. The template supplies the valid
// My Maps URL (and optional thumbnail) so each seeded trip renders a real map.
export function buildSeedTrips(template: TripInput): TripInput[] {
  return VARIATIONS.map((v) => ({
    name: v.name,
    description: v.description,
    location: v.location,
    tripType: v.tripType,
    city: v.city,
    province: v.province,
    country: v.country,
    durationDays: v.durationDays,
    vehicle: v.vehicle,
    myMapsUrl: template.myMapsUrl,
    ...(template.googleMapsUrl ? { googleMapsUrl: template.googleMapsUrl } : {}),
  }));
}

// --- Script entrypoint ----------------------------------------------------
// Only runs when invoked directly (not when imported by the test).
async function main(): Promise<void> {
  const apiBase = process.env.API_BASE_URL;
  const token = process.env.ID_TOKEN;
  if (!apiBase || !token) {
    throw new Error("Set API_BASE_URL and ID_TOKEN — see scripts/README-seed.md");
  }
  const base = apiBase.replace(/\/$/, "");

  // Use an existing trip as the template (for a valid My Maps URL). Fall back to
  // the first listed trip; abort if there are none.
  const listRes = await fetch(`${base}/trips`);
  if (!listRes.ok) throw new Error(`GET /trips failed: ${listRes.status}`);
  const { trips } = (await listRes.json()) as { trips: Trip[] };
  const template = trips[0];
  if (!template) {
    throw new Error("No existing trip to use as a template — create one first.");
  }

  const seeds = buildSeedTrips(template);
  for (const seed of seeds) {
    const res = await fetch(`${base}/trips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(seed),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`POST /trips failed for "${seed.name}": ${res.status} ${body}`);
    }
    console.log(`created: ${seed.name}`);
  }
  console.log(`Done — seeded ${seeds.length} trips (total should now be 12).`);
}

// `import.meta.url` matches the invoked file only when run directly via tsx.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test scripts/seed-trips.test.ts`
Expected: PASS (4 tests).

(If Vitest does not pick up files under `scripts/`, move `seed-trips.ts` + its test to `lib/seed-trips.ts` and update the script entrypoint accordingly. The repo's default config globs `**/*.test.ts`, so this should not be needed.)

- [ ] **Step 5: Write the run instructions**

Create `scripts/README-seed.md`:

```markdown
# Seeding example trips

Loads 11 extra example trips (total 12) into the **staging** API. Trips are
authored under your account, so they also appear in "My trips".

## Prerequisites
- You have created at least one trip in staging (used as the My Maps template).
- You are signed in to the staging site in your browser.

## Get your ID token
1. Open the staging site signed in, open DevTools → Console.
2. Run:
   ```js
   (await (await import('https://esm.sh/aws-amplify/auth')).fetchAuthSession()).tokens.idToken.toString()
   ```
   …or copy the `Authorization: Bearer <token>` value from any authenticated
   request in the Network tab (drop the `Bearer ` prefix).

## Run
```bash
API_BASE_URL="https://<staging-api-base>" ID_TOKEN="<token>" pnpm dlx tsx scripts/seed-trips.ts
```

`API_BASE_URL` is the same value as `NEXT_PUBLIC_API_BASE_URL` in the staging
app. Re-running creates duplicates (there is no upsert).
```

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-trips.ts scripts/seed-trips.test.ts scripts/README-seed.md
git commit -m "feat(scripts): add staging trip seed script with 11 examples"
```

- [ ] **Step 7: Run the seed against staging (manual, after deploy)**

Once this branch is merged/deployed to staging, follow `scripts/README-seed.md`. Expected: 11 "created:" lines and a total of 12 trips on Discover. Verify favoriting one increments the count on its detail view and persists across a reload (closes Task 1 + Task 2 end-to-end).

---

## Final verification

- [ ] Run `pnpm test` — all unit tests pass (favorites count, avatar, seed generator, plus existing suites).
- [ ] Run `pnpm build` — typecheck + production build succeed.
- [ ] Run `pnpm dev` and walk through: profile menu (in/out/sign-out), interactive detail heart + count, owner-only Edit, unified search + Ask AI + collapsible filters, animated hero with reduced-motion.
- [ ] Confirm `grep -rn "AiSuggestBox\|SearchBar" app components lib` returns nothing.

## Self-review notes (coverage)

- Spec §1 Profile menu → Tasks 4, 5.
- Spec §2 Favorite=like + count fix → Tasks 1 (backend), 2 (detail UI).
- Spec §3 Unified search + collapsible filters → Task 6.
- Spec §4 Hero background → Task 7.
- Spec §5 Edit entry point → Task 3.
- Spec §6 Seed 12 trips → Task 8.
- No new AWS resources / Terraform changes (matches spec "Out of scope").
