# Phase 1 — M0: Scaffold + Terraform bootstrap + Amplify Hosting

**Goal (GOAL-001):** Scaffold Next.js (pnpm), bootstrap Terraform with an S3 state
backend, and provision Amplify Hosting.

**Source tasks:** TASK-001 … TASK-007
**Depends on:** nothing (this is the first phase).
**Unlocks:** every later phase — the repo, IaC backend, and hosting pipeline.

---

## Prerequisites

- Node 20+ and `corepack` available (`corepack enable`).
- Terraform ≥ 1.10 (needed for S3 native state locking via `use_lockfile`).
- AWS credentials configured locally with permissions for S3, Amplify, IAM
  (and later: Cognito, API Gateway, Lambda, DynamoDB, SSM, CloudWatch).
- GitHub repo `HuyNguyen260398/road-rash` connected and a GitHub access token /
  Amplify GitHub App authorization ready for the hosting connection.

---

## TASK-001 — Scaffold the Next.js app

**Do:**
1. From the repo root: `pnpm create next-app@latest .` — choose **App Router**,
   **TypeScript**, ESLint on. (Tailwind optional but recommended for the
   mobile-first UI later.)
2. Add to `package.json`:
   - `"packageManager": "pnpm@<version>"` (pin the exact version you used).
   - `"engines": { "node": ">=20" }`.
3. Commit `pnpm-lock.yaml`.
4. Add a `.gitignore` entry for `.next/`, `node_modules/`, and Terraform state/dirs
   (`.terraform/`, `*.tfstate*`, `*.tfvars` if they hold secrets).

**Files:** `package.json`, `pnpm-lock.yaml`, `app/`, `next.config.*`, `tsconfig.json`.

**Done check:** `pnpm install` then `pnpm dev` serves `http://localhost:3000`
with the default page; `pnpm build` succeeds.

---

## TASK-002 — Bootstrap the Terraform state bucket (local state)

> **Why separate:** the S3 backend can't store its own bucket's creation. This
> step runs with **local** state, then later roots use the bucket as backend
> (RISK-001).

**Do:**
1. Create `infra/bootstrap/` with:
   - `main.tf` — `aws_s3_bucket` for state, plus:
     - `aws_s3_bucket_versioning` (Enabled),
     - `aws_s3_bucket_server_side_encryption_configuration` (SSE — `aws:kms` or `AES256`),
     - `aws_s3_bucket_public_access_block` (all four blocks `true`).
   - `variables.tf` (region, bucket name), `outputs.tf` (bucket name/ARN),
     `providers.tf` (AWS provider, region).
2. `terraform -chdir=infra/bootstrap init`
3. `terraform -chdir=infra/bootstrap apply` (review plan first).

**Files:** `infra/bootstrap/{main,variables,outputs,providers}.tf`.

**Done check:** the state bucket exists, is versioned, encrypted, and public-access
blocked; `terraform output` prints the bucket name.

---

## TASK-003 — Wire the S3 backend into the `infra/` root

**Do:**
1. Create the `infra/` root (`backend.tf`, `providers.tf`, `main.tf`, `variables.tf`,
   `outputs.tf`).
2. In `backend.tf`:
   ```hcl
   terraform {
     backend "s3" {
       bucket       = "<state-bucket-from-TASK-002>"
       key          = "env/<env>/terraform.tfstate"
       region       = "<region>"
       use_lockfile = true   # native S3 locking; no DynamoDB lock table (ALT-003)
       encrypt      = true
     }
   }
   ```
3. `terraform -chdir=infra init -migrate-state` (migrate any local state).
4. Write `infra/README.md` documenting the **bootstrap-before-backend** ordering,
   the per-env apply workflow, and how outputs feed Amplify env vars.

**Files:** `infra/{backend,providers,main,variables,outputs}.tf`, `infra/README.md`.

**Done check:** `terraform -chdir=infra init` succeeds against the S3 backend; a
lock file appears during `plan/apply`; `infra/README.md` explains the ordering.

---

## TASK-004 — Establish the module + per-env layout

**Do:**
1. Create empty (stubbed) module dirs, each with `main.tf`/`variables.tf`/`outputs.tf`:
   `infra/modules/{cognito,dynamodb,s3,lambda,apigateway,hosting,iam}`.
2. Create per-env roots: `infra/envs/{staging,prod}` each with `main.tf`
   (module composition), `backend.tf` (env-specific `key`), and `*.tfvars`.
3. Decide the canonical apply command: `terraform -chdir=infra/envs/<env> init|plan|apply`.

**Files:** `infra/modules/*/`, `infra/envs/{staging,prod}/`.

**Done check:** `terraform -chdir=infra/envs/staging init && ... validate` passes
with the empty module wiring; layout matches PAT-001.

---

## TASK-005 — `hosting` module: Amplify app + branches

**Do:**
1. In `infra/modules/hosting`, define:
   - `aws_amplify_app` connected to GitHub `HuyNguyen260398/road-rash`
     (repository + access token / GitHub App), with the platform set for SSR
     (`WEB_COMPUTE`).
   - `aws_amplify_branch` for `main` (prod) and `staging`.
   - Build settings using the pnpm spec (or reference the committed `amplify.yml`):
     `corepack enable && pnpm install --frozen-lockfile && pnpm build`.
2. Expose app ID / default domain as module outputs.

**Files:** `infra/modules/hosting/{main,variables,outputs}.tf`.

**Done check:** `terraform plan` shows the Amplify app + both branches; after apply,
the app appears in the Amplify console wired to the repo (RISK-008: build uses pnpm,
not npm).

---

## TASK-006 — Terraform outputs → Amplify env vars

**Do:**
1. Define root/`envs` outputs for: Cognito User Pool ID, User Pool Client ID,
   Identity Pool ID, Cognito domain, API base URL, region, thumbnails bucket.
   *(Some are placeholders until M1/M2 create them — wire the plumbing now.)*
2. Set `aws_amplify_app.environment_variables` (or per-branch) from those outputs,
   using `NEXT_PUBLIC_*` names for anything the browser needs (Cognito IDs, API
   base URL, region) — **never** secrets.

**Files:** `infra/modules/hosting/`, `infra/envs/*/`.

**Done check:** Amplify branch env vars are populated from Terraform outputs; the
Next.js app can read `process.env.NEXT_PUBLIC_*` at build/runtime.

---

## TASK-007 — Commit `amplify.yml` build spec

**Do:**
1. Add `amplify.yml` at the repo root with a pnpm-based build:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - corepack enable
           - pnpm install --frozen-lockfile
       build:
         commands:
           - pnpm build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
         - .next/cache/**/*
   ```
   *(Adjust `baseDirectory`/compute settings for Next.js SSR per the Amplify docs.)*

**Files:** `amplify.yml`.

**Done check:** a push to `staging` triggers an Amplify build that uses pnpm and
deploys the default Next.js page to the Amplify URL.

---

## Phase verification (M0 exit)

- [ ] `pnpm dev` and `pnpm build` work locally.
- [ ] `terraform -chdir=infra/envs/staging validate` passes.
- [ ] State lives in the S3 backend with locking; bootstrap ordering documented.
- [ ] Amplify builds `staging` with pnpm and serves the app from its URL.

## Task checklist

- [ ] TASK-001 — Next.js scaffold (pnpm, App Router, TS)
- [ ] TASK-002 — Bootstrap state bucket (local state)
- [ ] TASK-003 — `backend "s3"` + `init -migrate-state` + `infra/README.md`
- [ ] TASK-004 — Module + per-env layout
- [ ] TASK-005 — `hosting` module (Amplify app + branches)
- [ ] TASK-006 — Outputs → Amplify env vars
- [ ] TASK-007 — `amplify.yml` committed
