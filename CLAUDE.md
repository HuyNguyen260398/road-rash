# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repo is **pre-code**: it contains only `docs/road-rash-plan.md` (the architecture & development plan) and has no commits, no `package.json`, and no application source yet. Treat the plan as the source of truth; the first real work is scaffolding (milestone M0 in the plan). When something below is described as "planned," it does not exist on disk yet — verify before assuming.

## What this project is

**road-rash** is a mobile-first responsive web app for creating, sharing, and discovering travel trip plans, built around Google My Maps. Planned stack: **Next.js (App Router, SSR) + AWS Amplify Gen 2** (Cognito, AppSync/GraphQL, DynamoDB, S3, Lambda) + Google OAuth + Google Gemini for AI trip suggestions.

## The central architectural constraint

**Google My Maps has no public API.** The app cannot create, read, or edit a My Maps map programmatically. A trip's map is therefore **user-supplied data**: the user builds the map by hand in the My Maps UI and pastes the share/embed URL into the trip form. The app validates the URL, stores the string, and renders it as a read-only `<iframe>`. Any feature idea that assumes programmatic map access is a dead end — design around this constraint. The separate "Open in Google Maps" action is a best-effort mobile deep link, not a guaranteed native handoff.

## Key design decisions (locked)

- Thumbnails are uploaded to S3 (Amplify Storage), retrieved via signed URL.
- Mobile-oriented = **responsive web only**, not a PWA (for now).
- Trip browsing is **public** — guests (unauthenticated, via Cognito identity pool) can browse all shared trips. Auth is required only to create/edit trips and to favorite.
- The My Maps link renders as an embedded iframe in the trip detail modal.

## Architecture notes that span multiple files

- **Two DynamoDB models** (defined via Amplify Data schema in the planned `amplify/data/resource.ts`): `Trip` and `Favorite`. `Trip.favoriteCount` is a **denormalized counter** kept in sync when favorites change — don't compute it by scanning Favorites at read time. `Favorite` has composite uniqueness on (`tripId`, `userId`) to prevent double-favoriting, plus a `userId` GSI for the "my favorites" view.
- **Auth rules** (enforced in the data schema, not just the UI): `Trip` = public read, owner-only (`authorId`) write; `Favorite` = owner-only (`userId`) read/create/delete.
- **Search/filter/grouping** operates on `name`, `location`, `city`, `province`, `country`, `tripType`, `vehicle`. Start with **DynamoDB only** (Option A): GSIs for filter/group fields, client-side or `contains`-expression substring matching for the search bar. Do not add OpenSearch/external search (Option B) unless dataset scale actually demands it.
- **Gemini is server-side only.** The `suggestTrips` Lambda takes the user's prompt + a candidate set of trips, calls Gemini, and returns **ranked trip IDs selected only from the candidates passed in** — validate returned IDs against DynamoDB before rendering so the AI can't surface trips that don't exist. The API key lives as an Amplify/SSM secret and must never reach the browser. AI suggestion fires on **explicit submit**, never per-keystroke; plain search stays instant and independent so it can serve as the fallback when the AI call fails.
- **Next.js SSR + Cognito sessions**: use the official `@aws-amplify/adapter-nextjs` patterns for server-side auth rather than hand-rolling session handling.

## Commands (planned — none exist until M0 scaffolding)

This project uses **pnpm** as its package manager. Use pnpm (not npm/yarn) for installing dependencies and running scripts; commit `pnpm-lock.yaml`.

Once scaffolded with `pnpm create amplify@latest` on Next.js App Router, the standard Amplify Gen 2 workflow will be:

- `pnpm install` — install dependencies
- `pnpm ampx sandbox` — run a per-developer cloud sandbox that watches `amplify/` and hot-deploys backend changes
- `pnpm dev` — run the Next.js dev server
- `pnpm build` / `pnpm lint` — Next.js build and lint

Confirm the actual scripts in `package.json` once it exists; update this section with the real commands (including how to run a single test) after the test framework is chosen.

## Reference

Full architecture, data model, milestones (M0–M8), and risk table: `docs/road-rash-plan.md`. Section §7 lists deferred open questions (personalization, ratings, PWA, OpenSearch) — these are explicitly out of scope for the initial build.
