# Vietnamese Language Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the road-rash web app bilingual (English default + Vietnamese) by internationalizing all UI chrome with locale-prefixed routing.

**Architecture:** Use `next-intl` with locale-prefixed paths (`/en/...`, `/vi/...`). All routes move under an `app/[locale]/` segment. Middleware detects locale from `Accept-Language` (fallback `en`) and persists the user's switcher choice in a cookie. Trip data is user-supplied and is **not** translated — only UI strings (`messages/{en,vi}.json`).

**Tech Stack:** Next.js 16.2.7 (App Router, SSR), React 19, `next-intl`, TypeScript, Tailwind v4, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-17-vietnamese-i18n-design.md`

---

## File Structure

**New files:**
- `i18n/routing.ts` — locale list + default; single source of truth for locales.
- `i18n/navigation.ts` — locale-aware `Link`, `useRouter`, `usePathname`, `redirect`.
- `i18n/request.ts` — per-request locale resolution + message loading.
- `middleware.ts` — next-intl middleware (detection + routing).
- `messages/en.json` — all UI strings (extracted), namespaced.
- `messages/vi.json` — Vietnamese translations, same key shape.
- `app/[locale]/layout.tsx` — root `<html>`/`<body>`, fonts, providers, `NextIntlClientProvider`.
- `components/LanguageSwitcher.tsx` — EN | VI control.
- `lib/test-utils.tsx` — `renderWithIntl` helper wrapping `NextIntlClientProvider`.

**Moved (into `app/[locale]/`):** `page.tsx`, `globals.css` import stays in layout, `discover/`, `saved/`, `my-trips/`, `login/`, `trip/[id]/`, `trips/new/`, `trips/[id]/edit/`.

**Deleted:** `app/layout.tsx` (its responsibilities move to `app/[locale]/layout.tsx`).

**Modified:** `next.config.ts` (next-intl plugin), `package.json` (dep), the 15 navigation files, components/pages with hardcoded copy, affected `*.test.ts(x)`.

---

## Task 1: Install next-intl and scaffold i18n config

**Files:**
- Modify: `package.json` (add dependency)
- Create: `i18n/routing.ts`, `i18n/navigation.ts`, `i18n/request.ts`, `middleware.ts`
- Modify: `next.config.ts`
- Create: `messages/en.json`, `messages/vi.json` (minimal seed)

- [ ] **Step 1: Install next-intl**

Run:
```bash
pnpm add next-intl
```
Expected: `next-intl` appears under `dependencies` in `package.json`; lockfile updates.

- [ ] **Step 2: Create `i18n/routing.ts`**

```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
});
```

- [ ] **Step 3: Create `i18n/navigation.ts`**

```typescript
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware drop-in replacements for next/link and next/navigation.
// Importing from here keeps the active locale prefix on every link/redirect.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 4: Create `i18n/request.ts`**

```typescript
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Create `middleware.ts` at repo root**

```typescript
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, and any path with a file extension.
  // Everything else (incl. "/") is locale-routed, so /?code=... -> /en?code=...
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 6: Wire the next-intl plugin in `next.config.ts`**

Replace the file contents with:
```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Seed `messages/en.json` and `messages/vi.json`**

`messages/en.json`:
```json
{
  "common": {
    "appName": "Road Rash"
  }
}
```
`messages/vi.json`:
```json
{
  "common": {
    "appName": "Road Rash"
  }
}
```

- [ ] **Step 8: Typecheck (will still fail to build until routes move — that is expected)**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: No errors from the new `i18n/*` or `middleware.ts` files. (Existing app may still typecheck fine since routes are untouched yet.) If `tsc` reports an error inside `i18n/*`, fix it before continuing.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml i18n middleware.ts next.config.ts messages
git commit -m "feat(i18n): scaffold next-intl config, middleware, and message files"
```

---

## Task 2: Restructure routes under `app/[locale]/` and migrate the root layout

This is the structural cutover. After this task the site serves `/en/...` and `/vi/...` and `/` redirects to a locale.

**Files:**
- Move: every entry under `app/` except `globals.css`, `icon.svg`, and `layout.tsx` → `app/[locale]/`
- Create: `app/[locale]/layout.tsx`
- Delete: `app/layout.tsx`

- [ ] **Step 1: Create the `[locale]` directory and move routes**

Run:
```bash
cd app
mkdir -p "[locale]"
git mv page.tsx "[locale]/page.tsx"
git mv discover "[locale]/discover"
git mv saved "[locale]/saved"
git mv my-trips "[locale]/my-trips"
git mv login "[locale]/login"
git mv trip "[locale]/trip"
git mv trips "[locale]/trips"
cd ..
```
Expected: `app/[locale]/` now contains `page.tsx`, `discover/`, `saved/`, `my-trips/`, `login/`, `trip/`, `trips/`. `app/globals.css`, `app/icon.svg`, and `app/layout.tsx` remain at `app/`.

- [ ] **Step 2: Create `app/[locale]/layout.tsx`** (moves all root-layout responsibilities here, adds the Vietnamese font subset + the intl provider)

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import "../globals.css";
import { routing } from "@/i18n/routing";
import ConfigureAmplifyClientSide from "@/components/ConfigureAmplifyClientSide";
import GsapProvider from "@/components/GsapProvider";
import FavoritesProvider from "@/components/FavoritesProvider";
import ThemeProvider from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  // "vietnamese" subset is required for diacritics like ậ/ữ/ỗ/ặ to render.
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Road Rash",
  description:
    "Discover, save, and share road trip routes with maps and AI suggestions.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <ConfigureAmplifyClientSide />
        <GsapProvider />
        <NextIntlClientProvider>
          <ThemeProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Delete the old root layout**

Run:
```bash
git rm app/layout.tsx
```
Expected: `app/layout.tsx` removed. (`app/[locale]/layout.tsx` is now the only layout with `<html>`/`<body>`.)

- [ ] **Step 4: Build to confirm the cutover compiles**

Run:
```bash
pnpm build
```
Expected: PASS. Routes are emitted under `/[locale]/...`. If the build complains that pages reference `next/navigation` types — that is fixed in Task 3; for now the build should still pass because `next/navigation` and `next/link` remain valid imports. If it fails for any other reason, fix before continuing.

- [ ] **Step 5: Manual smoke — locale redirect**

Run `pnpm dev`, then in a browser:
- Visit `http://localhost:3000/` → expect a redirect to `http://localhost:3000/en`.
- Visit `http://localhost:3000/vi` → page renders (still English copy — translation comes later).
- Send `Accept-Language: vi` (e.g. `curl -s -o /dev/null -w "%{redirect_url}\n" -H "Accept-Language: vi" http://localhost:3000/`) → expect `/vi`.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(i18n): move routes under [locale] segment and migrate root layout"
```

---

## Task 3: Rewire navigation imports to the locale-aware wrappers

Swap `next/link` and `next/navigation` for `@/i18n/navigation` in all 15 files so links/redirects keep the active locale prefix. `href` values stay locale-free (e.g. `"/saved"`); the wrapper adds the prefix.

**Files (modify each):**
`app/[locale]/saved/page.tsx`, `app/[locale]/trip/[id]/page.tsx`, `app/[locale]/trips/new/page.tsx`, `app/[locale]/trips/[id]/edit/page.tsx`, `app/[locale]/my-trips/page.tsx`, `components/TripDetail.tsx`, `components/AppLogo.tsx`, `components/TripCard.tsx`, `components/UserMenu.tsx`, `components/TripForm.tsx`, `components/FeaturedRoutes.tsx`, `components/LandingHero.tsx`, `components/LandingCta.tsx`, `components/AppHeader.tsx`, `components/AppFooter.tsx`

- [ ] **Step 1: Replace `next/link` imports**

In every file above that has `import Link from "next/link";`, change it to:
```typescript
import { Link } from "@/i18n/navigation";
```

- [ ] **Step 2: Replace `next/navigation` runtime imports**

In every file that imports `usePathname`, `useRouter`, and/or `redirect` from `next/navigation`, import them from `@/i18n/navigation` instead. Example (AppHeader.tsx line 5):
```typescript
// before
import { usePathname, useRouter } from "next/navigation";
// after
import { usePathname, useRouter } from "@/i18n/navigation";
```

**Important exceptions — keep these from `next/navigation`** (they are not re-exported by next-intl): `notFound`, `useParams`, `useSearchParams`, `useSelectedLayoutSegment(s)`. If a file imports a mix, split the import so only `Link`/`useRouter`/`usePathname`/`redirect` come from `@/i18n/navigation` and the rest stay on `next/navigation`.

- [ ] **Step 3: Audit for stragglers**

Run:
```bash
grep -rn "next/link" app components
grep -rn 'from "next/navigation"' app components
```
Expected: `next/link` returns nothing. `next/navigation` only returns lines importing the exceptions listed in Step 2.

- [ ] **Step 4: Verify the `router.replace("/")` sign-out calls**

In `components/AppHeader.tsx` (~line 94) and `components/UserMenu.tsx` (~line 143), `router.replace("/")` now goes through the locale-aware router, so it lands on the current locale's home. Confirm those calls are unchanged in argument (`"/"`) — the wrapper handles the prefix. No edit needed unless the build flags a type error.

- [ ] **Step 5: Build + typecheck**

Run:
```bash
pnpm build
```
Expected: PASS.

- [ ] **Step 6: Manual smoke — links stay in-locale**

`pnpm dev`, visit `/vi`, click around (logo, footer links). Every navigation should stay under `/vi/...`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(i18n): route links/navigation through locale-aware wrappers"
```

---

## Task 4: Extract and translate UI strings (by surface)

Each sub-task: add keys to **both** `messages/en.json` and `messages/vi.json` under a namespace, then replace the hardcoded strings in the named files with `useTranslations("<ns>")` (Client Components) or `getTranslations("<ns>")` (Server Components). Keep the **same key shape** in both files. After each sub-task, run `pnpm build` (expect PASS) and commit.

> **Pattern — Client Component:**
> ```tsx
> "use client";
> import { useTranslations } from "next-intl";
> // ...
> const t = useTranslations("header");
> // <Link ...>Sign in</Link>  ->  <Link ...>{t("signIn")}</Link>
> ```
> **Pattern — Server Component (async):**
> ```tsx
> import { getTranslations } from "next-intl/server";
> const t = await getTranslations("footer");
> ```
> For arrays of label/href objects (e.g. `ACCOUNT_LINKS`), keep the `href` in the array and look up the label via `t(item.key)` using an added `key` field.

### Task 4a: Header, footer, logo, user menu

**Files:** `components/AppHeader.tsx`, `components/AppFooter.tsx`, `components/UserMenu.tsx`, `components/AppLogo.tsx`

- [ ] **Step 1: Add message keys** (append to existing JSON; real strings shown)

To `messages/en.json`:
```json
{
  "header": {
    "signIn": "Sign in",
    "createTrip": "Create trip",
    "signOut": "Sign out",
    "openMenu": "Open menu",
    "closeMenu": "Close menu",
    "savedTrips": "Liked trips",
    "myTrips": "My trips"
  },
  "footer": {
    "discover": "Discover",
    "saved": "Saved",
    "myTrips": "My trips",
    "createTrip": "Create trip",
    "disclaimer": "Road Rash routes and Google My Maps links are user supplied. Verify road conditions, access rules, and safety details before you travel."
  },
  "userMenu": {
    "createTrip": "Create trip",
    "savedTrips": "Liked trips",
    "myTrips": "My trips",
    "signOut": "Sign out",
    "accountMenu": "Account menu"
  }
}
```

To `messages/vi.json`:
```json
{
  "header": {
    "signIn": "Đăng nhập",
    "createTrip": "Tạo hành trình",
    "signOut": "Đăng xuất",
    "openMenu": "Mở menu",
    "closeMenu": "Đóng menu",
    "savedTrips": "Hành trình đã thích",
    "myTrips": "Hành trình của tôi"
  },
  "footer": {
    "discover": "Khám phá",
    "saved": "Đã lưu",
    "myTrips": "Hành trình của tôi",
    "createTrip": "Tạo hành trình",
    "disclaimer": "Các tuyến đường Road Rash và liên kết Google My Maps do người dùng cung cấp. Hãy kiểm tra tình trạng đường, quy định ra vào và thông tin an toàn trước khi đi."
  },
  "userMenu": {
    "createTrip": "Tạo hành trình",
    "savedTrips": "Hành trình đã thích",
    "myTrips": "Hành trình của tôi",
    "signOut": "Đăng xuất",
    "accountMenu": "Menu tài khoản"
  }
}
```

- [ ] **Step 2: Replace strings in `AppHeader.tsx`**

Add `import { useTranslations } from "next-intl";` and `const t = useTranslations("header");` inside the component. Then:
- `ACCOUNT_LINKS` → add a `key`: `[{ href: "/saved", key: "savedTrips" }, { href: "/my-trips", key: "myTrips" }]`; render `{t(item.key)}`.
- `"Sign in"` → `{t("signIn")}` (both desktop and mobile).
- `"Create trip"` → `{t("createTrip")}`.
- `"Sign out"` → `{t("signOut")}`.
- `aria-label={menuOpen ? "Close menu" : "Open menu"}` → `t("closeMenu")` / `t("openMenu")`.

- [ ] **Step 3: Replace strings in `AppFooter.tsx`**

This is a Server Component. Make the function `async`, add `import { getTranslations } from "next-intl/server";` and `const t = await getTranslations("footer");`. Add `key` to `FOOTER_LINKS` (`{ href: "/", key: "discover" }`, etc.), render `{t(item.key)}`, and replace the disclaimer `<p>` text with `{t("disclaimer")}`.

- [ ] **Step 4: Replace strings in `UserMenu.tsx`**

Add `const t = useTranslations("userMenu");`. Add `key` to `MENU_LINKS` items, render `{t(item.key)}`. Replace `aria-label="Account menu"` → `aria-label={t("accountMenu")}` and the trailing `Sign out` button text → `{t("signOut")}`.

- [ ] **Step 5: Replace strings in `AppLogo.tsx`**

Read the file; if it renders the literal `"Road Rash"` wordmark, leave it as-is (brand name, not translated) unless it has an `aria-label` or tagline — translate only those via the `common`/`header` namespace. If there are no translatable strings, no change.

- [ ] **Step 6: Build + commit**

```bash
pnpm build && git add -A && git commit -m "feat(i18n): translate header, footer, and account menu"
```
Expected build: PASS.

### Task 4b: Landing page (hero, how-it-works, feature highlights, CTA, featured routes)

**Files:** `components/LandingHero.tsx`, `components/HowItWorks.tsx`, `components/FeatureHighlights.tsx`, `components/LandingCta.tsx`, `components/FeaturedRoutes.tsx`, and `app/[locale]/page.tsx` if it holds copy.

- [ ] **Step 1: Read each file and list every user-visible string** (headings, paragraphs, button labels, `aria-label`s, image `alt` text).

- [ ] **Step 2: Add a `landing` namespace to both message files**

Use sub-objects per component, e.g.:
```json
{
  "landing": {
    "hero": { "title": "…", "subtitle": "…", "ctaPrimary": "…", "ctaSecondary": "…" },
    "howItWorks": { "title": "…", "steps": ["…", "…", "…"] },
    "featureHighlights": { "title": "…", "items": [{ "title": "…", "body": "…" }] },
    "cta": { "title": "…", "body": "…", "button": "…" }
  }
}
```
Populate `en` with the exact current copy and `vi` with the Vietnamese translation (same shape). For ordered lists, use `t.raw("steps")` to read arrays.

- [ ] **Step 3: Replace strings in each component** using `useTranslations("landing.hero")`, `useTranslations("landing.howItWorks")`, etc. For arrays: `const steps = t.raw("steps") as string[];` then map.

- [ ] **Step 4: Build + commit**

```bash
pnpm build && git add -A && git commit -m "feat(i18n): translate landing page sections"
```

### Task 4c: Trip browsing — search, filters, cards, empty states, load-more

**Files:** `components/TripBrowser.tsx`, `components/SearchPill.tsx`, `components/FilterControls.tsx`, `components/TripCard.tsx`, `components/TripGrid.tsx`, `components/EmptyState.tsx`, `components/LoadMoreIndicator.tsx`

- [ ] **Step 1:** Read each file; collect visible strings including placeholders, `aria-label`s, the AI-search button text, filter option labels, and empty-state messages.

- [ ] **Step 2:** Add a `search` namespace and an `empty` namespace to both message files with the exact `en` copy and `vi` translations.

> **Filter option labels:** filter *values* that map to stored trip data (e.g. `tripType`, `vehicle` enum values) are domain data — translate only the **display label**, never the value sent to the API in `GET /trips` query params. Keep the value→label mapping in the component; translate the label via `t`.

- [ ] **Step 3:** Replace strings via `useTranslations("search")` / `useTranslations("empty")`.

- [ ] **Step 4: Build + commit**

```bash
pnpm build && git add -A && git commit -m "feat(i18n): translate search, filters, cards, and empty states"
```

### Task 4d: Trip detail + modal

**Files:** `components/TripDetail.tsx`, `components/TripDetailModal.tsx`

- [ ] **Step 1:** Read both files; collect visible strings (section headings like "Map", "Open in Google Maps", favorite button `aria-label`s, close-button labels). Do **not** translate trip-supplied fields (name/description/location).

- [ ] **Step 2:** Add a `trip` namespace to both message files (`en` exact, `vi` translated).

- [ ] **Step 3:** Replace strings via `useTranslations("trip")`.

- [ ] **Step 4: Build + commit**

```bash
pnpm build && git add -A && git commit -m "feat(i18n): translate trip detail and modal chrome"
```

### Task 4e: Trip forms (create/edit)

**Files:** `components/TripForm.tsx`, `app/[locale]/trips/new/page.tsx`, `app/[locale]/trips/[id]/edit/page.tsx`, and `lib/validation.ts` if it returns user-facing message strings.

- [ ] **Step 1:** Read the form; collect labels, placeholders, helper text, submit/cancel button text, and **validation error messages**.

- [ ] **Step 2:** Add a `forms` namespace to both message files. Include a `forms.errors` sub-object for validation messages.

> **Validation messages:** `lib/validation.ts` is pure logic with unit tests (`lib/validation.test.ts`) and may run server-side helpers too. Do **not** import `next-intl` hooks into it. Keep `validation.ts` returning stable **error codes/keys** (e.g. `"mapUrlInvalid"`), and translate them at the component boundary via `t(`errors.${code}`)`. If `validation.ts` currently returns human strings, change it to return codes and update `lib/validation.test.ts` to assert on codes.

- [ ] **Step 3:** Replace strings in `TripForm.tsx` via `useTranslations("forms")`; map validation codes to messages at render time.

- [ ] **Step 4:** If `validation.ts` was changed to return codes, run `pnpm test lib/validation.test.ts`.
Expected: PASS (after updating assertions to codes).

- [ ] **Step 5: Build + commit**

```bash
pnpm build && git add -A && git commit -m "feat(i18n): translate trip create/edit form and validation messages"
```

### Task 4f: Login/auth page, remaining pages, page metadata

**Files:** `app/[locale]/login/page.tsx`, `app/[locale]/saved/page.tsx`, `app/[locale]/my-trips/page.tsx`, `app/[locale]/discover/page.tsx`, `app/[locale]/trip/[id]/page.tsx`

- [ ] **Step 1:** Read each page; collect headings, the Google sign-in button text, and any inline copy.

- [ ] **Step 2:** Add an `auth` namespace and a `pages` namespace (per-page headings) to both message files.

- [ ] **Step 3:** Replace strings via `getTranslations(...)` (these are Server Components) / `useTranslations(...)` for any client islands.

- [ ] **Step 4: Final string audit**

Run:
```bash
grep -rnE '>[A-Z][a-z]+ [a-z]' app components | grep -v "t(" | grep -vE "className|aria-|//"
```
Review hits for any remaining hardcoded English UI copy (ignore brand name "Road Rash", trip-data bindings, and comments). Extract any stragglers found.

- [ ] **Step 5: Build + commit**

```bash
pnpm build && git add -A && git commit -m "feat(i18n): translate auth/login and remaining page copy"
```

---

## Task 5: Language switcher

**Files:**
- Create: `components/LanguageSwitcher.tsx`
- Modify: `components/AppHeader.tsx` (mount it on desktop + mobile)
- Add keys: `messages/en.json`, `messages/vi.json`

- [ ] **Step 1: Add switcher labels**

To `messages/en.json`:
```json
{ "languageSwitcher": { "label": "Language", "en": "EN", "vi": "VI" } }
```
To `messages/vi.json`:
```json
{ "languageSwitcher": { "label": "Ngôn ngữ", "en": "EN", "vi": "VI" } }
```

- [ ] **Step 2: Create `components/LanguageSwitcher.tsx`**

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Switches locale while preserving the current path. next-intl's locale-aware
// router re-routes the same pathname under the chosen locale and persists the
// choice in the NEXT_LOCALE cookie, so it survives reloads and overrides
// Accept-Language detection on the next visit.
export default function LanguageSwitcher({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-current={loc === locale ? "true" : undefined}
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            loc === locale
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Mount in `AppHeader.tsx`**

Import it (`import LanguageSwitcher from "@/components/LanguageSwitcher";`) and render it next to `ModeToggle` in both the desktop cluster (line ~107 `<div className="hidden items-center gap-3 lg:flex">`) and the mobile menu's mode-toggle row (line ~155).

- [ ] **Step 4: Build**

Run:
```bash
pnpm build
```
Expected: PASS.

- [ ] **Step 5: Manual smoke**

`pnpm dev`, open `/en/discover`, click `VI` → URL becomes `/vi/discover`, UI copy switches to Vietnamese, the rest of the path is preserved. Reload → stays Vietnamese (cookie). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(i18n): add EN/VI language switcher to the header"
```

---

## Task 6: Per-locale metadata + hreflang

**Files:**
- Modify: `app/[locale]/layout.tsx` (replace static `metadata` with `generateMetadata`)
- Add keys: `messages/en.json`, `messages/vi.json` (`metadata` namespace)

- [ ] **Step 1: Add metadata strings**

To `messages/en.json`:
```json
{
  "metadata": {
    "title": "Road Rash",
    "description": "Discover, save, and share road trip routes with maps and AI suggestions."
  }
}
```
To `messages/vi.json`:
```json
{
  "metadata": {
    "title": "Road Rash",
    "description": "Khám phá, lưu và chia sẻ các tuyến đường du lịch với bản đồ và gợi ý từ AI."
  }
}
```

- [ ] **Step 2: Replace static `metadata` with `generateMetadata` in `app/[locale]/layout.tsx`**

Remove the `export const metadata = …` block and add:
```tsx
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      languages: {
        en: "/en",
        vi: "/vi",
        "x-default": "/en",
      },
    },
  };
}
```

- [ ] **Step 3: Build**

Run:
```bash
pnpm build
```
Expected: PASS.

- [ ] **Step 4: Verify hreflang + lang in output**

`pnpm dev`, then:
```bash
curl -s http://localhost:3000/vi | grep -o '<html[^>]*lang="vi"' | head -1
curl -s http://localhost:3000/en | grep -o 'hreflang="vi"' | head -1
```
Expected: first command prints the `lang="vi"` html tag; second prints an `hreflang="vi"` alternate link. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(i18n): per-locale metadata and hreflang alternates"
```

---

## Task 7: Test harness for next-intl + fix affected tests

Component tests that mount anything using `useTranslations`/`useLocale` need a `NextIntlClientProvider`. Pure `lib/` logic tests (search, trending, motion, avatar, utils) are unaffected.

**Files:**
- Create: `lib/test-utils.tsx`
- Modify: any `*.test.tsx` that renders a component using next-intl hooks (and `lib/validation.test.ts` if changed in Task 4e)

- [ ] **Step 1: Create `lib/test-utils.tsx`**

```tsx
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

// Wrap components under test in the intl provider using the real English
// messages, so assertions can match the actual rendered copy.
export function renderWithIntl(ui: React.ReactNode, locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}
```

- [ ] **Step 2: Confirm the test renderer dependency exists**

Run:
```bash
grep -E "testing-library/react|happy-dom|jsdom" package.json || echo "MISSING"
```
If `@testing-library/react` and a DOM environment (`jsdom` or `happy-dom`) are absent AND there are no existing component (`.test.tsx`) tests, **skip creating `test-utils.tsx`** and component tests — the project tests logic only. In that case, document the switcher/middleware as manual-smoke-only and proceed to Task 8. If they are present, continue.

- [ ] **Step 3: Run the full suite to find breakage**

Run:
```bash
pnpm test
```
Expected: Note any failures caused by missing intl context ("No intl context found" / "useTranslations" errors).

- [ ] **Step 4: Fix each failing component test**

For each failure, swap its `render(<Component/>)` for `renderWithIntl(<Component/>)` from `@/lib/test-utils`. Update any assertion that matched a hardcoded string to match the value from `messages/en.json`.

- [ ] **Step 5: Re-run tests**

Run:
```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "test(i18n): add intl render helper and fix affected tests"
```

---

## Task 8: Full verification + OAuth smoke

- [ ] **Step 1: Run the full CI gate locally**

Run:
```bash
pnpm format:check && pnpm lint && pnpm build && pnpm test
```
Expected: all PASS. If `format:check` fails, run `pnpm exec prettier --write .` then re-run.

- [ ] **Step 2: Vietnamese diacritics render**

`pnpm dev`, open `/vi` and visually confirm Vietnamese text with diacritics (ậ/ữ/ỗ/ặ) renders correctly (no tofu/boxes), confirming the `vietnamese` font subset works.

- [ ] **Step 3: OAuth flow through the locale middleware**

Still on `pnpm dev` (or staging after deploy): start a Google sign-in. The redirect lands on `/?code=...` and the middleware forwards it to `/<locale>?code=...`. Confirm:
- the `?code=...` query is preserved through the redirect, and
- sign-in completes (avatar appears, `UserMenu` renders) without a manual reload.

If the code is dropped, verify `middleware.ts` `matcher` does not exclude `/` and that `ConfigureAmplifyClientSide` (with `enable-oauth-listener`) still mounts in `app/[locale]/layout.tsx`. **Flag any required Cognito callback-URL allowlist change** (in the `staging` GitHub Environment vars) to the user — do not change infra silently.

- [ ] **Step 4: Update docs**

In `CLAUDE.md`, add a short note under "What this project is" that the app is bilingual (en/vi) via next-intl with locale-prefixed routing and `messages/{en,vi}.json`. Mark the i18n work in the plan/status docs if applicable.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs(i18n): note bilingual support in project docs"
```

- [ ] **Step 6: Open the PR**

Run:
```bash
git push -u origin feature/i18n-vietnamese
gh pr create --title "feat: Vietnamese language support (en/vi)" --body "Adds bilingual support via next-intl with locale-prefixed routing. See docs/superpowers/specs/2026-06-17-vietnamese-i18n-design.md. UI chrome is translated; trip data stays user-supplied. Reviewer: please review Vietnamese wording in messages/vi.json.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Notes for the implementer

- **Vietnamese wording in `vi.json` is drafted by the implementer and must be reviewed by the user** before merge (the user is a native speaker). Flag the file for review in the PR.
- **Never translate trip-supplied data** (name, description, location, city, province, country) or the enum **values** used in `GET /trips` query params — only their display labels.
- Keep `en.json` and `vi.json` **structurally identical** (same keys, same nesting). A missing key falls back to the default locale and logs a dev warning.
- `href`s passed to the locale-aware `Link`/`router` stay **locale-free** (`"/saved"`, not `"/en/saved"`); the wrapper adds the prefix.
