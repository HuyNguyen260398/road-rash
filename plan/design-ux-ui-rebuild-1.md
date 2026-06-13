---
goal: Rebuild the Road Rash UX/UI using the shadcn Ink template as the visual reference
version: 1.0
date_created: 2026-06-13
last_updated: 2026-06-13
owner: Road Rash
status: 'Planned'
tags:
  - design
  - ui
  - ux
  - nextjs
  - shadcn
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan rebuilds all current Road Rash app surfaces with a coherent Travel-App Hybrid design inspired by `/Users/huyng/ws/shadcn-nextjs-ink-landing-page-2.0.0/`. The implementation keeps the existing Next.js App Router, API client, AWS Amplify auth flow, Lambda contracts, and data models unchanged while replacing the current minimal UI with a token-driven shadcn-style component system, branded app shell, improved trip discovery, richer trip cards, polished forms, and consistent empty/error states.

Each task in this plan must be completed in its own commit. Do not combine task commits.

## 1. Requirements & Constraints

- **REQ-001**: Apply the selected Travel-App Hybrid direction across all current app surfaces: `/`, `/saved`, `/my-trips`, `/trips/new`, `/trips/[id]/edit`, `/trip/[id]`, `/login`, trip modal, trip cards, filters, AI suggestion box, forms, empty states, and error states.
- **REQ-002**: Preserve all current product behavior, route paths, auth redirects, server/client data flow, API method calls, form validation rules, favorite toggling behavior, AI fallback behavior, and Google My Maps embedding behavior.
- **REQ-003**: Use the Ink template as the visual reference for structure: semantic design tokens, sticky header, theme-aware surfaces, button hierarchy, muted hero bands, card grids, compact badges, footer, and consistent spacing.
- **REQ-004**: Adapt the reference design to Road Rash using a warm travel palette: adventure orange primary, map teal secondary, dark slate foreground, warm off-white background, terrain-muted surfaces, and accessible destructive red.
- **REQ-005**: Replace emoji-based structural icons with `lucide-react` icons. Emojis may not be used as icons in navigation, empty states, cards, detail metadata, map actions, or controls.
- **REQ-006**: Add reusable UI primitives instead of duplicating Tailwind class strings in feature components.
- **REQ-007**: Keep cards at `8px` radius or less unless the template primitive requires a smaller token. Avoid nested cards.
- **REQ-008**: Use icon buttons for compact actions such as favorite, menu, theme, close, and external map links where applicable, with accessible labels and visible focus states.
- **REQ-009**: Maintain responsive behavior at `375px`, `768px`, `1024px`, and `1440px` widths with no horizontal scrolling.
- **REQ-010**: Preserve server component compatibility for `EmptyState` and all page-level data loaders unless a component currently requires client hooks.
- **REQ-011**: Keep image handling with dynamic presigned S3 URLs through plain `<img>` unless `next/image` remote patterns are added in the same task.
- **REQ-012**: Every task in this plan must end with one commit using the exact task-specific commit message listed in section 2.
- **SEC-001**: Do not change My Maps URL validation, iframe URL canonicalization, or link allow-list behavior.
- **SEC-002**: Do not add code that assumes programmatic Google My Maps access.
- **SEC-003**: Do not commit `.env.local`, Terraform state, AWS credentials, Gemini keys, generated `.superpowers/` files, or local browser companion output.
- **ACC-001**: All icon-only controls must include accessible names via visible text, `aria-label`, or `sr-only` text.
- **ACC-002**: Form controls must keep visible labels, helper text, inline error messages, and `aria-invalid` where validation exists.
- **ACC-003**: Focus rings must be visible on links, buttons, inputs, selects, textareas, and modal controls.
- **ACC-004**: Text and UI controls must meet WCAG AA contrast for normal text in light and dark modes.
- **CON-001**: Use `pnpm` only. Do not use `npm`, `yarn`, or `bun`.
- **CON-002**: Node engine remains `>=24`.
- **CON-003**: Tailwind remains v4 through the existing `@import "tailwindcss"` setup.
- **CON-004**: The current package uses Next.js `16.2.7` and React `19.2.4`; do not upgrade framework packages as part of this UI plan.
- **CON-005**: Avoid broad unrelated refactors. Touch only files needed for the UX/UI rebuild and related tests.
- **PAT-001**: Follow the reference template’s component patterns from `src/components/ui/*`, `src/components/layout/header.tsx`, `src/components/layout/footer.tsx`, and `src/components/blocks/hero-section/hero-section.tsx`.
- **PAT-002**: Use named exports for shared helpers and PascalCase filenames for reusable React UI components.
- **PAT-003**: Keep tests beside the code they cover as `*.test.ts` where logic changes require tests.
- **GUD-001**: Run `pnpm lint`, `pnpm test`, and `pnpm build` before the final completion commit.

## 2. Implementation Steps

### Implementation Phase 1: Dependency and Token Foundation

- GOAL-001: Add the minimal shadcn-style foundation required by the redesign without changing product behavior.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-001 | Add UI dependencies with `pnpm add lucide-react clsx tailwind-merge class-variance-authority next-themes`. Verify `package.json` and `pnpm-lock.yaml` update only dependency metadata. Run `pnpm lint` after install. | | | `chore(ui): add shadcn design dependencies` |
| TASK-002 | Create `lib/utils.ts` with a named `cn(...inputs: ClassValue[])` helper using `clsx` and `tailwind-merge`. Add `lib/utils.test.ts` with assertions that later classes override earlier conflicting Tailwind classes and that conditional values are omitted when false. Run `pnpm test lib/utils.test.ts`. | | | `feat(ui): add class name utility` |
| TASK-003 | Replace `app/globals.css` with a token system adapted from the Ink template: import Tailwind, define `@custom-variant dark (&:is(.dark *))`, define `:root` and `.dark` variables for `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, chart tokens, sidebar tokens, `--radius: 0.5rem`, and shadow tokens. Map each variable in `@theme inline`. Add base layer rules for body, focus outlines, disabled cursor, and clickable cursor. Use warm off-white `#fff7ed`, dark slate `#0f172a`, primary orange `#ea580c`, secondary teal `#0891b2`, muted terrain `#ffedd5`, and border `#fed7aa` as the light palette. Run `pnpm lint`. | | | `style(ui): add road rash design tokens` |
| TASK-004 | Update `app/layout.tsx` metadata to `title: "Road Rash"` and `description: "Discover, save, and share road trip routes with maps and AI suggestions."`. Add `suppressHydrationWarning` to `<html>` for theme support. Wrap existing `ConfigureAmplifyClientSide` and `FavoritesProvider` with a new `ThemeProvider` from TASK-005 after that task exists; in this task only update metadata and body classes to use `bg-background text-foreground`. Run `pnpm lint`. | | | `style(app): update global app metadata and body surface` |

### Implementation Phase 2: Shared UI Primitives

- GOAL-002: Add reusable primitives matching the Ink template so feature components stop duplicating low-level Tailwind styles.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-005 | Create `components/theme-provider.tsx` as a client component that wraps `next-themes` `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `disableTransitionOnChange`. Modify `app/layout.tsx` to wrap `<FavoritesProvider>{children}</FavoritesProvider>` inside `<ThemeProvider>`. Run `pnpm lint`. | | | `feat(ui): add theme provider` |
| TASK-006 | Create `components/ui/button.tsx` using `class-variance-authority`, `Slot` behavior must not be used unless `radix-ui` is added later; export `Button` with variants `default`, `secondary`, `outline`, `ghost`, `destructive`, and sizes `sm`, `default`, `lg`, `icon`. Use `forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>>`. Run `pnpm lint`. | | | `feat(ui): add button primitive` |
| TASK-007 | Create `components/ui/card.tsx` with named exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`. Each component must forward refs. `Card` must use `rounded-lg border border-border bg-card text-card-foreground shadow-sm`; `CardHeader` must use `flex flex-col space-y-1.5 p-6`; `CardTitle` must use `text-2xl font-semibold leading-none`; `CardDescription` must use `text-sm text-muted-foreground`; `CardContent` must use `p-6 pt-0`; `CardFooter` must use `flex items-center p-6 pt-0`. Run `pnpm lint`. | | | `feat(ui): add card primitive` |
| TASK-008 | Create form primitives: `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/ui/label.tsx`, and `components/ui/badge.tsx`. Inputs/selects/textareas must use `border-input`, `bg-background`, `focus-visible:ring-ring`, `aria-invalid:border-destructive`, and `min-h-10`. Badge variants must include `default`, `secondary`, `outline`, `destructive`, and `teal`. Run `pnpm lint`. | | | `feat(ui): add form and badge primitives` |
| TASK-009 | Create `components/ui/separator.tsx` and `components/ui/skeleton.tsx`. `Separator` must support horizontal and vertical orientation through a typed `orientation` prop. `Skeleton` must render a pulsing rounded token surface and respect reduced motion through CSS class fallback only. Run `pnpm lint`. | | | `feat(ui): add separator and skeleton primitives` |

### Implementation Phase 3: App Shell and Navigation

- GOAL-003: Replace per-page ad hoc headers with one sticky branded shell based on the Ink template.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-010 | Create `components/AppLogo.tsx` with a non-emoji route icon using `MapIcon` or `RouteIcon` from `lucide-react`, the text `Road Rash`, and a small `beta` or `routes` badge using `Badge`. Link logo to `/`. Run `pnpm lint`. | | | `feat(shell): add road rash logo` |
| TASK-011 | Create `components/ModeToggle.tsx` as a client component using `useTheme` from `next-themes`, `SunIcon`, `MoonIcon`, and `LaptopIcon` from `lucide-react`. Render three accessible `Button` controls or a compact segmented control for `light`, `dark`, and `system`. Run `pnpm lint`. | | | `feat(shell): add theme mode toggle` |
| TASK-012 | Create `components/AppHeader.tsx` as a client component with sticky top navigation based on the Ink header: logo, desktop links for `Discover`, `Saved`, `My trips`, an outline `Sign in` link to `/login`, a primary `Create trip` link to `/trips/new`, `ModeToggle`, and a mobile menu button with `MenuIcon`. The mobile menu may use a simple stateful dropdown panel; it must close when a link is clicked and expose `aria-expanded`. Run `pnpm lint`. | | | `feat(shell): add responsive app header` |
| TASK-013 | Create `components/AppFooter.tsx` with a compact footer containing brand text, links to `Discover`, `Saved`, `My trips`, `Create trip`, and a note that maps are user supplied. Use `Separator` above the footer. Run `pnpm lint`. | | | `feat(shell): add app footer` |
| TASK-014 | Create `components/AppShell.tsx` as a server-compatible wrapper that renders `AppHeader`, `<main id="main-content" className="flex-1">`, children, and `AppFooter`. Add a skip link to `#main-content`. Modify `app/page.tsx`, `app/saved/page.tsx`, `app/my-trips/page.tsx`, `app/trips/new/page.tsx`, `app/trips/[id]/edit/page.tsx`, `app/trip/[id]/page.tsx`, and `app/login/page.tsx` to remove local top-level nav/header duplication where the shell replaces it. Run `pnpm lint`. | | | `feat(shell): apply shared app shell` |

### Implementation Phase 4: Discovery and Search Experience

- GOAL-004: Rebuild the public discover flow around travel discovery, AI prompt prominence, and polished filter controls.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-015 | Create `components/DiscoverHero.tsx` as a server component accepting `{ tripCount: number }`. Use a muted warm band, centered/left hybrid layout, a `Badge` reading `Community road trips`, heading `Find ride-ready routes with maps, favorites, and AI suggestions.`, supporting copy, primary link to `/trips/new`, secondary anchor link to `#trip-browser`, and three stat tiles: total routes, map-backed plans, and AI-assisted discovery. Run `pnpm lint`. | | | `feat(discover): add travel hero section` |
| TASK-016 | Modify `app/page.tsx` to wrap content in `AppShell`, render `DiscoverHero` before the trip browser, render load errors with the redesigned `EmptyState` from TASK-025, and place the browser in a full-width section with `id="trip-browser"`. Preserve `dynamic = "force-dynamic"` and existing `api.getTrips()` behavior. Run `pnpm lint`. | | | `feat(discover): apply redesigned home layout` |
| TASK-017 | Redesign `components/SearchBar.tsx` using `Input`, `SearchIcon`, clear button with `XIcon`, visible label or `sr-only` label, and stable 44px touch target. Preserve existing debounce behavior and `onChange` contract. Add or update `components/SearchBar.test.tsx` only if a test renderer already exists; otherwise rely on `pnpm lint` because the repo has no React test renderer dependency. | | | `feat(discover): redesign search bar` |
| TASK-018 | Redesign `components/FilterControls.tsx` to use `Select` primitive classes, compact labels, filter group surface, and `SlidersHorizontalIcon`. Preserve derived location options and current `filters` contract. Add a `Clear filters` outline button that appears only when at least one filter is active and calls `onChange({})`. Run `pnpm lint` and `pnpm test lib/search.test.ts`. | | | `feat(discover): redesign filter controls` |
| TASK-019 | Redesign `components/TripBrowser.tsx` to render search, filters, grouping select, and result count inside a single un-nested control band. Add `id="trip-browser"` to the browser wrapper if not already present from `app/page.tsx`. Preserve `filterTrips`, `groupTrips`, `GROUP_OPTIONS`, `GroupField`, and empty-message behavior. Run `pnpm lint` and `pnpm test lib/search.test.ts`. | | | `feat(discover): redesign browser controls` |
| TASK-020 | Redesign `components/AiSuggestBox.tsx` with a warm accent surface, `SparklesIcon`, `Textarea` or large `Input`, primary `Ask AI` button, outline `Clear` button, loading copy, fallback copy, and suggestion cards using the redesigned `TripCard`. Preserve submit-only behavior, candidate projection, API call, fallback to `filterTrips`, and `Status` state machine. Run `pnpm lint` and `pnpm test lib/search.test.ts`. | | | `feat(discover): redesign ai suggestions` |

### Implementation Phase 5: Trip Cards, Grids, and Empty States

- GOAL-005: Make route content visually rich and consistent across discover, saved, my trips, AI results, and grouped sections.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-021 | Redesign `components/TripCard.tsx` using `Card`, `Badge`, `Button`, `MapPinIcon`, `Clock3Icon`, `HeartIcon`, `HeartFilled` equivalent from lucide if available or filled CSS fallback, `CarIcon`, `BikeIcon`, `CompassIcon`, and `NavigationIcon`. Replace `VEHICLE_ICON` emoji strings with icon components. Preserve thumbnail presign fetch, optimistic favorite behavior, signed-out redirect, modal intercept, link href, and favorite count math. Run `pnpm lint`. | | | `feat(trips): redesign trip cards` |
| TASK-022 | Redesign `components/TripGrid.tsx` to use larger gaps, route section headers with `Badge` count, and responsive card grid classes `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. Preserve modal state and grouped rendering. Run `pnpm lint`. | | | `feat(trips): redesign trip grid` |
| TASK-023 | Redesign `components/TripDetailModal.tsx` with a stronger scrim, `Card`-style modal panel, accessible close `Button` with `XIcon`, focus-safe close behavior, and max-height scrolling that does not hide the close button. Preserve `Escape` key and backdrop close behavior if currently implemented. Run `pnpm lint`. | | | `feat(trips): redesign trip detail modal` |
| TASK-024 | Redesign `components/TripDetail.tsx` as a map-first detail layout with metadata badges for trip type, vehicle, duration, author, and favorites. Replace emoji vehicle and map icons with lucide icons. Preserve My Maps validation, embed URL generation, embed failure timeout, fallback `Open map` link, and `googleMapsLink(trip)` action. Run `pnpm lint`, `pnpm test lib/maps.test.ts`, and `pnpm test lib/validation.test.ts`. | | | `feat(trips): redesign trip detail view` |
| TASK-025 | Redesign `components/EmptyState.tsx` to accept `icon?: ReactNode` instead of emoji string while remaining server-component-safe. Use `Card`-like non-nested surface only when rendered standalone, default to `CompassIcon`, and keep `title`, `description`, and `action` props. Update every call site in `app/page.tsx`, `app/saved/page.tsx`, `app/my-trips/page.tsx`, and `TripGrid.tsx` to pass lucide icons or omit icon. Run `pnpm lint`. | | | `feat(ui): redesign empty states` |

### Implementation Phase 6: Authenticated List Pages

- GOAL-006: Apply the app shell and redesigned grid/empty states to saved trips and authored trips without changing auth gates.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-026 | Redesign `app/saved/page.tsx` inside `AppShell` with a page header, subtitle, `HeartIcon` section marker, `Discover more` outline button, redesigned load-error state, redesigned empty state, and existing `TripGrid`. Preserve `getServerSession()`, `redirect("/login")`, `api.getFavorites(session.idToken)`, `api.getTrips()`, and hydration logic. Run `pnpm lint`. | | | `feat(saved): redesign saved trips page` |
| TASK-027 | Redesign `app/my-trips/page.tsx` inside `AppShell` with a page header, subtitle, `RouteIcon` section marker, primary `Create trip` action, redesigned load-error state, redesigned empty state, and existing `TripGrid`. Preserve auth gate and author filtering. Run `pnpm lint`. | | | `feat(my-trips): redesign authored trips page` |

### Implementation Phase 7: Create and Edit Trip Forms

- GOAL-007: Rebuild trip creation and editing as a structured route publishing workflow.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-028 | Redesign `components/TripForm.tsx` using `Card`, `Label`, `Input`, `Textarea`, `Select`, `Button`, `Badge`, and lucide section icons. Split visual layout into sections: `Trip basics`, `Location`, `Route links`, `Thumbnail`, and `Actions`. Preserve every state variable, validation rule, file type/size guard, presign upload flow, submitted `TripInput`, API create/update behavior, router push, router refresh, and inline My Maps error logic. Run `pnpm lint`, `pnpm test lib/validation.test.ts`, and `pnpm test lib/auth-config.test.ts`. | | | `feat(forms): redesign trip form workflow` |
| TASK-029 | Redesign `app/trips/new/page.tsx` with `AppShell`, page header, explanatory subtitle, and the redesigned `TripForm`. Preserve auth redirect and `dynamic = "force-dynamic"`. Run `pnpm lint`. | | | `feat(forms): redesign create trip page` |
| TASK-030 | Redesign `app/trips/[id]/edit/page.tsx` with `AppShell`, page header, back link, explanatory subtitle, and the redesigned `TripForm trip={trip}`. Preserve auth redirect, trip loading, ownership behavior, `notFound` behavior, and `dynamic = "force-dynamic"`. Run `pnpm lint`. | | | `feat(forms): redesign edit trip page` |

### Implementation Phase 8: Login and Share Page

- GOAL-008: Bring auth and public share surfaces into the same branded system.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-031 | Redesign `app/login/page.tsx` with `AppShell`, centered branded auth panel, `Button` primitives, `LogInIcon`, `LogOutIcon`, a configured/unconfigured warning state, and consistent error typography. Preserve Amplify imports, Hub listener, `refreshUser`, `handleSignIn`, `handleSignOut`, Google redirect behavior, and visible error logic. Run `pnpm lint` and `pnpm test lib/auth-config.test.ts`. | | | `feat(auth): redesign login page` |
| TASK-032 | Redesign `app/trip/[id]/page.tsx` with `AppShell`, breadcrumb/back link, route title section, and redesigned `TripDetail` in a constrained detail layout. Preserve `generateMetadata`, `loadTrip`, `api.getTrip`, presigned OG image generation, `notFound`, and `dynamic = "force-dynamic"`. Run `pnpm lint`, `pnpm test lib/maps.test.ts`, and `pnpm test lib/validation.test.ts`. | | | `feat(trips): redesign public trip page` |

### Implementation Phase 9: Visual QA, Regression Fixes, and Final Verification

- GOAL-009: Verify the redesigned app is coherent, accessible, responsive, and behaviorally unchanged.

| Task | Description | Completed | Date | Commit |
|------|-------------|-----------|------|--------|
| TASK-033 | Add `.superpowers/` to `.gitignore` so visual companion artifacts are not committed. Run `git status --short` and verify `.superpowers/` no longer appears as an untracked path. | | | `chore(git): ignore brainstorm artifacts` |
| TASK-034 | Run `pnpm lint`. Fix all lint errors caused by the redesign without changing behavior. Commit only lint-related fixes. | | | `fix(ui): resolve redesign lint issues` |
| TASK-035 | Run `pnpm test`. Fix all test failures caused by the redesign. Commit only test-related fixes. | | | `fix(ui): resolve redesign test regressions` |
| TASK-036 | Run `pnpm build`. Fix all build and type-check failures caused by the redesign. Commit only build/type fixes. | | | `fix(ui): resolve redesign build issues` |
| TASK-037 | Start the dev server with `pnpm dev` and inspect the app at `/`, `/saved`, `/my-trips`, `/trips/new`, `/login`, and one available `/trip/[id]` route if data exists. Verify at `375px`, `768px`, `1024px`, and `1440px`: no horizontal scroll, header works, mobile menu works, controls are reachable, text does not overlap, and empty/error states render. Commit visual QA fixes only. | | | `fix(ui): polish responsive redesign` |
| TASK-038 | Run final verification: `pnpm lint`, `pnpm test`, `pnpm build`. Update this plan by marking completed tasks with `✅` and date `2026-06-13` only after each task commit exists. Commit the plan status update. | | | `docs(plan): mark ux ui rebuild complete` |

## 3. Alternatives

- **ALT-001**: Copy the Ink template wholesale into Road Rash. Rejected because the template is a blog landing page and would introduce MDX/blog concepts unrelated to trip planning.
- **ALT-002**: Redesign only the home page. Rejected because the user requested all current app surfaces and a partial redesign would leave major workflows visually inconsistent.
- **ALT-003**: Build a dense dashboard-first interface. Rejected because the app needs public discovery and route sharing to feel approachable before it needs dense administration.
- **ALT-004**: Avoid new dependencies and hand-roll every primitive. Rejected because `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, and `next-themes` are the smallest practical set for shadcn-style primitives and theme behavior.

## 4. Dependencies

- **DEP-001**: `lucide-react` for consistent vector icons.
- **DEP-002**: `clsx` for conditional class composition.
- **DEP-003**: `tailwind-merge` for conflict-safe Tailwind class merging.
- **DEP-004**: `class-variance-authority` for typed button and badge variants.
- **DEP-005**: `next-themes` for light/dark/system theme support.
- **DEP-006**: Existing Tailwind v4 setup via `@tailwindcss/postcss` and `@import "tailwindcss"`.
- **DEP-007**: Existing AWS Amplify auth setup and `ConfigureAmplifyClientSide`.
- **DEP-008**: Existing `FavoritesProvider` behavior for optimistic favorite state.

## 5. Files

- **FILE-001**: `package.json` and `pnpm-lock.yaml` receive UI dependencies.
- **FILE-002**: `app/globals.css` receives semantic tokens, base layer styles, theme variables, focus states, and clickable cursor rules.
- **FILE-003**: `app/layout.tsx` receives metadata, theme provider wiring, and global body surface updates.
- **FILE-004**: `lib/utils.ts` and `lib/utils.test.ts` add and verify `cn`.
- **FILE-005**: `components/theme-provider.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/ui/label.tsx`, `components/ui/badge.tsx`, `components/ui/separator.tsx`, and `components/ui/skeleton.tsx` define shared primitives.
- **FILE-006**: `components/AppLogo.tsx`, `components/ModeToggle.tsx`, `components/AppHeader.tsx`, `components/AppFooter.tsx`, and `components/AppShell.tsx` define the shared shell.
- **FILE-007**: `app/page.tsx`, `components/DiscoverHero.tsx`, `components/TripBrowser.tsx`, `components/SearchBar.tsx`, `components/FilterControls.tsx`, and `components/AiSuggestBox.tsx` define the redesigned discovery flow.
- **FILE-008**: `components/TripCard.tsx`, `components/TripGrid.tsx`, `components/TripDetailModal.tsx`, `components/TripDetail.tsx`, and `components/EmptyState.tsx` define core trip presentation.
- **FILE-009**: `app/saved/page.tsx` and `app/my-trips/page.tsx` define authenticated list pages.
- **FILE-010**: `components/TripForm.tsx`, `app/trips/new/page.tsx`, and `app/trips/[id]/edit/page.tsx` define create/edit workflows.
- **FILE-011**: `app/login/page.tsx` defines the auth surface.
- **FILE-012**: `app/trip/[id]/page.tsx` defines the public share surface.
- **FILE-013**: `.gitignore` excludes `.superpowers/`.
- **FILE-014**: `plan/design-ux-ui-rebuild-1.md` tracks this plan and final task completion state.

## 6. Testing

- **TEST-001**: Run `pnpm test lib/utils.test.ts` after adding `cn`.
- **TEST-002**: Run `pnpm test lib/search.test.ts` after changing search, filter, grouping, and AI fallback presentation.
- **TEST-003**: Run `pnpm test lib/maps.test.ts` after changing trip detail or public trip page UI.
- **TEST-004**: Run `pnpm test lib/validation.test.ts` after changing form or map-related UI.
- **TEST-005**: Run `pnpm test lib/auth-config.test.ts` after changing login or auth-gated form pages.
- **TEST-006**: Run full `pnpm lint` after each task that touches TypeScript, React, CSS, or app routes.
- **TEST-007**: Run full `pnpm test` in TASK-035 and TASK-038.
- **TEST-008**: Run full `pnpm build` in TASK-036 and TASK-038.
- **TEST-009**: Run local visual QA in TASK-037 at `375px`, `768px`, `1024px`, and `1440px`.
- **TEST-010**: Verify reduced-motion behavior by ensuring no required animation depends on motion-only cues.

## 7. Risks & Assumptions

- **RISK-001**: Adding shadcn-style dependencies can create lint or type conflicts with React 19 and Next 16. Mitigation: add dependencies in TASK-001 and verify before UI migration.
- **RISK-002**: Introducing `next-themes` can cause hydration differences. Mitigation: use `suppressHydrationWarning` and keep theme UI client-only.
- **RISK-003**: Replacing emoji icons can accidentally remove accessible meaning. Mitigation: every icon-only control requires `aria-label` or `sr-only` text.
- **RISK-004**: Trip detail redesign can break map embed fallback. Mitigation: do not change `validateMyMapsUrl`, `toMyMapsEmbedUrl`, timeout fallback, or `googleMapsLink`.
- **RISK-005**: Form visual restructuring can break submit payload shape. Mitigation: preserve state variables, `TripInput`, and API calls exactly.
- **RISK-006**: Card redesign can break favorite toggling or modal opening. Mitigation: preserve event stop/prevent behavior, signed-out redirect, `onOpen`, and `href`.
- **RISK-007**: The repo currently has no React component test renderer dependency. Mitigation: do not introduce broad UI testing infrastructure unless a task explicitly needs it; use lint/build plus existing logic tests.
- **ASSUMPTION-001**: The implementation can add the listed UI dependencies via network access when the task is executed.
- **ASSUMPTION-002**: The redesign should not add MDX, blog routes, contact pages, or content management features from the reference template.
- **ASSUMPTION-003**: The selected visual direction is Travel-App Hybrid across all current app surfaces.
- **ASSUMPTION-004**: The design should feel like a usable app first, not a marketing-only landing page.

## 8. Related Specifications / Further Reading

- Reference template: `/Users/huyng/ws/shadcn-nextjs-ink-landing-page-2.0.0/`
- Reference tokens: `/Users/huyng/ws/shadcn-nextjs-ink-landing-page-2.0.0/src/app/globals.css`
- Reference shell: `/Users/huyng/ws/shadcn-nextjs-ink-landing-page-2.0.0/src/components/layout/header.tsx`
- Reference hero: `/Users/huyng/ws/shadcn-nextjs-ink-landing-page-2.0.0/src/components/blocks/hero-section/hero-section.tsx`
- Existing product plan: `plan/feature-road-rash-mvp-1.md`
- Existing architecture: `docs/architecture.md`
- Deployment notes: `docs/aws-deployment.md`
