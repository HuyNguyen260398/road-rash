# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production environment (`roadrash.nghuy.link`, isolated `road-rash-prod-*` data stores) with a manual-only CI deploy path, leaving staging untouched.

**Architecture:** Two phases. **Phase 1 (code, agent-executable):** bring the `infra/envs/prod` Terraform root to parity with staging (custom domain, CI terraform role, missing outputs, `branch_name = production`) and add a new manual-only `deploy-prod.yaml` workflow. **Phase 2 (operator runbook, run by the human with AWS creds):** the one-time bootstrap + two-pass `terraform apply`, secret wiring, GitHub Environment setup, and smoke test. Resource isolation is automatic — names derive from `project`+`environment`, so a prod apply creates separate tables/buckets in the same AWS account under state key `env/prod/terraform.tfstate`.

**Tech Stack:** Terraform (AWS provider ~> 5.0), GitHub Actions (OIDC), AWS Amplify Hosting, Cognito, DynamoDB, S3, API Gateway v2, Lambda (Node/esbuild), pnpm.

**Reference spec:** `docs/superpowers/specs/2026-06-20-production-deployment-design.md`

---

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `infra/envs/prod/variables.tf` | Modify | Add `custom_domain` var; change `branch_name` default to `production` |
| `infra/envs/prod/main.tf` | Modify | Pass `custom_domain` to hosting; set `create_terraform_role = true` on github_oidc |
| `infra/envs/prod/outputs.tf` | Modify | Add `github_terraform_role_arn` + `amplify_custom_domain_url` |
| `infra/envs/prod/example.tfvars` | Modify | `branch_name = production`; prod origins/callbacks at `roadrash.nghuy.link` |
| `.github/workflows/deploy-prod.yaml` | Create | Manual-only (`workflow_dispatch`) prod deploy pipeline |
| `docs/aws-deployment.md` | Modify | Document the prod manual workflow + `production` branch |

---

## Phase 1 — Code changes (agent-executable)

> All Phase 1 work happens on the `feature/production-deployment` branch. No AWS credentials needed — verification is `terraform fmt/validate/tflint` + YAML parse + `pnpm format:check`.

### Task 1: Prod Terraform parity with staging

**Files:**
- Modify: `infra/envs/prod/variables.tf`
- Modify: `infra/envs/prod/main.tf`
- Modify: `infra/envs/prod/outputs.tf`
- Modify: `infra/envs/prod/example.tfvars`

- [ ] **Step 1: Change the `branch_name` default to `production`**

In `infra/envs/prod/variables.tf`, replace the existing `branch_name` block:

```hcl
variable "branch_name" {
  description = "Git branch this environment deploys from."
  type        = string
  default     = "production"
}
```

(CI never passes `-var branch_name` — it relies on this default, mirroring staging's `"staging"` default.)

- [ ] **Step 2: Add the `custom_domain` variable**

Append to `infra/envs/prod/variables.tf` (copied from staging, hostname changed to prod):

```hcl
# --- Custom domain (hosting module) ---------------------------------------
# Attaches the prod Amplify branch to a Route53-hosted subdomain. zone_name must
# be an existing Route53 public hosted zone in this AWS account; hostname is the
# full host to serve. Terraform writes the ACM validation + CNAME records.
# Set to null to disable.
variable "custom_domain" {
  description = "Custom domain for the Amplify branch (zone_name = Route53 hosted zone, hostname = full host to serve). Null disables."
  type = object({
    zone_name = string
    hostname  = string
  })
  default = {
    zone_name = "nghuy.link"
    hostname  = "roadrash.nghuy.link"
  }
}
```

- [ ] **Step 3: Wire `custom_domain` into the hosting module**

In `infra/envs/prod/main.tf`, the `module "hosting"` block currently ends at `environment_variables = local.amplify_environment_variables`. Add the `custom_domain` line so the block reads:

```hcl
module "hosting" {
  source                = "../../modules/hosting"
  project               = var.project
  environment           = var.environment
  repository_url        = var.repository_url
  github_access_token   = var.github_access_token
  branch_name           = var.branch_name
  enable_auto_build     = var.enable_auto_build
  environment_variables = local.amplify_environment_variables
  custom_domain         = var.custom_domain
}
```

- [ ] **Step 4: Enable the CI terraform role on github_oidc**

In `infra/envs/prod/main.tf`, the `module "github_oidc"` block currently ends at `amplify_app_arn = module.hosting.app_arn`. Add the `create_terraform_role` line:

```hcl
module "github_oidc" {
  source             = "../../modules/github-oidc"
  project            = var.project
  environment        = var.environment
  repository         = replace(var.repository_url, "https://github.com/", "")
  github_environment = var.github_deploy_environment
  amplify_app_arn    = module.hosting.app_arn
  # CI assumes this to run `terraform apply` for prod via the manual deploy-prod
  # workflow (build:lambdas → apply), gated behind the Terraform checks.
  create_terraform_role = true
}
```

- [ ] **Step 5: Add the two missing outputs**

Append to `infra/envs/prod/outputs.tf`:

```hcl
output "github_terraform_role_arn" {
  description = "IAM role ARN the CI deploy job assumes for `terraform apply`. Set as AWS_TERRAFORM_ROLE_ARN in the matching GitHub Environment."
  value       = module.github_oidc.terraform_role_arn
}

output "amplify_custom_domain_url" {
  description = "HTTPS URL of the prod custom domain."
  value       = module.hosting.custom_domain_url
}
```

- [ ] **Step 6: Update `example.tfvars` with prod branch + origins**

In `infra/envs/prod/example.tfvars`, change `branch_name = "main"` to `branch_name = "production"`, and replace the `app_callback_urls`/`app_logout_urls` block with the prod origins (also add `app_origins`):

```hcl
branch_name = "production"

# OAuth redirect targets — KEEP the trailing slash (matches Amplify/Cognito).
app_callback_urls = ["http://localhost:3000/", "https://roadrash.nghuy.link/"]
app_logout_urls   = ["http://localhost:3000/", "https://roadrash.nghuy.link/"]

# CORS origins for API Gateway + S3 — NO trailing slash (scheme+host only).
app_origins = ["http://localhost:3000", "https://roadrash.nghuy.link"]
```

- [ ] **Step 7: Format, validate, and lint the prod root**

Run:

```bash
terraform -chdir=infra fmt -recursive
terraform -chdir=infra/envs/prod init -backend=false -input=false
terraform -chdir=infra/envs/prod validate
```

Expected: `fmt` reports the files it rewrote (or nothing), `init` succeeds, `validate` prints `Success! The configuration is valid.`

- [ ] **Step 8: TFLint the prod root**

Run:

```bash
tflint --init
tflint --chdir=infra/envs/prod --no-color -f compact --minimum-failure-severity=error
```

Expected: no error-severity findings (empty output / exit 0).

- [ ] **Step 9: Commit**

```bash
git add infra/envs/prod/variables.tf infra/envs/prod/main.tf infra/envs/prod/outputs.tf infra/envs/prod/example.tfvars
git commit -m "feat(infra): bring prod root to parity (custom domain, CI role, production branch)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Manual-only production deploy workflow

**Files:**
- Create: `.github/workflows/deploy-prod.yaml`

- [ ] **Step 1: Create the workflow file**

Write `.github/workflows/deploy-prod.yaml` with this exact content:

```yaml
name: Deploy to Production

# Manual-only production deploy. Unlike staging (deploy.yaml, which auto-deploys
# on push to main), prod ships ONLY when you run this workflow by hand
# (workflow_dispatch). Same verify + terraform gates, then build:lambdas →
# terraform apply the prod stack → Amplify RELEASE on the `production` branch.
# NOTE: workflow_dispatch only appears in the Actions UI once this file is on the
# default branch (main) — merge it before expecting the "Run workflow" button.
on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Git ref (branch, tag, or SHA) to deploy to production"
        required: true
        default: main

# Never cancel an in-flight prod deploy; serialize globally.
concurrency:
  group: deploy-prod
  cancel-in-progress: false

permissions:
  contents: read

env:
  AWS_REGION: ap-southeast-1
  # Amplify branch registered on the prod app that we RELEASE. The git branch of
  # the same name is force-advanced to the deployed ref below.
  AMPLIFY_BRANCH: production
  TF_VERSION: "1.10.5"
  TF_ROOTS: "infra/bootstrap infra/envs/staging infra/envs/prod"

jobs:
  verify:
    name: Lint, format, build, test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          ref: ${{ inputs.ref }}
      - name: Enable Corepack
        run: corepack enable
      - name: Setup Node
        uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Lint
        run: pnpm lint
      - name: Format check
        run: pnpm format:check
      - name: Build
        run: pnpm build
      - name: Test
        run: pnpm run --if-present test

  terraform-verify:
    name: Terraform fmt, validate & lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          ref: ${{ inputs.ref }}
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}
          terraform_wrapper: false
      - name: Terraform fmt (check)
        run: terraform -chdir=infra fmt -check -recursive -diff
      - name: Terraform init & validate (per root)
        run: |
          set -euo pipefail
          for root in $TF_ROOTS; do
            echo "::group::$root"
            terraform -chdir="$root" init -backend=false -input=false
            terraform -chdir="$root" validate -no-color
            echo "::endgroup::"
          done
      - name: Setup TFLint
        uses: terraform-linters/setup-tflint@v4
        with:
          tflint_version: latest
      - name: TFLint (per root)
        run: |
          set -euo pipefail
          tflint --init
          for root in $TF_ROOTS; do
            echo "::group::$root"
            tflint --chdir="$root" --no-color -f compact --minimum-failure-severity=error
            echo "::endgroup::"
          done

  deploy-backend:
    name: Build Lambdas & terraform apply (prod)
    needs: [verify, terraform-verify]
    runs-on: ubuntu-latest
    # The `production` GitHub Environment holds the deploy config (vars + secrets)
    # and any required-reviewer protection rule.
    environment: production
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          ref: ${{ inputs.ref }}
      - name: Preflight — required prod config present
        env:
          TF_STATE_BUCKET: ${{ vars.TF_STATE_BUCKET }}
          AWS_TERRAFORM_ROLE_ARN: ${{ vars.AWS_TERRAFORM_ROLE_ARN }}
          APP_ORIGINS: ${{ vars.APP_ORIGINS }}
          APP_CALLBACK_URLS: ${{ vars.APP_CALLBACK_URLS }}
          APP_LOGOUT_URLS: ${{ vars.APP_LOGOUT_URLS }}
          AMPLIFY_GITHUB_TOKEN: ${{ secrets.AMPLIFY_GITHUB_TOKEN }}
          GOOGLE_OAUTH_CLIENT_ID: ${{ secrets.GOOGLE_OAUTH_CLIENT_ID }}
          GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
        run: |
          set -euo pipefail
          missing=()
          for v in TF_STATE_BUCKET AWS_TERRAFORM_ROLE_ARN \
                   APP_ORIGINS APP_CALLBACK_URLS APP_LOGOUT_URLS \
                   AMPLIFY_GITHUB_TOKEN GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET; do
            if [ -z "${!v:-}" ]; then missing+=("$v"); fi
          done
          if [ ${#missing[@]} -gt 0 ]; then
            echo "::error::Missing required prod deploy config: ${missing[*]}"
            echo "Set these on the 'production' GitHub Environment (variables/secrets) — see docs/aws-deployment.md."
            exit 1
          fi
      - name: Enable Corepack
        run: corepack enable
      - name: Setup Node
        uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Build Lambda bundles
        run: pnpm build:lambdas
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}
          terraform_wrapper: false
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v5
        with:
          role-to-assume: ${{ vars.AWS_TERRAFORM_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - name: Terraform init (prod)
        env:
          TF_STATE_BUCKET: ${{ vars.TF_STATE_BUCKET }}
        run: |
          terraform -chdir=infra/envs/prod init -input=false \
            -backend-config="bucket=${TF_STATE_BUCKET}" \
            -backend-config="region=${AWS_REGION}"
      - name: Terraform plan (prod)
        env:
          APP_ORIGINS: ${{ vars.APP_ORIGINS }}
          APP_CALLBACK_URLS: ${{ vars.APP_CALLBACK_URLS }}
          APP_LOGOUT_URLS: ${{ vars.APP_LOGOUT_URLS }}
          AMPLIFY_GITHUB_TOKEN: ${{ secrets.AMPLIFY_GITHUB_TOKEN }}
          GOOGLE_OAUTH_CLIENT_ID: ${{ secrets.GOOGLE_OAUTH_CLIENT_ID }}
          GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
        run: |
          set -euo pipefail
          terraform -chdir=infra/envs/prod plan -out=prod.tfplan -input=false \
            -var="app_origins=${APP_ORIGINS}" \
            -var="app_callback_urls=${APP_CALLBACK_URLS}" \
            -var="app_logout_urls=${APP_LOGOUT_URLS}" \
            -var="github_access_token=${AMPLIFY_GITHUB_TOKEN}" \
            -var="google_oauth_client_id=${GOOGLE_OAUTH_CLIENT_ID}" \
            -var="google_oauth_client_secret=${GOOGLE_OAUTH_CLIENT_SECRET}"
      - name: Terraform apply (prod)
        run: |
          set -euo pipefail
          terraform -chdir=infra/envs/prod apply -input=false prod.tfplan

  deploy:
    name: Trigger Amplify Release
    needs: deploy-backend
    runs-on: ubuntu-latest
    environment: production
    permissions:
      id-token: write
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          fetch-depth: 0
          ref: ${{ inputs.ref }}
      - name: Sync production deploy branch to the deployed ref
        run: git push --force origin "HEAD:refs/heads/${{ env.AMPLIFY_BRANCH }}"
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v5
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - name: Start Amplify release and wait
        env:
          APP_ID: ${{ vars.AMPLIFY_APP_ID }}
          BRANCH: ${{ env.AMPLIFY_BRANCH }}
        run: |
          set -euo pipefail
          JOB_ID=$(aws amplify start-job \
            --app-id "$APP_ID" --branch-name "$BRANCH" \
            --job-type RELEASE \
            --query 'jobSummary.jobId' --output text)
          echo "Started Amplify job $JOB_ID for branch $BRANCH"
          while true; do
            STATUS=$(aws amplify get-job \
              --app-id "$APP_ID" --branch-name "$BRANCH" \
              --job-id "$JOB_ID" \
              --query 'job.summary.status' --output text)
            echo "status=$STATUS"
            case "$STATUS" in
              SUCCEED)          echo "✅ deploy succeeded"; exit 0 ;;
              FAILED|CANCELLED) echo "❌ deploy $STATUS"; exit 1 ;;
              *)                sleep 15 ;;
            esac
          done
```

- [ ] **Step 2: Verify the YAML parses**

Run:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-prod.yaml')); print('yaml ok')"
```

Expected: `yaml ok`

- [ ] **Step 3: Verify formatting**

Run:

```bash
pnpm format:check
```

Expected: PASS. If prettier flags the new file, run `pnpm format` then re-run `pnpm format:check`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-prod.yaml
git commit -m "ci: add manual-only production deploy workflow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Document the production deploy in the runbook

**Files:**
- Modify: `docs/aws-deployment.md`

- [ ] **Step 1: Add a "Production deploy (manual workflow)" subsection**

In `docs/aws-deployment.md`, after the existing "## CI deploy (automated, …)" section (the one describing `deploy.yaml` for staging), insert a new section:

````markdown
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
until the **first** apply. So the first prod stand-up is **manual** (two-pass, below);
the workflow takes over only after the `production` GitHub Environment is populated.

### Required `production` GitHub Environment config

Mirror the staging table with **prod** values:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `AWS_TERRAFORM_ROLE_ARN` | `terraform -chdir=infra/envs/prod output -raw github_terraform_role_arn` |
| Variable | `TF_STATE_BUCKET` | same state bucket as staging |
| Variable | `APP_ORIGINS` | `["https://roadrash.nghuy.link","http://localhost:3000"]` |
| Variable | `APP_CALLBACK_URLS` | `["https://roadrash.nghuy.link/"]` |
| Variable | `APP_LOGOUT_URLS` | `["https://roadrash.nghuy.link/"]` |
| Variable | `AMPLIFY_APP_ID` | `terraform -chdir=infra/envs/prod output -raw amplify_app_id` |
| Variable | `AWS_DEPLOY_ROLE_ARN` | `terraform -chdir=infra/envs/prod output -raw github_deploy_role_arn` |
| Secret | `AMPLIFY_GITHUB_TOKEN` | GitHub token for the Amplify repo connection |
| Secret | `GOOGLE_OAUTH_CLIENT_ID` | **reused** from staging (add a prod redirect URI in Google) |
| Secret | `GOOGLE_OAUTH_CLIENT_SECRET` | **reused** from staging |

Optionally add a **required-reviewer** protection rule on the `production`
environment for defense-in-depth (the manual `workflow_dispatch` is already a gate).
````

- [ ] **Step 2: Update Step 9 to name the production branch**

In the existing "### Step 9 — Promote to prod" checklist, update the last bullet so it reads:

```markdown
- [ ] Gate: `terraform -chdir=infra/envs/prod plan` shows **no unexpected diffs** (TEST-009);
      `apply`; deploy `main` to the **`production`** Amplify branch via the manual
      `deploy-prod.yaml` workflow.
```

- [ ] **Step 3: Verify formatting and commit**

```bash
pnpm format:check
git add docs/aws-deployment.md
git commit -m "docs(deploy): document manual production workflow + production GitHub Environment

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If `pnpm format:check` flags the doc, run `pnpm format` first.)

---

### Task 4: Open the PR for Phase 1

- [ ] **Step 1: Run the full local gate before pushing**

Run (matches the CI format-check gate):

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm build && pnpm test
terraform -chdir=infra fmt -check -recursive
```

Expected: all pass.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feature/production-deployment
gh pr create --base main --title "Production deployment: prod infra parity + manual deploy workflow" --body "$(cat <<'EOF'
Brings infra/envs/prod to parity with staging (custom domain roadrash.nghuy.link,
CI terraform role, production deploy branch) and adds a manual-only deploy-prod.yaml
workflow. Staging is untouched. Phase 2 (first apply + GitHub Environment + smoke
test) is an operator runbook in docs/superpowers/plans/2026-06-20-production-deployment.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Merge after review** (so `deploy-prod.yaml` lands on `main` and its `workflow_dispatch` button appears).

---

## Phase 2 — Operator deployment runbook (human-run, needs AWS creds)

> These steps require active AWS credentials for `ap-southeast-1` and access to the
> Google Cloud console + GitHub repo settings. An agent cannot run them unattended.
> Run them after Phase 1 merges. Each step has a verification checkpoint. Reference:
> `docs/aws-deployment.md` Steps 0–10.

### Op-1: Bundle Lambdas and init the prod backend

- [ ] `pnpm install && pnpm build:lambdas`
- [ ] `cp infra/envs/prod/backend.hcl.example infra/envs/prod/backend.hcl` and fill in the **existing** state bucket name (`terraform -chdir=infra/bootstrap output -raw state_bucket_name`) + region.
- [ ] `terraform -chdir=infra/envs/prod init -backend-config=backend.hcl`
- [ ] **Verify:** init reports "Successfully configured the backend 's3'".

### Op-2: First manual apply — Google IdP OFF

- [ ] Create a gitignored `infra/envs/prod/terraform.tfvars` from `example.tfvars` (prod origins already set; leave Google + Gemini unset).
- [ ] `export TF_VAR_github_access_token=ghp_xxx` (leave `TF_VAR_google_oauth_*` UNSET this pass).
- [ ] `terraform -chdir=infra/envs/prod plan -var-file=terraform.tfvars` — review.
- [ ] `terraform -chdir=infra/envs/prod apply -var-file=terraform.tfvars`
- [ ] **Verify & record:**
  ```bash
  terraform -chdir=infra/envs/prod output cognito_domain
  terraform -chdir=infra/envs/prod output -raw github_terraform_role_arn
  terraform -chdir=infra/envs/prod output -raw github_deploy_role_arn
  terraform -chdir=infra/envs/prod output -raw amplify_app_id
  terraform -chdir=infra/envs/prod output amplify_custom_domain_url
  ```
  Confirm `road-rash-prod-*` DynamoDB tables + S3 bucket now exist and are distinct from staging.

### Op-3: Register the prod redirect URI on the existing Google client (reuse)

- [ ] In the Google Cloud console → the **existing staging** OAuth client → Authorized redirect URIs, **add**:
      `https://<prod-cognito-domain>.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse`
- [ ] **Verify:** the staging URI is still present (don't remove it) and the new prod URI is saved.

### Op-4: Second manual apply — Google IdP ON

- [ ] `export TF_VAR_google_oauth_client_id=...` and `export TF_VAR_google_oauth_client_secret=...` (same values as staging).
- [ ] `terraform -chdir=infra/envs/prod apply -var-file=terraform.tfvars`
- [ ] **Verify:** apply creates the Google IdP + the `roadrash.nghuy.link` ACM-validation and CNAME Route53 records (`aws_route53_record.cert_verification`, `aws_route53_record.subdomain`). Custom-domain cert validation/propagation can take 15–45 min.

### Op-5: Set the prod Gemini key out-of-band (reuse the same value)

- [ ] ```bash
      aws ssm put-parameter --name /prod/road-rash/gemini_api_key \
        --type SecureString --value "$GEMINI_API_KEY" --overwrite
      ```
- [ ] **Verify:** `aws ssm get-parameter --name /prod/road-rash/gemini_api_key --with-decryption --query 'Parameter.Value' --output text` returns the real key (not `REPLACE_ME`).

### Op-6: Create and populate the `production` GitHub Environment

- [ ] GitHub → Settings → Environments → **New environment** `production` (optionally add a required-reviewer rule).
- [ ] Set the variables + secrets per the table in `docs/aws-deployment.md` → "Required `production` GitHub Environment config" (using the ARNs/IDs recorded in Op-2).
- [ ] **Verify:** all 7 variables + 3 secrets are present (the workflow preflight fails fast otherwise).

### Op-7: First CI-driven prod deploy

- [ ] GitHub → Actions → **Deploy to Production** → Run workflow → `ref = main`.
- [ ] **Verify:** all four jobs (`verify`, `terraform-verify`, `deploy-backend`, `deploy`) succeed; `deploy-backend` shows a no-op-or-minor apply (infra already stood up manually); the Amplify RELEASE on the `production` branch succeeds.

### Op-8: Production smoke test (TASK-050 / TEST-010)

- [ ] On `https://roadrash.nghuy.link`: sign in (Google) → create a trip with a thumbnail + valid My Maps URL → it appears on Home → search/filter finds it → favorite it (count updates, shows in Saved) → AI suggestion returns it → detail modal embeds the map → "Open in Google Maps" works on mobile.
- [ ] **Verify staging is unaffected:** `https://roadrash.stg.nghuy.link` still loads and works.
- [ ] Mark **TASK-049** and **TASK-050** complete (with date) in `docs/plan/feature-road-rash-mvp-1.md` and commit.

---

## Self-review notes

- **Spec coverage:** Change A → Task 1; Change B → Task 2; runbook (was Change C) → Phase 2 Op-1…Op-8; docs → Task 3. Smoke test (Verification) → Op-8. Reuse-secrets decision → Op-3/Op-4/Op-5. Manual-only trigger → Task 2 (`workflow_dispatch` only). Custom domain → Task 1 + Op-4. All spec sections map to tasks.
- **Out of scope honored:** no staging branch rename, no separate account/state bucket, no app code changes.
- **Type/name consistency:** output names (`github_terraform_role_arn`, `amplify_custom_domain_url`, `github_deploy_role_arn`, `amplify_app_id`) match the github-oidc/hosting module outputs and the GitHub Environment variable names used in `deploy-prod.yaml` (`AWS_TERRAFORM_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`, `AMPLIFY_APP_ID`). `branch_name` default (`production`) matches `AMPLIFY_BRANCH: production`.
