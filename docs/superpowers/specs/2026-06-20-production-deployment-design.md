# Production Deployment — Design

**Date:** 2026-06-20
**Status:** Approved (design)
**Tasks:** Closes TASK-049 (prod `terraform apply` + deploy) and TASK-050 (prod smoke test).

## Goal

Stand up the production environment for road-rash with fully isolated data stores,
its own custom domain `roadrash.nghuy.link`, and a **manual-only** CI deploy path —
without disturbing the existing staging environment more than the agreed branch
rename requires.

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Data isolation | Separate `road-rash-prod-*` DynamoDB tables + S3 thumbnails bucket, **same AWS account** as staging. Already structural (resource names derive from `project`+`environment`); a prod apply creates them automatically. |
| Deploy mechanism | Prod is wired into CI as a **separate workflow file**, triggered **manually only** (`workflow_dispatch`). No push automation. |
| Prod deploy branch | `production` (Amplify branch + git deploy pointer). |
| Staging deploy branch | **Unchanged** (`staging`) for now — rename to `internal-release` deferred to later work. |
| Secrets | **Reuse** staging's Google OAuth client (add a prod redirect URI) and the **same Gemini key value** (written to prod's own SSM parameter). |
| Domain | `roadrash.nghuy.link` (Route53 zone `nghuy.link` already exists). |
| Prod env protection | `workflow_dispatch` is the gate. A required-reviewer rule on the `production` GitHub Environment is **optional/recommended** defense-in-depth. |

## Context — current state

- `infra/envs/prod` is a complete Terraform root composing every module like staging,
  with its own state key `env/prod/terraform.tfstate`. It has **never been applied** —
  there are no live prod AWS resources.
- The `hosting` module fully supports custom domains (Route53 zone lookup + ACM
  validation record + subdomain CNAME), gated on `var.custom_domain`.
- Staging currently deploys the Amplify branch `staging` (`infra/envs/staging/terraform.tfvars`
  `branch_name = "staging"`); `.github/workflows/deploy.yaml` force-pushes `main` →
  `refs/heads/staging` and triggers an Amplify RELEASE on that branch.
- Prod's `branch_name` defaults to `main`.

## Gaps in `infra/envs/prod` vs staging (to close)

1. No `custom_domain` variable, and `main.tf` doesn't pass `custom_domain` to the
   `hosting` module.
2. `github_oidc` module is missing `create_terraform_role = true` (no CI terraform role).
3. `outputs.tf` is missing `github_terraform_role_arn` and `amplify_custom_domain_url`.
4. `branch_name` is `main`, not `production`.

## Changes

### A. Prod Terraform parity — `infra/envs/prod`

- **`variables.tf`**: add the `custom_domain` object variable (copied from staging) with
  default `{ zone_name = "nghuy.link", hostname = "roadrash.nghuy.link" }`.
- **`main.tf`**: pass `custom_domain = var.custom_domain` to the `hosting` module; set
  `create_terraform_role = true` on the `github_oidc` module.
- **`outputs.tf`**: add `github_terraform_role_arn` and `amplify_custom_domain_url`
  (mirroring staging).
- **`example.tfvars`**: set `branch_name = "production"`; add prod `app_origins` /
  `app_callback_urls` / `app_logout_urls` pointing at `https://roadrash.nghuy.link`
  (plus the Amplify default domain once known). The real gitignored
  `terraform.tfvars` is created during deployment.

Because prod's final hostname is known up front, callback/logout/origin URLs can be set
to `https://roadrash.nghuy.link` from the first apply — no waiting on the Amplify default
domain.

### B. New prod workflow — `.github/workflows/deploy-prod.yaml`

- Trigger: **`workflow_dispatch` only**, with an optional `ref` input (default `main`)
  selecting what to release.
- Jobs (each gating the next), all backend/release jobs bound to `environment: production`:
  1. `verify` — `pnpm lint / format:check / build / test` (mirrors deploy.yaml).
  2. `terraform-verify` — `terraform fmt -check` + `validate` + `tflint` across roots.
  3. `deploy-backend-prod` — preflight required prod config → `pnpm build:lambdas` →
     OIDC assume prod terraform role → `init` with prod state key → `plan -out` → `apply`.
  4. `deploy-prod` — force-push the chosen ref → `refs/heads/production`, then start +
     wait on an Amplify RELEASE for the `production` branch.
- `AMPLIFY_BRANCH: production`; `gemini_api_key` intentionally NOT passed (placeholder
  seed + out-of-band SSM), matching staging.

### C. Manual one-time prerequisites (deployment runbook)

These cannot be (or should not be) automated and happen around the **first** prod apply:

1. **State backend:** `cp infra/envs/prod/backend.hcl.example → backend.hcl`, fill in the
   existing state bucket name, `terraform -chdir=infra/envs/prod init -backend-config=backend.hcl`.
2. **First apply is manual & two-pass** (chicken-and-egg): the CI terraform role doesn't
   exist until the first apply creates it, and Google's redirect URI needs the prod Cognito
   Hosted UI domain. Sequence: apply with Google IdP **off** → read `cognito_domain` →
   register redirect URI in Google → apply with IdP **on**.
3. **Google OAuth (reuse):** add
   `https://<prod-cognito-domain>.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse`
   as an authorized redirect URI on the existing staging Google client; pass the same
   client id/secret to prod.
4. **Gemini key (reuse):** after apply,
   `aws ssm put-parameter --name /prod/road-rash/gemini_api_key --type SecureString --value "$SAME_KEY" --overwrite`.
5. **`production` GitHub Environment:** create it (optionally with a required-reviewer
   protection rule) and set the same var/secret set staging uses, with **prod values**:
   - Variables: `AWS_TERRAFORM_ROLE_ARN` (from `github_terraform_role_arn`),
     `TF_STATE_BUCKET`, `APP_ORIGINS`, `APP_CALLBACK_URLS`, `APP_LOGOUT_URLS`,
     `AMPLIFY_APP_ID`, `AWS_DEPLOY_ROLE_ARN`.
   - Secrets: `AMPLIFY_GITHUB_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
6. **Route53:** `nghuy.link` zone already exists; Terraform writes the `roadrash.nghuy.link`
   ACM-validation + CNAME records. No manual DNS.
7. **Docs:** update `docs/aws-deployment.md` (prod Step 9 specifics: branch `production`,
   manual workflow) and the TASK-049/050 status rows in
   `docs/plan/feature-road-rash-mvp-1.md`.

## Verification

End-to-end smoke test (TASK-050 / TEST-010) on `https://roadrash.nghuy.link`:
sign in → create a trip (thumbnail + valid My Maps URL) → appears on Home → search/filter
finds it → favorite it (count updates, shows in Saved) → AI suggestion returns it → detail
modal embeds the map → "Open in Google Maps" works on mobile. Staging is untouched by this
work and should continue serving at `roadrash.stg.nghuy.link`.

## Out of scope

- Separate AWS account or separate Terraform state bucket for prod (same account, shared
  state bucket, separate state key).
- Push-triggered prod automation (prod is manual `workflow_dispatch` only).
- Renaming the staging deploy branch `staging` → `internal-release` (deferred to later
  work; staging is left untouched here).
- Any application/feature code changes — this is infra + CI only.
