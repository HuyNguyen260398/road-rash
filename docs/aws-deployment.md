# road-rash — AWS Deployment Guide & Runbook

> **Status:** **Decommissioned on 2026-07-03.** The staging and production stacks and
> the dedicated Terraform state bucket were destroyed through reviewed Terraform plans;
> there are zero live road-rash application resources in AWS. This is the single source
> for standing an environment up **from zero**: rationale + secret-handling up top, then
> a command-level checklist.
> Derived from `docs/plan/steps/phase-*.md`, `infra/README.md`, and the env composition in
> `infra/envs/{staging,prod}/main.tf`.

Conventions: region `ap-southeast-1`, project `road-rash`. Run Terraform from a per-env
root: `terraform -chdir=infra/envs/<env> <cmd>`. Do **staging first**, verify (Step 8),
then repeat Steps 2–8 for prod (Step 9). Secrets are never committed and never put in
tfvars that hit state (see the secrets table).

---

## ⚠️ Read first — environment is intentionally offline

- Both environment remote states were emptied before the backend was deleted.
- `road-rash-tfstate-010382427026` no longer exists. Start at Step 1 to recreate it.
- The per-environment GitHub Actions IAM roles were deleted, so deployment workflows
  cannot recreate infrastructure until the manual bootstrap/apply sequence is completed.
- The shared `nghuy.link` Route53 hosted zone and account-level GitHub Actions OIDC
  provider were intentionally preserved because this project only reads them as data sources.
- The teardown execution record is `plan/infrastructure-aws-teardown-1.md`.

---

## What's already done (no AWS action needed)

- Terraform modules: `cognito, dynamodb, s3, iam, lambda, apigateway, ssm, hosting` — all written.
- Env roots `staging` + `prod` compose them; `terraform validate` passes for both.
- Lambda handlers `trips`, `favorites`, `presign`, `suggest-trips` written + unit-tested (`pnpm test` green).
- App reads config from `NEXT_PUBLIC_*` Amplify env vars (wired in `hosting` module).

---

## Prerequisites (one-time, manual — gate everything below)

- [ ] **AWS credentials** active for `ap-southeast-1`, with permissions for: S3, DynamoDB,
      Lambda, API Gateway v2, Cognito, IAM, SSM, CloudWatch Logs, Amplify.
- [ ] **Terraform ≥ 1.10** (native S3 state locking via `use_lockfile`).
- [ ] **Node 24+ / pnpm** (corepack) — needed for `pnpm build:lambdas`.
- [ ] **Google OAuth 2.0 client** (TASK-008, Google Cloud Console):
      consent screen (external, scopes `openid email profile`); a Web OAuth client;
      record **client ID + secret**. Redirect URIs are filled in *after* the Cognito
      domain exists (chicken-and-egg — see the two-pass note at Step 3).
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

```bash
pnpm install
pnpm build:lambdas   # → services/{trips,favorites,presign,suggest-trips}/dist/index.js
```

`dist/` is gitignored and zipped by the `lambda` module — **re-run after any handler change.**

### Step 1 — Bootstrap the Terraform state bucket (once per AWS account)

```bash
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap apply                    # review plan first
terraform -chdir=infra/bootstrap output state_bucket_name # note the name for Step 2
```

### Step 2 — Point the staging env at the state bucket

```bash
cp infra/envs/staging/backend.hcl.example infra/envs/staging/backend.hcl
#   → fill in bucket (from Step 1) + region
terraform -chdir=infra/envs/staging init -backend-config=backend.hcl
```

### Step 3 — First staging apply (pool/domain first, Google IdP OFF)

> Two-pass because Google's redirect URI needs the Cognito Hosted UI domain, which
> doesn't exist until the pool is applied.

```bash
export TF_VAR_github_access_token=ghp_xxx     # leave Google vars UNSET this pass
terraform -chdir=infra/envs/staging plan      # review
terraform -chdir=infra/envs/staging apply
terraform -chdir=infra/envs/staging output    # record cognito_domain, amplify_branch_url, api_base_url
```

### Step 4 — Register the app in Google + set callback URLs

- [ ] In the Google OAuth client, add **Authorized redirect URI**:
      `https://<cognito_domain>.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse`
- [ ] In a gitignored `infra/envs/staging/terraform.tfvars`, set `app_callback_urls`,
      `app_logout_urls`, `app_origins` to include the real **Amplify branch URL** from
      Step 3 (not just `http://localhost:3000`).

### Step 5 — Second staging apply (Google IdP ON)

```bash
export TF_VAR_google_oauth_client_id=...
export TF_VAR_google_oauth_client_secret=...
terraform -chdir=infra/envs/staging apply -var-file=terraform.tfvars
```

### Step 6 — Set the real Gemini key out-of-band (never via Terraform)

```bash
aws ssm put-parameter --name /staging/road-rash/gemini_api_key \
  --type SecureString --value "$GEMINI_API_KEY" --overwrite
```

> The module seeds a `REPLACE_ME` placeholder; this overwrites it and later applies won't revert it.

### Step 7 — Deploy the frontend via Amplify

- [ ] Push the `staging` branch (or trigger the Amplify build). The committed `amplify.yml`
      builds with pnpm; env vars come from Terraform outputs.
- [ ] Confirm the build uses pnpm and the branch serves at its Amplify URL.

### Step 8 — Live verification on staging (the deferred checks)

Run the checks the phase files marked "deferred to apply":

- [ ] Google → Cognito sign-in works; session readable client + SSR (M1 exit).
- [ ] Public `GET /trips` works without a token; `POST/PUT/DELETE` reject missing JWT;
      editing another user's trip returns **403** (TEST-005/006).
- [ ] Presign rejects oversized/non-image; valid request returns a working PUT URL;
      thumbnails render via presigned GET (TEST-008).
- [ ] **TEST-007 (M4):** favorite bumps count + shows in `/saved`; unfavorite reverses;
      double-favorite is a no-op.
- [ ] Search/filter/group over `GET /trips` query params returns expected results (M5).
- [ ] `POST /suggest` returns only validated, candidate-set IDs; key never hits the
      browser; hard throttle (burst 5 / rate 2) holds (TEST-004, RISK-006).

### Step 9 — Promote to prod (repeat Steps 2–8 for `infra/envs/prod`)

- [ ] `cp infra/envs/prod/backend.hcl.example infra/envs/prod/backend.hcl`; `init -backend-config=backend.hcl`.
- [ ] Configure prod tfvars: `branch_name = production`, prod `app_origins` /
      `app_callback_urls` / `app_logout_urls` (the prod Amplify domain).
- [ ] Register the **prod** Cognito domain redirect URI in the Google OAuth client.
- [ ] Two-pass apply (IdP off → register → IdP on), then set the prod Gemini key:
      `aws ssm put-parameter --name /prod/road-rash/gemini_api_key ...`.
- [ ] Gate: `terraform -chdir=infra/envs/prod plan` shows **no unexpected diffs** (TEST-009);
      `apply`; deploy `main` to the **`production`** Amplify branch via the manual
      `deploy-prod.yaml` workflow.

### Step 10 — End-to-end prod smoke test (TASK-050 / TEST-010)

- [ ] Sign in → create a trip (thumbnail + valid My Maps URL) → appears on Home →
      search finds it → favorite it (count updates, shows in Saved) → AI returns it →
      detail modal embeds the map → "Open in Google Maps" works on mobile.

---

## CI deploy (automated, after the one-time manual bootstrap above)

Once staging has been applied manually at least once (Steps 1–7), pushes to
`main` deploy it automatically via `.github/workflows/deploy.yaml`. The workflow
runs four jobs, each gating the next:

1. **verify** — `pnpm lint / format:check / build / test`.
2. **terraform-verify** — `terraform fmt -check` + `validate` + `tflint` across all
   roots (same checks as `tf-ci.yaml`).
3. **deploy-backend** — `pnpm build:lambdas`, then `terraform plan -out` and
   `terraform apply` of that saved plan on `infra/envs/staging` (this is what
   ships Lambda code + infra changes). Plan gates apply: a failed plan stops the
   job, and apply runs the exact plan that was shown in the logs.
4. **deploy** — fast-forwards the `staging` branch to main and triggers the
   Amplify RELEASE for the frontend.

### One-time setup to enable the `terraform apply` job

The deploy job assumes a **separate** broad-permission OIDC role
(`<project>-staging-gha-terraform`, created by the `github-oidc` module with
`create_terraform_role = true`). Because Terraform creates that role, you must
run **one manual `terraform apply`** (Step 5) after pulling this change so the
role exists, then read its ARN:

```bash
terraform -chdir=infra/envs/staging output -raw github_terraform_role_arn
```

It attaches AWS-managed **PowerUserAccess** plus a project-scoped IAM policy
(manage only `<project>-*` roles/policies). That is intentionally broad — review
it (`infra/modules/github-oidc/main.tf`) before enabling.

### Required `staging` GitHub Environment config

Set these on the **staging** GitHub Environment (Settings → Environments →
staging). The deploy-backend job **fails fast** (preflight) if any are missing,
so it can never silently revert live config:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `AWS_TERRAFORM_ROLE_ARN` | ARN from `github_terraform_role_arn` above |
| Variable | `TF_STATE_BUCKET` | state bucket (`terraform -chdir=infra/bootstrap output -raw state_bucket_name`) |
| Variable | `APP_ORIGINS` | HCL list literal, e.g. `["https://staging.example.com","http://localhost:3000"]` |
| Variable | `APP_CALLBACK_URLS` | HCL list, e.g. `["https://staging.example.com/"]` |
| Variable | `APP_LOGOUT_URLS` | HCL list, e.g. `["https://staging.example.com/"]` |
| Secret | `AMPLIFY_GITHUB_TOKEN` | GitHub token for the Amplify repo connection (`TF_VAR_github_access_token`) |
| Secret | `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client id |
| Secret | `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret |

The list-typed variables must hold the **same values** the manual apply used —
otherwise the apply would change CORS/OAuth back to the defaults. `gemini_api_key`
is deliberately **not** wired into CI: the SSM module keeps the placeholder seed
and the real key is set out-of-band (Step 6), so CI apply never overwrites it.
(`AWS_DEPLOY_ROLE_ARN` and `AMPLIFY_APP_ID` for the Amplify-release job stay as
before.)

---

## Production deploy (manual workflow)

Prod is **never** auto-deployed. `.github/workflows/deploy-prod.yaml` ships it and
runs **only** on manual `workflow_dispatch` (Actions tab → "Deploy to Production" →
Run workflow → pick the `ref`). The button only appears once the workflow file is
on the default branch (`main`).

It runs the same gates as staging (`verify`, `terraform-verify`) then
`deploy-backend` (`pnpm build:lambdas` → `terraform apply infra/envs/prod`) and
`deploy` (Amplify RELEASE on the **`production`** branch). Both deploy jobs use the
**`production`** GitHub Environment.

**Bootstrap ordering (chicken-and-egg):** the CI terraform role
(`github_terraform_role_arn`) and the prod Cognito Hosted UI domain don't exist
until the **first** apply. So the first prod stand-up is **manual** (two-pass, see
Step 9 above); the workflow takes over only after the `production` GitHub
Environment is populated.

### Required `production` GitHub Environment config

Mirror the staging table with **prod** values:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `AWS_TERRAFORM_ROLE_ARN` | `terraform -chdir=infra/envs/prod output -raw github_terraform_role_arn` |
| Variable | `TF_STATE_BUCKET` | same bucket as staging — `terraform -chdir=infra/bootstrap output -raw state_bucket_name` |
| Variable | `APP_ORIGINS` | `["https://roadrash.nghuy.link"]` (live domain only — no localhost) |
| Variable | `APP_CALLBACK_URLS` | `["https://roadrash.nghuy.link/"]` |
| Variable | `APP_LOGOUT_URLS` | `["https://roadrash.nghuy.link/"]` |
| Variable | `AMPLIFY_APP_ID` | `terraform -chdir=infra/envs/prod output -raw amplify_app_id` |
| Variable | `AWS_DEPLOY_ROLE_ARN` | `terraform -chdir=infra/envs/prod output -raw github_deploy_role_arn` |
| Secret | `AMPLIFY_GITHUB_TOKEN` | GitHub token for the Amplify repo connection |
| Secret | `GOOGLE_OAUTH_CLIENT_ID` | **reused** from staging (add a prod redirect URI in Google) |
| Secret | `GOOGLE_OAUTH_CLIENT_SECRET` | **reused** from staging |

Optionally add a **required-reviewer** protection rule on the `production`
environment for defense-in-depth (the manual `workflow_dispatch` is already a gate).

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
- `docs/plan/steps/phase-1…9` — per-task detail and Done checks.
- `infra/envs/staging/example.tfvars`, `backend.hcl.example` — exact var/secret handling.
