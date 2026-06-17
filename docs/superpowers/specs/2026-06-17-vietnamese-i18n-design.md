# Design: Vietnamese language support (English + Vietnamese)

**Date:** 2026-06-17
**Status:** Approved (design); pending implementation plan
**Author:** Huy Nguyen (with Claude Code)

## Goal

Make the road-rash web app bilingual: **English (`en`, default)** and **Vietnamese (`vi`)**.
Internationalize the **UI chrome only** — navigation, buttons, landing-page copy, form
labels, empty states, modals, metadata. **Trip data is user-supplied and is NOT
translated** (names, descriptions, locations, etc. are stored as entered by the user).

## Decisions (locked during brainstorming)

| Decision | Choice |
| --- | --- |
| Library | **next-intl** (de-facto App Router i18n standard; supports Next.js 16) |
| URL strategy | **Locale-prefixed paths** — `/en/discover`, `/vi/discover`, `/vi/trip/abc123` |
| Default / fallback locale | **English** |
| First-visit detection | **Auto-detect** from `Accept-Language` (Vietnamese browsers → `/vi`, else `/en`); switcher choice persisted in a cookie and overrides detection thereafter |
| Translation copy | **Claude drafts both `en.json` (extracted) and `vi.json` (Vietnamese)** for the entire app; user reviews wording before merge |
| Switcher placement | `AppHeader` (EN \| VI), preserving the current path |

## Why next-intl + locale prefixes

- App Router removed the built-in i18n routing that existed in the Pages Router; the
  official recommendation is a third-party library, and next-intl is the most widely
  used and best-documented for the App Router.
- This is a **public, SSR browsing app**, so locale-prefixed URLs give real SEO value
  (`hreflang` alternates, indexable per-language pages) and make Vietnamese links
  directly shareable.

## Architecture

### Route restructure

All routes move under an `app/[locale]/` segment:

```
app/
  [locale]/
    layout.tsx        # NextIntlClientProvider, <html lang={locale}>, fonts, providers
    page.tsx          # landing
    discover/page.tsx
    saved/page.tsx
    my-trips/page.tsx
    login/page.tsx
    trip/[id]/page.tsx
    trips/new/page.tsx
    trips/[id]/edit/page.tsx
  layout.tsx          # thin root passthrough (or removed if not needed)
i18n/
  routing.ts          # defineRouting: locales ["en","vi"], defaultLocale "en"
  request.ts          # getRequestConfig: per-request message loading + locale resolution
  navigation.ts       # createNavigation: locale-aware Link/useRouter/usePathname/redirect
messages/
  en.json             # all UI strings, extracted, namespaced
  vi.json             # Vietnamese drafts (user-reviewed)
middleware.ts         # next-intl middleware: detection + locale routing
```

### Message organization

`en.json` / `vi.json` organized by namespace, e.g.:
`common`, `nav`, `landing` (`hero`, `howItWorks`, `featureHighlights`, `cta`),
`header`, `footer`, `userMenu`, `trip` (card + detail + modal),
`forms` (new/edit trip), `search`/`filters`, `empty`, `auth`/`login`, `metadata`.

Server Components read strings via `getTranslations()`; Client Components via
`useTranslations()`. Messages are passed to the client through
`NextIntlClientProvider` in `app/[locale]/layout.tsx`.

### Navigation rewiring

The **15 files** currently importing `next/link` / `next/navigation` switch to
next-intl's locale-aware wrappers from `@/i18n/navigation` so links auto-prefix the
active locale and the switcher can preserve paths:

`app/saved/page.tsx`, `app/trip/[id]/page.tsx`, `app/trips/new/page.tsx`,
`app/trips/[id]/edit/page.tsx`, `app/my-trips/page.tsx`, `components/TripDetail.tsx`,
`components/AppLogo.tsx`, `components/TripCard.tsx`, `components/UserMenu.tsx`,
`components/TripForm.tsx`, `components/FeaturedRoutes.tsx`, `components/LandingHero.tsx`,
`components/LandingCta.tsx`, `components/AppHeader.tsx`, `components/AppFooter.tsx`.

### Language switcher

Small EN | VI control in `AppHeader`. Uses next-intl `useRouter` + `usePathname` to
re-route to the same path under the other locale; the selection persists via the
next-intl cookie so it survives reloads and overrides Accept-Language detection.

### SEO & metadata

- `generateMetadata` per locale (translated title/description).
- `hreflang` alternates linking `/en` ↔ `/vi`.
- `generateStaticParams` returning both locales; use `setRequestLocale` to keep pages
  statically renderable where applicable.

## Codebase-specific risks (handle + verify)

1. **OAuth redirect through the locale middleware.** Cognito redirect lands on `/`.
   After the restructure, the next-intl middleware will 307-redirect `/?code=...` →
   `/<locale>?code=...`. The `aws-amplify/auth/enable-oauth-listener` side-effect
   import in `ConfigureAmplifyClientSide` must still run on the resolved page so the
   `?code=` is exchanged for tokens. **Verify the query string survives the redirect
   and sign-in completes end-to-end.** This may require:
   - confirming the next-intl middleware `matcher` does not strip the OAuth params, and
   - a Cognito callback-allowlist update in the **`staging` GitHub Environment vars**
     (per the staging allowlist convention) if the effective callback URL changes.
     Any such infra/allowlist change is **flagged for the user, not made silently**.

2. **Vietnamese diacritics in the font.** `app/layout.tsx` loads Geist with
   `subsets: ["latin"]` only. Add `"vietnamese"` to both `Geist` and `Geist_Mono`
   subsets so characters like ậ/ữ/ỗ/ặ render correctly.

## Testing & verification

- Vitest component tests that touch next-intl hooks get wrapped in
  `NextIntlClientProvider` (with a minimal messages fixture). Pure `lib/` logic tests
  (`search`, `validation`, etc.) are unaffected — trip data isn't translated.
- Gate before pushing (per CI): `pnpm build` (includes `tsc`), `pnpm lint`,
  `pnpm format:check`, `pnpm test`.
- Manual smoke: visit `/`, confirm redirect to `/en` (and `/vi` with a `vi`
  Accept-Language), toggle the switcher on several pages, and complete a Google
  sign-in to confirm the OAuth flow still works through the locale middleware.

## Out of scope

- Translating user-generated trip content.
- Additional locales beyond `en`/`vi`.
- Localizing number/date/currency formatting beyond what next-intl provides by default
  (can be added later if a real need appears).
- Any backend/Lambda/DynamoDB changes — this is a frontend-only change.

## Affected areas summary

- **New:** `i18n/*`, `messages/*`, `middleware.ts`, `app/[locale]/*`.
- **Modified:** root layout (fonts + provider split), the 15 navigation files, header
  (switcher), components/pages with hardcoded copy, affected tests, `next.config.ts`
  (next-intl plugin), `package.json` (add `next-intl`).
- **Possibly flagged:** `staging` GitHub Environment Cognito callback allowlist.
