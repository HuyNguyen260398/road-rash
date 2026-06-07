---
goal: Implement the road-rash trip-planning web app MVP (M0–M8)
version: 2.0
date_created: 2026-06-06
last_updated: 2026-06-07
owner: Huy Nguyen
status: 'In progress'
tags: [feature, architecture, terraform, nextjs, serverless, mvp]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan turns `docs/road-rash-plan.md` into an executable, phase-by-phase build for the road-rash MVP: a mobile-first Next.js app (on Amplify Hosting) backed by a serverless REST API (API Gateway → Lambda → DynamoDB), Cognito auth, S3 media, and Gemini AI suggestions. **All AWS resources are provisioned with Terraform** (remote state in an S3 backend). There is no Amplify Gen 2 backend and no AppSync/GraphQL. Phases map 1:1 to milestones M0–M8; every task names concrete files, symbols, and verifiable completion criteria.

> **v2.0 change:** infrastructure moved from Amplify Gen 2 backend-as-code to Terraform; data/API layer moved from AppSync GraphQL to API Gateway + Lambda (REST). See `docs/architecture.md` for the current architecture.

## 1. Requirements & Constraints

- **REQ-001**: Mobile-first responsive web app (Next.js App Router, SSR). Not a PWA.
- **REQ-002**: Public, unauthenticated browsing of all shared trips (public GET routes).
- **REQ-003**: Authenticated users (Google OAuth via Cognito) can create/edit/delete their own trips and favorite trips.
- **REQ-004**: Two DynamoDB tables — `Trip` and `Favorite` — per `docs/road-rash-plan.md` §3.
- **REQ-005**: Trip thumbnails stored in S3, uploaded via presigned PUT URL, read via presigned GET.
- **REQ-006**: My Maps map is user-supplied URL, validated, rendered as a read-only `<iframe>`.
- **REQ-007**: AI suggestions ranked ONLY from candidate trip IDs passed to Gemini; returned IDs validated against DynamoDB before render.
- **REQ-008**: Search/filter/group over `name`, `location`, `city`, `province`, `country`, `tripType`, `vehicle`.
- **REQ-009**: All AWS resources defined and provisioned via Terraform; remote state in an S3 backend.
- **SEC-001**: Gemini API key and Google OAuth client secret stored in SSM Parameter Store (SecureString), server-side only; never shipped to the browser.
- **SEC-002**: Mutating API routes require a Cognito JWT (API Gateway authorizer); Lambda enforces owner checks (`sub` == `authorId`/`userId`).
- **SEC-003**: Validate/sanitize `myMapsUrl` host before embedding to prevent arbitrary iframe injection.
- **SEC-004**: Enforce thumbnail max size and content-type at presign and on the client.
- **SEC-005**: Lambda IAM roles least-privilege, scoped to specific tables/bucket/parameters.
- **CON-001**: Google My Maps has no public API — no programmatic map create/read/edit anywhere.
- **CON-002**: Start with DynamoDB-only search (Option A); no OpenSearch unless scale demands it.
- **CON-003**: AI suggestion triggers on explicit submit only, never per-keystroke.
- **CON-004**: No Amplify Gen 2 backend (`ampx`, `defineData`/`defineAuth`) and no AppSync; Amplify is hosting only.
- **GUD-001**: Use `@aws-amplify/adapter-nextjs` (`createServerRunner`) with Amplify JS Auth pointed at the Terraform-created Cognito pool for SSR sessions.
- **GUD-002**: Use pnpm for all dependency/script operations; commit `pnpm-lock.yaml`.
- **GUD-003**: Keep `favoriteCount` denormalized on `Trip`; never compute by scanning `Favorite` at read time.
- **GUD-004**: Terraform is the single source of truth; no manual console edits; run `terraform plan` in CI.
- **PAT-001**: `infra/` Terraform modules per concern (`cognito`, `dynamodb`, `s3`, `lambda`, `apigateway`, `hosting`, `iam`) with per-env roots.
- **PAT-002**: REST routes proxied to Lambda; ownership enforced in handler from JWT `sub` claim.
- **PAT-003**: Secrets read from SSM at Lambda runtime via `environment` parameter names, not values.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: M0 — Scaffold Next.js (pnpm), bootstrap Terraform with an S3 state backend, and provision Amplify Hosting.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Scaffold the app: `pnpm create next-app` (App Router, TypeScript) at repo root. Add `"packageManager": "pnpm@<version>"` and `engines.node: ">=24"` to `package.json`. Verify `pnpm dev` serves `http://localhost:3000`. | ✅ | 2026-06-07 |
| TASK-002 | Create `infra/bootstrap/` Terraform that provisions the **state S3 bucket** (versioned + SSE-encrypted, public-access-blocked). Apply with local state. | ✅ (code+validate; apply deferred) | 2026-06-07 |
| TASK-003 | Add `infra/` root with `backend "s3" { bucket=..., key="env/<env>/terraform.tfstate", region=..., use_lockfile=true }`; run `terraform init -migrate-state`. Document the bootstrap ordering in `infra/README.md`. | ✅ (per-env roots; partial backend) | 2026-06-07 |
| TASK-004 | Establish module layout: `infra/modules/{cognito,dynamodb,s3,lambda,apigateway,hosting,iam}` and per-env roots `infra/envs/{staging,prod}` with `*.tfvars`. | ✅ | 2026-06-07 |
| TASK-005 | `hosting` module: `aws_amplify_app` + `aws_amplify_branch` for `main` (prod) and `staging`, connected to GitHub `HuyNguyen260398/road-rash`, with a pnpm build spec (`corepack enable && pnpm install --frozen-lockfile && pnpm build`). | ✅ (one app per env) | 2026-06-07 |
| TASK-006 | Define Terraform outputs (Cognito IDs, API base URL, region, bucket) and wire them into Amplify Hosting environment variables consumed by the Next.js app. | ✅ (placeholders until M1/M2) | 2026-06-07 |
| TASK-007 | Add `amplify.yml` build spec (pnpm) committed at repo root for Amplify Hosting. | ✅ | 2026-06-07 |

### Implementation Phase 2

- GOAL-002: M1 — Provision Cognito (User Pool + Identity Pool + Google) via Terraform; wire client auth + SSR sessions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | In Google Cloud Console, create an OAuth 2.0 client (consent screen; redirect URIs for each Cognito Hosted UI domain). Record client ID/secret. | ⏳ (manual — user step) | |
| TASK-009 | Store secrets in SSM: `aws_ssm_parameter` (SecureString) for `google_oauth_client_id` and `google_oauth_client_secret` per environment. | ✅ (code+validate; apply deferred) | 2026-06-07 |
| TASK-010 | `cognito` module: `aws_cognito_user_pool`, `_user_pool_client`, `_user_pool_domain`, `_identity_provider` (Google, scopes email/profile/openid), `_identity_pool`, authenticated/unauthenticated `aws_iam_role`, `_identity_pool_roles_attachment`. | ✅ (code+validate; apply deferred) | 2026-06-07 |
| TASK-011 | Create `lib/amplify-config.ts` configuring Amplify JS (`Amplify.configure`) with Cognito IDs from env vars; `components/ConfigureAmplifyClientSide.tsx` (`'use client'`, `ssr: true`) mounted in `app/layout.tsx`. | ✅ | 2026-06-07 |
| TASK-012 | Create `lib/amplify-server-utils.ts` exporting `runWithAmplifyServerContext` via `createServerRunner` from `@aws-amplify/adapter-nextjs`. | ✅ | 2026-06-07 |
| TASK-013 | Create `app/login/page.tsx` (`'use client'`) with `signInWithRedirect({ provider: 'Google' })` and `signOut()`. | ✅ (build verified; live OAuth pending) | 2026-06-07 |
| TASK-014 | Add `middleware.ts` / server guards using `fetchAuthSession` in server context to protect `/trips/new`, `/trips/[id]/edit`, `/my-trips`, `/saved`; redirect unauthenticated users to `/login`. | ✅ (as `proxy.ts` — Next 16 convention) | 2026-06-07 |

### Implementation Phase 3

- GOAL-003: M2 — Provision DynamoDB tables + GSIs, S3 thumbnails bucket, base API Gateway + JWT authorizer, and Lambda IAM roles via Terraform.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | `dynamodb` module: `aws_dynamodb_table` `Trip` (PK `id`) with GSIs on `country`, `province`, `city`, `tripType`, `vehicle`; pay-per-request billing. | ✅ (code+validate; apply deferred) | 2026-06-08 |
| TASK-016 | `dynamodb` module: `aws_dynamodb_table` `Favorite` (PK enforcing (`tripId`,`userId`) uniqueness) with a `userId` GSI. | ✅ (code+validate; apply deferred) | 2026-06-08 |
| TASK-017 | `s3` module: `aws_s3_bucket` thumbnails (private, public-access-block, SSE), CORS rules for browser PUT/GET. | ✅ (code+validate; apply deferred) | 2026-06-08 |
| TASK-018 | `iam` module: least-privilege roles/policies per Lambda (scoped DynamoDB actions, S3 object actions on the bucket prefix, SSM `GetParameter` on specific names). | ✅ (code+validate; apply deferred) | 2026-06-08 |
| TASK-019 | `apigateway` module: `aws_apigatewayv2_api` (HTTP), `aws_apigatewayv2_authorizer` (JWT, Cognito issuer/audience), default `aws_apigatewayv2_stage` with throttling/rate limits (notably on the public `POST /suggest` route), CORS config. | ✅ (code+validate; per-route /suggest throttle in M6; apply deferred) | 2026-06-08 |
| TASK-020 | `lambda` module: reusable `aws_lambda_function` + `aws_lambda_permission` + `aws_cloudwatch_log_group`; standardize TS bundling (esbuild) and zip packaging. | ✅ (reusable module + validate; esbuild bundling lands with handlers in M3) | 2026-06-08 |
| TASK-021 | Create `lib/api-client.ts` (frontend) with a typed `fetch` wrapper that injects the Cognito JWT into `Authorization` for protected calls and reads the API base URL from env. | ✅ (build verified) | 2026-06-08 |

### Implementation Phase 4

- GOAL-004: M3 — Trip CRUD Lambda + routes; create/edit form with presigned thumbnail upload and My Maps validation; card grid; My Trips.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | Create `lib/validation.ts`: `validateMyMapsUrl(url)` (allow only `www.google.com/maps/d/` + embed paths) and `toMyMapsEmbedUrl(url)`. Add unit tests. | | |
| TASK-023 | `services/trips/handler.ts` Lambda: handle `GET /trips`, `GET /trips/{id}`, `POST /trips` (create), `PUT /trips/{id}`, `DELETE /trips/{id}`; on write, set/verify `authorId` from JWT `sub`; init `favoriteCount: 0` on create. Wire routes in the `apigateway` module. | | |
| TASK-024 | `services/presign/handler.ts` Lambda + `POST /uploads/presign` (JWT-authenticated): validate content-type/size, return a presigned S3 PUT URL and object key scoped to the caller. | | |
| TASK-025 | Create `components/TripForm.tsx` with all `Trip` fields (text, `tripType`/`vehicle` selects, `durationDays`, structured `city`/`province`/`country`, `myMapsUrl` with validation + help, optional `googleMapsUrl`); thumbnail upload via presign → S3 PUT → store key. | | |
| TASK-026 | Create `app/trips/new/page.tsx` (auth-gated) and `app/trips/[id]/edit/page.tsx` (owner-gated) using `TripForm` against the trips API. | | |
| TASK-027 | Create `components/TripCard.tsx` (thumbnail via presigned GET, name, location, duration, vehicle icon, author, heart + count) and `components/TripGrid.tsx` (responsive grid). | | |
| TASK-028 | Create `app/page.tsx` (Home/Discover, SSR `GET /trips`) and `app/my-trips/page.tsx` (auth-gated; `authorId` == current sub). | | |

### Implementation Phase 5

- GOAL-005: M4 — Favorites Lambda + routes with denormalized count; optimistic UI; saved view; public share page.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-029 | `services/favorites/handler.ts` Lambda + routes (`GET /favorites`, `POST /favorites`, `DELETE /favorites/{tripId}`): create/delete `Favorite` keyed by JWT `sub` and increment/decrement `Trip.favoriteCount` (document the race trade-off). | | |
| TASK-030 | Add optimistic heart toggle to `TripCard.tsx`: update local state immediately, reconcile on response, revert on error. | | |
| TASK-031 | Create `app/saved/page.tsx` (auth-gated): query `GET /favorites`, batch-load referenced trips. | | |
| TASK-032 | Create `app/trip/[id]/page.tsx` — public, SSR, shareable trip page with OG metadata from trip fields. | | |

### Implementation Phase 6

- GOAL-006: M5 — Search/filter/group via GET /trips query params (DynamoDB Option A); empty/no-result states.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-033 | Extend `services/trips/handler.ts` `GET /trips` to accept `q`, `tripType`, `country`, `province`, `city`, `vehicle`, `group` params; use GSI queries per filter + `contains` for free text. | | |
| TASK-034 | Create `components/SearchBar.tsx` (debounced) and `components/FilterControls.tsx` (`tripType`/`country`/`province`/`city`/`vehicle`). | | |
| TASK-035 | Create `lib/search.ts` for client-side case-insensitive substring fallback over the candidate set. | | |
| TASK-036 | Add a grouping toggle (e.g. by `country`) rendering grouped section headers in `TripGrid`. | | |
| TASK-037 | Add empty-state and "no results" components for Home, My Trips, Saved, and search. | | |

### Implementation Phase 7

- GOAL-007: M6 — Gemini-backed `suggestTrips` Lambda behind `POST /suggest`; AI prompt UI with safe fallback.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-038 | Store the AI key: `aws_ssm_parameter` (SecureString) `gemini_api_key` per environment. | | |
| TASK-039 | `services/suggest-trips/handler.ts` Lambda + `POST /suggest` (public, throttled via API Gateway): read candidate trips, build a compact prompt, call the Gemini REST API (key from SSM), parse strict JSON `[{id, reason}]`, and filter to IDs present in the candidate set. Bounded timeout (~30s). | | |
| TASK-040 | Grant the suggest Lambda IAM read on the Trip table and `GetParameter` on `gemini_api_key`. | | |
| TASK-041 | Create `components/AiSuggestBox.tsx` ("Where do you want to ride?") submitting on explicit click to `POST /suggest`; render suggested cards with optional "why it fits". | | |
| TASK-042 | Implement graceful fallback: on Gemini error/timeout, show a message and fall back to plain search. | | |

### Implementation Phase 8

- GOAL-008: M7 — Trip detail modal with safe My Maps iframe and "Open in Google Maps" deep link.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-043 | Create `components/TripDetailModal.tsx`: full info, favorite heart, embedded My Maps `<iframe>` via `toMyMapsEmbedUrl` + host allow-list guard. | | |
| TASK-044 | Add iframe load-failure detection (onError/timeout) falling back to a plain "Open map" link. | | |
| TASK-045 | Add an "Open in Google Maps" button using `googleMapsUrl` (or a maps query URL) that deep-links to the native app on mobile; test iOS + Android. | | |
| TASK-046 | Wire `TripCard`/`TripGrid` to open `TripDetailModal`; ensure `/trip/[id]` deep links render detail content. | | |

### Implementation Phase 9

- GOAL-009: M8 — Responsive QA, limits, production `terraform apply` + deploy + smoke test.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-047 | Responsive QA across phone/tablet/desktop; verify loading/empty/error states on every screen. | | |
| TASK-048 | Enforce form validation, image size/type limits (client + presign), and basic rate-sanity on create. | | |
| TASK-049 | Configure `prod` tfvars/secrets; run `terraform plan` then `terraform apply` for `prod`; deploy `main` via Amplify Hosting. | | |
| TASK-050 | Run an end-to-end smoke test: sign in → create trip with thumbnail + My Maps URL → appears on Home → search/filter finds it → favorite it → AI suggestion returns it → detail modal embeds map → open in Google Maps. | | |

## 3. Alternatives

- **ALT-001**: Amplify Gen 2 backend-as-code — rejected (CON-004); Terraform is the chosen IaC and would conflict with Amplify owning the same resources.
- **ALT-002**: AppSync GraphQL — rejected in favor of API Gateway + Lambda (REST), simpler to express fully in Terraform.
- **ALT-003**: DynamoDB lock table for Terraform state — optional fallback; using S3 native locking (`use_lockfile`) to avoid an extra resource.
- **ALT-004**: S3 + CloudFront for the frontend — rejected for MVP; Amplify Hosting gives easier git-based SSR deploys and is Terraform-manageable.
- **ALT-005**: OpenSearch full-text search (Option B) — deferred (CON-002).
- **ALT-006**: PWA / installable app — deferred to phase 2 (REQ-001).
- **ALT-007**: Browser-side Gemini call — rejected; would leak the key (SEC-001).
- **ALT-008**: Live `favoriteCount` from scans — rejected; expensive at read time (GUD-003).

## 4. Dependencies

- **DEP-001**: Terraform ≥ 1.10 + AWS provider; AWS account with permissions for Amplify, Cognito, API Gateway, Lambda, DynamoDB, S3, SSM, IAM, CloudWatch.
- **DEP-002**: `next`, `react`, `react-dom`, `typescript`.
- **DEP-003**: `aws-amplify` (JS Auth category) + `@aws-amplify/adapter-nextjs` for SSR sessions.
- **DEP-004**: `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-ssm` (Lambda).
- **DEP-005**: `esbuild` (or similar) for Lambda TS bundling.
- **DEP-006**: Google Cloud OAuth 2.0 client (consent screen + redirect URIs).
- **DEP-007**: Google Gemini API key (`gemini_api_key`).
- **DEP-008**: Test runner (Vitest or Jest) — chosen during TASK-022.

## 5. Files

- **FILE-001**: `infra/bootstrap/` — Terraform for the S3 state bucket (bootstrap).
- **FILE-002**: `infra/` root — `backend "s3"`, providers, module composition.
- **FILE-003**: `infra/modules/{cognito,dynamodb,s3,lambda,apigateway,hosting,iam}/` — resource modules.
- **FILE-004**: `infra/envs/{staging,prod}/` — per-env roots + `*.tfvars`.
- **FILE-005**: `infra/README.md` — bootstrap ordering, apply workflow, outputs.
- **FILE-006**: `services/{trips,favorites,presign,suggest-trips}/handler.ts` — Lambda handlers.
- **FILE-007**: `lib/amplify-config.ts`, `components/ConfigureAmplifyClientSide.tsx` — client Amplify config.
- **FILE-008**: `lib/amplify-server-utils.ts` — SSR server context.
- **FILE-009**: `lib/api-client.ts` — frontend fetch wrapper with JWT.
- **FILE-010**: `lib/validation.ts`, `lib/search.ts` — My Maps validation, client search fallback.
- **FILE-011**: `app/{page.tsx,login,trips/new,trips/[id]/edit,my-trips,saved,trip/[id]}` — routes.
- **FILE-012**: `components/{TripForm,TripCard,TripGrid,SearchBar,FilterControls,AiSuggestBox,TripDetailModal}.tsx`.
- **FILE-013**: `amplify.yml` — pnpm Amplify Hosting build spec.
- **FILE-014**: `docs/architecture.md` — companion architecture document.

## 6. Testing

- **TEST-001**: Unit — `validateMyMapsUrl` accepts valid My Maps hosts/paths, rejects arbitrary/malicious URLs (SEC-003).
- **TEST-002**: Unit — `toMyMapsEmbedUrl` produces a correct embed URL from share URLs.
- **TEST-003**: Unit — `search.ts` substring matching is case-insensitive across searchable fields.
- **TEST-004**: Unit — `suggestTrips` filters out any Gemini-returned ID not in the candidate set (REQ-007).
- **TEST-005**: Integration — public GET routes work unauthenticated; mutating routes reject missing/invalid JWT (SEC-002).
- **TEST-006**: Integration — Lambda owner check denies editing another user's trip.
- **TEST-007**: Integration — favorite toggle creates/deletes `Favorite` and updates `favoriteCount`; double-favorite prevented.
- **TEST-008**: Integration — presign rejects oversized/non-image content-type (SEC-004).
- **TEST-009**: Infra — `terraform validate` + `terraform plan` succeed for `staging` and `prod`; no unexpected diffs.
- **TEST-010**: E2E — full smoke flow from TASK-050.

## 7. Risks & Assumptions

- **RISK-001**: Bootstrap ordering (state bucket vs backend) → separate `infra/bootstrap/` step before `backend "s3"` (TASK-002/003).
- **RISK-002**: Terraform/console drift → Terraform as single source of truth; `terraform plan` in CI (GUD-004).
- **RISK-003**: Malformed/non–My Maps URLs → validation + inline help (TASK-022).
- **RISK-004**: My Maps iframe blocked/private → fallback link (TASK-044).
- **RISK-005**: `favoriteCount` drift under concurrent toggles → accept minor eventual drift for MVP; consider stream-driven reconciler later.
- **RISK-006**: Gemini latency/cost → submit-only trigger (CON-003), bounded timeout, plain-search fallback.
- **RISK-007**: Gemini hallucinates trip IDs → strict candidate-set filtering (REQ-007, TEST-004).
- **RISK-008**: Amplify Hosting defaults to npm → explicit pnpm build spec (TASK-005/007).
- **RISK-009**: SSR + Cognito session edge cases → official adapter patterns (GUD-001).
- **ASSUMPTION-001**: Launch-scale dataset small enough for DynamoDB Option A search.
- **ASSUMPTION-002**: Single developer; milestone estimates from `docs/road-rash-plan.md` §5 hold.
- **ASSUMPTION-003**: Node 24 runtime locally, in Lambda (nodejs24.x), and in Amplify Hosting. (Bumped from Node 20: pnpm 11 requires Node ≥ 22.13, and Node 20 reaches EOL April 2026.)
- **ASSUMPTION-004**: Terraform ≥ 1.10 (for S3 native state locking).

## 8. Related Specifications / Further Reading

- `docs/road-rash-plan.md` — product/architecture plan (source of truth)
- `docs/architecture.md` — companion architecture document
- [Terraform S3 backend (state + native locking)](https://developer.hashicorp.com/terraform/language/settings/backends/s3)
- [Terraform AWS provider — Amplify, Cognito, API Gateway v2, Lambda, DynamoDB](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [API Gateway HTTP API JWT authorizer (Cognito)](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [AWS Amplify JS — use existing Cognito resources](https://docs.amplify.aws/javascript/build-a-backend/auth/use-existing-cognito-resources/)
- [Next.js App Router SSR with Amplify adapter](https://docs.amplify.aws/nextjs/build-a-backend/server-side-rendering/nextjs-app-router-server-components/)
