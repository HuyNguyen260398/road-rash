# Phase 3 — M2: DynamoDB + S3 + API Gateway + JWT authorizer + IAM

**Goal (GOAL-003):** Provision DynamoDB tables + GSIs, the S3 thumbnails bucket,
the base API Gateway + JWT authorizer, and Lambda IAM roles via Terraform.

**Source tasks:** TASK-015 … TASK-021
**Depends on:** Phase 2 (Cognito issuer/audience for the JWT authorizer).
**Unlocks:** all Lambda handlers + the frontend API client used in M3–M6.

---

## Prerequisites

- Phase 2 complete; Cognito issuer URL + client ID (audience) available as outputs.
- AWS SDK v3 + presigner available for Lambdas later (DEP-004); `esbuild` for
  bundling (DEP-005). These get added when handlers are written (M3).

---

## TASK-015 — `dynamodb` module: `Trip` table

**Do:**
1. `aws_dynamodb_table` `Trip`:
   - PK `id` (String); billing `PAY_PER_REQUEST`.
   - GSIs on `country`, `province`, `city`, `tripType`, `vehicle` (each projecting
     the attributes the card grid needs — KEYS_ONLY/INCLUDE/ALL per cost vs. need).
   - Keep `favoriteCount` as a plain attribute (denormalized counter — GUD-003;
     **never** computed by scanning `Favorite`).

**Files:** `infra/modules/dynamodb/{main,variables,outputs}.tf`.

**Done check:** table + 5 GSIs created; `terraform plan` is clean on re-run.

---

## TASK-016 — `dynamodb` module: `Favorite` table

**Do:**
1. `aws_dynamodb_table` `Favorite`:
   - Composite key enforcing uniqueness on (`tripId`, `userId`) — e.g. PK `tripId`,
     SK `userId` (or a composite PK). The write path uses a conditional put so a
     user can't favorite the same trip twice (TEST-007).
   - GSI on `userId` for the "saved trips" view (`GET /favorites`).

**Files:** `infra/modules/dynamodb/`.

**Done check:** table + `userId` GSI created; uniqueness key shape supports a
conditional-put dedupe.

---

## TASK-017 — `s3` module: thumbnails bucket

**Do:**
1. `aws_s3_bucket` (thumbnails) — private, `aws_s3_bucket_public_access_block`
   (all true), SSE enabled.
2. `aws_s3_bucket_cors_configuration` allowing browser `PUT` (presigned upload) and
   `GET` from the app origins; expose only needed headers; restrict `AllowedOrigins`
   to the app domains.

**Files:** `infra/modules/s3/{main,variables,outputs}.tf`.

**Done check:** bucket is private with public access blocked, encrypted, and CORS
permits presigned PUT/GET from the app origin only.

---

## TASK-018 — `iam` module: least-privilege Lambda roles

**Do:** one role/policy per Lambda (SEC-005), each scoped tightly:
- **trips:** `dynamodb:{GetItem,PutItem,UpdateItem,DeleteItem,Query}` on `Trip`
  (+ relevant GSIs).
- **favorites:** CRUD on `Favorite` + `UpdateItem` on `Trip` (for `favoriteCount`).
- **presign:** `s3:PutObject`/`GetObject` on the bucket's object prefix only.
- **suggest-trips:** `dynamodb:Query/GetItem` on `Trip` + `ssm:GetParameter` on the
  `gemini_api_key` name only.
- All roles: CloudWatch Logs write for their own log group.

**Files:** `infra/modules/iam/{main,variables,outputs}.tf`.

**Done check:** each policy names specific table/bucket-prefix/parameter ARNs — no
`Resource: "*"` beyond logs; `terraform validate` passes.

---

## TASK-019 — `apigateway` module: HTTP API + JWT authorizer

**Do:**
1. `aws_apigatewayv2_api` (protocol `HTTP`).
2. `aws_apigatewayv2_authorizer` (JWT) — issuer = Cognito pool issuer URL,
   audience = app client ID (SEC-002).
3. `aws_apigatewayv2_stage` (default, auto-deploy) with throttling/rate limits —
   tighter on the public `POST /suggest` route (RISK-006).
4. CORS configuration for the app origins.
5. Leave route definitions to be added with each handler (M3+), but establish the
   pattern: protected routes attach the JWT authorizer; public `GET` routes don't.

**Files:** `infra/modules/apigateway/{main,variables,outputs}.tf`.

**Done check:** API deployed with a default stage URL; JWT authorizer references
the Cognito issuer/audience; throttling configured; outputs the **API base URL**
(feeds Amplify env var + `lib/api-client.ts`).

---

## TASK-020 — `lambda` module (reusable)

**Do:**
1. Reusable module producing `aws_lambda_function` + `aws_lambda_permission`
   (for API Gateway invoke) + `aws_cloudwatch_log_group` per function.
2. Standardize TS → JS bundling with **esbuild** (Node 24 runtime) and zip
   packaging (e.g. `archive_file` or a build step that outputs the zip).
3. Inputs: handler name, role ARN (from `iam`), env vars (table names, bucket,
   **SSM parameter names** — not values), memory/timeout.

**Files:** `infra/modules/lambda/{main,variables,outputs}.tf`, build/bundling glue.

**Done check:** a trivial test function deploys, is invokable via its route, and
logs to its own CloudWatch group; bundling produces a zip from TS.

---

## TASK-021 — Frontend API client

**Do:**
1. `lib/api-client.ts` — typed `fetch` wrapper:
   - Reads API base URL from `NEXT_PUBLIC_*` env.
   - For protected calls, injects `Authorization: Bearer <idToken/accessToken>`
     from `fetchAuthSession()` (works in client; in SSR use server context).
   - Centralizes error handling + JSON parsing; exposes typed methods to be filled
     in as routes land (`getTrips`, `getTrip`, `createTrip`, …).

**Files:** `lib/api-client.ts`.

**Done check:** an authenticated call to a protected test route succeeds with the
JWT attached; an unauthenticated call to a public route succeeds without one.

---

## Phase verification (M2 exit)

- [ ] `Trip` + `Favorite` tables and all GSIs exist (PAY_PER_REQUEST).
- [ ] Thumbnails bucket is private/encrypted with correct CORS.
- [ ] HTTP API + JWT authorizer deployed; public vs. protected pattern established.
- [ ] Per-Lambda IAM roles are least-privilege; reusable `lambda` module works.
- [ ] `lib/api-client.ts` attaches the JWT for protected calls.
- [ ] `terraform plan` is clean for `staging` and `prod` (TEST-009).

## Task checklist

- [ ] TASK-015 — `Trip` table + GSIs
- [ ] TASK-016 — `Favorite` table + `userId` GSI
- [ ] TASK-017 — S3 thumbnails bucket + CORS
- [ ] TASK-018 — Per-Lambda least-privilege IAM
- [ ] TASK-019 — HTTP API + JWT authorizer + throttling
- [ ] TASK-020 — Reusable `lambda` module (esbuild bundling)
- [ ] TASK-021 — `lib/api-client.ts` JWT fetch wrapper
