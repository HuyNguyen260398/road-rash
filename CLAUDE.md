# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repo is **well underway**, not pre-code. The Next.js app (`app/`, `components/`, `lib/`), the Terraform infra (`infra/bootstrap`, `infra/modules/*`, `infra/envs/{staging,prod}`), and the Lambda services (`services/{trips,presign,suggest-trips}`) are all on disk, with `package.json` / `pnpm-lock.yaml` committed. Milestones **M0–M3, M5, and M6 have landed**; **M4 (favorites / saved view / public share page) is the main gap** — the heart on `TripCard` is display-only, and there is no `services/favorites/handler.ts`, `app/saved/`, or favorites routes yet (the `services/favorites/dist/` artifact is stale). Treat `plan/feature-road-rash-mvp-1.md` (the per-task status table), `docs/road-rash-plan.md`, and `docs/architecture.md` as the source of truth for what's done.

**Not yet deployed:** Terraform is written and `validate`-clean, but `terraform apply` is **deferred** — no live AWS resources exist. So anything needing real Cognito / API Gateway / DynamoDB / S3 / Gemini (sign-in, CRUD persistence, AI suggestions) can't be exercised end-to-end locally yet; `pnpm test` (Vitest) and `pnpm build` are the current verification. When something is described as "planned" below, verify it exists on disk before assuming.

## What this project is

**road-rash** is a mobile-first responsive web app for creating, sharing, and discovering travel trip plans, built around Google My Maps. Stack: **Next.js (App Router, SSR)** frontend on **AWS Amplify Hosting**, with a serverless REST backend (**API Gateway → Lambda → DynamoDB**), **Cognito** auth (Google OAuth), **S3** thumbnails, and **Google Gemini** for AI suggestions. **All AWS resources are provisioned with Terraform** (remote state in an S3 backend). There is **no Amplify Gen 2 backend and no AppSync/GraphQL** — Amplify is hosting only.

## The central architectural constraint

**Google My Maps has no public API.** The app cannot create, read, or edit a My Maps map programmatically. A trip's map is therefore **user-supplied data**: the user builds the map by hand in the My Maps UI and pastes the share/embed URL into the trip form. The app validates the URL, stores the string, and renders it as a read-only `<iframe>`. Any feature idea that assumes programmatic map access is a dead end — design around this constraint. The separate "Open in Google Maps" action is a best-effort mobile deep link, not a guaranteed native handoff.

## Key design decisions (locked)

- **Terraform owns all AWS resources**; remote state in an S3 backend (native locking via `use_lockfile`). Terraform is the single source of truth — no manual console edits. Amplify is hosting/CI only.
- **REST, not GraphQL**: API Gateway (HTTP API) → Lambda → DynamoDB via AWS SDK. No AppSync, no `amplify/` backend, no `ampx`, no typed Amplify Data client.
- Thumbnails upload to S3 via **presigned PUT URL** (issued by a Lambda), read via presigned GET.
- Mobile-oriented = **responsive web only**, not a PWA (for now).
- Trip browsing is **public** — guests read via public GET routes. Auth (Cognito JWT) is required only to create/edit trips and to favorite.
- The My Maps link renders as an embedded iframe in the trip detail modal.

## Architecture notes that span multiple files

- **Two DynamoDB tables** (`aws_dynamodb_table` in `infra/modules/dynamodb`): `Trip` and `Favorite`. `Trip.favoriteCount` is a **denormalized counter** updated by the favorites Lambda — don't compute it by scanning Favorites at read time. `Favorite` enforces composite uniqueness on (`tripId`, `userId`) plus a `userId` GSI for the saved-trips view.
- **Authorization is two-layered, not a schema engine**: the API Gateway **Cognito JWT authorizer** gates mutating routes (public GET routes stay open), and the **Lambda handler** enforces ownership by comparing the JWT `sub` claim to `authorId`/`userId`. Lambda IAM roles are least-privilege per function.
- **Search/filter/grouping** operates on `name`, `location`, `city`, `province`, `country`, `tripType`, `vehicle`, all via `GET /trips` query params. Start with **DynamoDB only** (Option A): GSIs for filter/group fields, `contains` + client-side substring matching for free text. Do not add OpenSearch (Option B) unless scale demands it.
- **Gemini is server-side only.** The `suggestTrips` Lambda (behind `POST /suggest`) takes the user's prompt + a candidate set of trips and returns **ranked trip IDs selected only from the candidates passed in** — validate returned IDs against DynamoDB before rendering. The key lives in **SSM Parameter Store (SecureString)**, read at Lambda runtime; never reaches the browser. AI fires on **explicit submit**, never per-keystroke; plain search stays instant as the fallback.
- **Next.js SSR + Cognito sessions**: configure Amplify JS Auth **manually** against the Terraform-created Cognito pool (no `amplify_outputs.json`); use `@aws-amplify/adapter-nextjs` (`createServerRunner`) for SSR sessions. Frontend reads Cognito IDs / API base URL from Amplify Hosting env vars populated from Terraform outputs.

## Repository layout

- `infra/` — Terraform: `bootstrap/` (state bucket), `envs/{staging,prod}` (root with `backend "s3"`), `modules/{cognito,dynamodb,s3,lambda,apigateway,hosting,iam,ssm}`. See `infra/README.md`.
- `services/{trips,presign,suggest-trips}/` — Lambda handlers (TypeScript), with `services/shared/` (http/dynamo/auth helpers) and `services/build.mjs` (esbuild bundler). The `favorites` handler is planned (M4) but **not yet implemented**.
- `app/`, `components/`, `lib/` — Next.js frontend (`lib/` holds the typed API client, search, domain types, validation, and Amplify config).

## Commands

This project uses **pnpm** (not npm/yarn); `pnpm-lock.yaml` is committed.

- `pnpm dev` / `pnpm build` / `pnpm lint` — Next.js (`build` also runs the `tsc` typecheck).
- `pnpm test` — Vitest (`pnpm test <path>` for a single file; `pnpm test:watch` to watch). Tests live next to source as `*.test.ts` (e.g. `lib/search.test.ts`, `services/suggest-trips/select.test.ts`).
- `pnpm build:lambdas` — bundle each `services/<name>/handler.ts` → `services/<name>/dist/index.js`. **Run before any `terraform plan/apply`**, since the lambda module zips `dist/` (which is gitignored).
- `terraform -chdir=infra/envs/<env> init|plan|apply` — provision AWS (bootstrap the state bucket first; see `infra/README.md`).

## Reference

- `docs/road-rash-plan.md` — product/architecture plan: data model, milestones (M0–M8), risk table. §7 lists deferred open questions (personalization, ratings, PWA, OpenSearch) — explicitly out of scope for the initial build.
- `docs/architecture.md` — architecture document: C4 context/container views, data/auth/AI flows, security controls, and ADR summary.
- `plan/feature-road-rash-mvp-1.md` — executable implementation plan with atomic, numbered tasks (TASK-001…) mapped to phases M0–M8; front-matter `status` is `In progress`. **Keep the `Completed`/`Date` columns updated as tasks land** — this table is the authoritative record of what's done. Per-phase step guides live in `plan/steps/`.
