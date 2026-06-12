# road-rash — AWS Deployment Guide & To-Do

> **Status:** All Terraform is written and `validate`-clean for M0–M3, M5 (Cognito/SSM)
> and M6, but **no `terraform apply` has run yet — there are zero live AWS resources.**
> This doc is the consolidated checklist for standing the infrastructure up, derived
> from `plan/steps/phase-*.md`, `infra/README.md`, and the env composition in
> `infra/envs/{staging,prod}/main.tf`.

---

## ⚠️ Read first — two blockers that aren't "just apply"

1. **M4 favorites is now implemented (code-complete, apply deferred).** As of
   2026-06-12:
   - `services/favorites/handler.ts` + `validate.ts` (unit-tested) handle
     `GET/POST/DELETE /favorites` — conditional-put dedupe + atomic `favoriteCount`.
   - `services/build.mjs` bundles `favorites`; `pnpm build:lambdas` emits its `dist/`.
   - `infra/envs/{staging,prod}/main.tf` wire the `lambda_favorites` module,
     integration, and the three JWT-gated routes; both roots `terraform validate`-clean.
   - Frontend: `FavoritesProvider` (optimistic heart), `app/saved/` view, and OG
     metadata on `app/trip/[id]/`.

   It is **not applied** (same deferred-apply posture as the rest). The live check
   still owed is **TEST-007** (favorite bumps count; unfavorite reverses; no
   double-favorite) — run it after `terraform apply` (Step 8 below).

2. **`terraform apply` has never run.** The "✓ validate / apply deferred" notes across
   the phase files mean every live check (sign-in, CRUD persistence, presign upload,
   AI suggestions, JWT 403s) is **still outstanding** and can only be verified after apply.

---

## What's already done (no AWS action needed)

- Terraform modules: `cognito, dynamodb, s3, iam, lambda, apigateway, ssm, hosting` — all written.
- Env roots `staging` + `prod` compose them; `terraform validate` passes for both.
- Lambda handlers `trips`, `presign`, `suggest-trips` written + unit-tested (`pnpm test` green).
- App reads config from `NEXT_PUBLIC_*` Amplify env vars (wired in `hosting` module).

## What requires AWS / external action (the to-do)

Three categories: **manual console prerequisites**, **Terraform applies**, and
**out-of-band secrets**. The ordering between them matters — see the sequenced checklist.

---

## Prerequisites (one-time, manual)

- [ ] **AWS credentials** with permissions for: S3, DynamoDB, Lambda, API Gateway v2,
      Cognito, IAM, SSM, CloudWatch Logs, Amplify. Default region: **`ap-southeast-1`**.
- [ ] **Terraform ≥ 1.10** (native S3 state locking via `use_lockfile`).
- [ ] **Node 24+ / pnpm** (corepack) — needed for `pnpm build:lambdas`.
- [ ] **Google OAuth 2.0 client** (TASK-008, Google Cloud Console):
      consent screen (external, scopes `openid email profile`); a Web OAuth client;
      record **client ID + secret**. Redirect URIs are filled in *after* the Cognito
      domain exists (chicken-and-egg — see the two-pass note below).
- [ ] **GitHub access token / Amplify GitHub App** authorization for
      `HuyNguyen260398/road-rash` (Amplify → repo connection).
- [ ] **Gemini API key** (Google AI Studio) — set out-of-band into SSM, never via tfvars.

---

## Secrets — how each is supplied (never commit, never in state)

| Secret | How it's passed | Notes |
|--------|-----------------|-------|
| `github_access_token` | `export TF_VAR_github_access_token=ghp_xxx` at apply | Amplify repo connection |
| `google_oauth_client_id` / `_secret` | `export TF_VAR_google_oauth_client_id=…` / `_secret=…` | Leaving unset skips the Google IdP so you can apply the pool first |
| Gemini key | `aws ssm put-parameter --name /<env>/road-rash/gemini_api_key --type SecureString --value "$KEY" --overwrite` **after** apply | **Do NOT** set `TF_VAR_gemini_api_key` to the real key — `aws_ssm_parameter.value` is persisted in state. Apply with the `REPLACE_ME` placeholder, then overwrite out-of-band. |

---

## Sequenced deployment checklist (staging first, then prod)

### Step 0 — Bundle the Lambdas (required before every plan/apply)
- [ ] `pnpm install`
- [ ] `pnpm build:lambdas` — produces `services/{trips,favorites,presign,suggest-trips}/dist/index.js`
      (the `lambda` module zips `dist/`, which is gitignored). **Re-run after any handler change.**

### Step 1 — Bootstrap the Terraform state bucket (once per AWS account)
- [ ] `terraform -chdir=infra/bootstrap init`
- [ ] `terraform -chdir=infra/bootstrap apply` (review plan)
- [ ] `terraform -chdir=infra/bootstrap output state_bucket_name` → note the name

### Step 2 — Point the staging env at the state bucket
- [ ] `cp infra/envs/staging/backend.hcl.example infra/envs/staging/backend.hcl`
      and fill in `bucket` (from Step 1) + `region`.
- [ ] `terraform -chdir=infra/envs/staging init -backend-config=backend.hcl`

### Step 3 — First staging apply (pool/domain first, Google IdP off)
> Two-pass because Google's redirect URI needs the Cognito Hosted UI domain, which
> doesn't exist until the pool is applied.
- [ ] Leave `TF_VAR_google_oauth_client_id/_secret` **unset** (skips the Google IdP).
- [ ] `export TF_VAR_github_access_token=…`
- [ ] `terraform -chdir=infra/envs/staging plan` → review
- [ ] `terraform -chdir=infra/envs/staging apply`
- [ ] `terraform -chdir=infra/envs/staging output` → record `cognito_domain`,
      `amplify_branch_url`, `api_base_url`, etc.

### Step 4 — Register the app in Google + Cognito callbacks
- [ ] In Google OAuth client, add **Authorized redirect URI**:
      `https://<cognito_domain>.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse`
- [ ] Update staging tfvars / vars so `app_callback_urls`, `app_logout_urls`, and
      `app_origins` include the real **Amplify branch URL** (from Step 3), not just
      `http://localhost:3000`.

### Step 5 — Second staging apply (turn on Google IdP)
- [ ] `export TF_VAR_google_oauth_client_id=…` and `TF_VAR_google_oauth_client_secret=…`
- [ ] `terraform -chdir=infra/envs/staging apply` (now creates the Google IdP +
      updated callback/CORS URLs)

### Step 6 — Set the real Gemini key out-of-band
- [ ] `aws ssm put-parameter --name /staging/road-rash/gemini_api_key
      --type SecureString --value "$GEMINI_API_KEY" --overwrite`

### Step 7 — Deploy the frontend via Amplify
- [ ] Push the `staging` branch (or trigger the Amplify build). The committed
      `amplify.yml` builds with pnpm; env vars come from Terraform outputs.
- [ ] Confirm the build uses pnpm and the branch serves at its Amplify URL.

### Step 8 — Live verification on staging (the deferred checks)
Run the checks the phase files marked "deferred to apply":
- [ ] Google → Cognito sign-in works; session readable client + SSR (M1 exit).
- [ ] Public `GET /trips` works without a token; `POST/PUT/DELETE` reject missing JWT;
      editing another user's trip returns **403** (TEST-005/006).
- [ ] Presign rejects oversized/non-image; valid request returns a working PUT URL;
      thumbnails render via presigned GET (TEST-008).
- [ ] Search/filter/group over `GET /trips` query params returns expected results (M5).
- [ ] `POST /suggest` returns only validated, candidate-set IDs; key never hits the
      browser; hard throttle (burst 5 / rate 2) holds (TEST-004, RISK-006).

### Step 9 — Promote to prod (repeat Steps 2–8 for `infra/envs/prod`)
- [ ] `cp infra/envs/prod/backend.hcl.example infra/envs/prod/backend.hcl`; init.
- [ ] Configure prod tfvars: `branch_name = main`, prod `app_origins` /
      `app_callback_urls` / `app_logout_urls` (the prod Amplify domain).
- [ ] Register the **prod** Cognito domain redirect URI in the Google OAuth client.
- [ ] Two-pass apply (IdP off → register → IdP on), then set the prod Gemini key in SSM.
- [ ] `terraform -chdir=infra/envs/prod plan` shows **no unexpected diffs** (TEST-009);
      `apply`; deploy `main` via Amplify.

### Step 10 — End-to-end prod smoke test (TASK-050 / TEST-010)
- [ ] Sign in → create a trip (thumbnail + valid My Maps URL) → appears on Home →
      search finds it → favorite it (count updates, shows in Saved) → AI returns it →
      detail modal embeds the map → "Open in Google Maps" works on mobile.
- [ ] **Note:** the favorite/Saved steps depend on M4 being implemented (see top blocker).

---

## Resources Terraform will create per environment

- **DynamoDB:** `Trip` (PK `id`, 5 GSIs on country/province/city/tripType/vehicle,
  PAY_PER_REQUEST) + `Favorite` (composite `tripId`/`userId`, `userId` GSI).
- **S3:** private thumbnails bucket (public-access blocked, SSE, CORS for presigned PUT/GET).
- **Cognito:** User Pool + app client + Hosted UI domain + Google IdP + Identity Pool (+ roles).
- **API Gateway v2 (HTTP):** JWT authorizer (Cognito issuer/audience), default auto-deploy
  stage, CORS, per-route throttles (`POST /suggest` burst 5 / rate 2; `POST /trips` burst 10 / rate 5).
- **Lambda:** `trips`, `favorites`, `presign`, `suggest-trips` (+ log groups, least-privilege IAM roles).
- **SSM SecureString:** `/<env>/road-rash/gemini_api_key` (+ Google OAuth params per the cognito module).
- **Amplify Hosting:** app + branch, env vars populated from Terraform outputs.

## Routes currently wired (`apigateway` module)

Public (no JWT): `GET /trips`, `GET /trips/{id}`, `GET /uploads/thumbnail`, `POST /suggest`.
JWT-required: `POST /trips`, `PUT /trips/{id}`, `DELETE /trips/{id}`, `POST /uploads/presign`,
`GET /favorites`, `POST /favorites`, `DELETE /favorites/{tripId}`.

---

## Validate offline anytime (no AWS creds)

```bash
terraform -chdir=infra/envs/staging init -backend=false
terraform -chdir=infra/envs/staging validate
terraform -chdir=infra fmt -check -recursive
pnpm test && pnpm build
```

## Key references
- `infra/README.md` — bootstrap-before-backend ordering, per-env workflow.
- `plan/steps/phase-1…9` — per-task detail and Done checks.
- `infra/envs/staging/example.tfvars`, `backend.hcl.example` — exact var/secret handling.
