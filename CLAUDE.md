# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repo is **pre-code**: it contains only the docs (`docs/`) and plan (`plan/`) and has no application source, no `infra/`, and no `package.json` yet. Treat `docs/road-rash-plan.md` and `docs/architecture.md` as the source of truth; the first real work is M0 (Next.js scaffold + Terraform bootstrap). When something below is described as "planned," it does not exist on disk yet — verify before assuming.

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

## Repository layout (planned)

- `infra/` — Terraform: `bootstrap/` (state bucket), root (`backend "s3"`), `modules/{cognito,dynamodb,s3,lambda,apigateway,hosting,iam}`, `envs/{staging,prod}`.
- `services/{trips,favorites,presign,suggest-trips}/` — Lambda handlers (TypeScript).
- `app/`, `components/`, `lib/` — Next.js frontend.

## Commands (planned — none exist until M0)

This project uses **pnpm** (not npm/yarn) for JS deps/scripts; commit `pnpm-lock.yaml`. Scaffold with `pnpm create next-app` (App Router, TS). Expected workflow:

- `pnpm install` / `pnpm dev` / `pnpm build` / `pnpm lint` — Next.js
- `terraform -chdir=infra/envs/<env> init|plan|apply` — provision AWS (bootstrap the state bucket first; see `infra/README.md`)

Confirm the actual scripts in `package.json` once it exists; add the real test command (Vitest/Jest, TBD) and single-test invocation once the framework is chosen.

## Reference

- `docs/road-rash-plan.md` — product/architecture plan: data model, milestones (M0–M8), risk table. §7 lists deferred open questions (personalization, ratings, PWA, OpenSearch) — explicitly out of scope for the initial build.
- `docs/architecture.md` — architecture document: C4 context/container views, data/auth/AI flows, security controls, and ADR summary.
- `plan/feature-road-rash-mvp-1.md` — executable implementation plan with atomic, numbered tasks (TASK-001…) mapped to phases M0–M8. **Update the `Completed`/`Date` columns as tasks land**, and set the front-matter `status` to `In progress` once M0 starts.
