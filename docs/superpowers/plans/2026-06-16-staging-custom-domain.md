# Staging Custom Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the deployed staging Amplify app at `https://roadrash.stg.nghuy.link`, fully provisioned through Terraform (Amplify domain association + Route53 records), with the new origin wired into Cognito OAuth and CORS.

**Architecture:** Add an optional, `null`-gated `custom_domain` capability to the reusable `infra/modules/hosting` module (Amplify domain association + a Route53 zone lookup + two `aws_route53_record`s parsed from the association's computed DNS-record strings). The staging root opts in via a `custom_domain` variable defaulted to `nghuy.link` / `roadrash.stg`. The OAuth/CORS allowlists are updated in their two real sources: the local gitignored `terraform.tfvars` and the GitHub Actions repo variables consumed by CI.

**Tech Stack:** Terraform (AWS provider — `aws_amplify_domain_association`, `aws_route53_record`, `aws_route53_zone` data source), AWS Amplify Hosting, Route53, the `gh` CLI for GitHub Actions variables.

**Design doc:** `docs/superpowers/specs/2026-06-15-staging-custom-domain-design.md`

**Verification model (read first):** This is infrastructure with no unit-test suite. The "test" gate for code tasks is, in order:
1. `terraform fmt -check -recursive infra` (formatting)
2. `terraform -chdir=infra/envs/staging init -backend=false` then `terraform -chdir=infra/envs/staging validate` (type/reference checking — no AWS creds or state needed)

A real `terraform plan`/`apply` (Task 6) needs AWS credentials + secrets and is run manually by the operator, not by an automated executor.

---

## File Structure

- `infra/modules/hosting/variables.tf` — **Modify.** Add the `custom_domain` input variable.
- `infra/modules/hosting/main.tf` — **Modify.** Add the zone data source, domain association, and two Route53 records (all gated).
- `infra/modules/hosting/outputs.tf` — **Modify.** Add `custom_domain_url`.
- `infra/envs/staging/variables.tf` — **Modify.** Add the `custom_domain` variable defaulted to the staging domain.
- `infra/envs/staging/main.tf` — **Modify.** Pass `custom_domain` into `module "hosting"`.
- `infra/envs/staging/outputs.tf` — **Modify.** Surface `amplify_custom_domain_url`.
- `infra/envs/staging/example.tfvars` — **Modify.** Document the `custom_domain` block (committed, no secrets).
- `infra/envs/staging/terraform.tfvars` — **Modify.** Gitignored local allowlists — add the new origin. NOT committed.
- GitHub Actions repo variables `APP_ORIGINS` / `APP_CALLBACK_URLS` / `APP_LOGOUT_URLS` — **Modify** via `gh` (Task 5).

---

### Task 1: Add `custom_domain` variable to the hosting module

**Files:**
- Modify: `infra/modules/hosting/variables.tf` (append at end)

- [ ] **Step 1: Append the variable**

Add to the end of `infra/modules/hosting/variables.tf`:

```hcl

variable "custom_domain" {
  description = <<-DESC
    Optional custom domain for the Amplify branch. Null = no custom domain.
    domain_name is an existing Route53 public zone (e.g. "nghuy.link");
    subdomain_prefix is the label(s) in front of it (e.g. "roadrash.stg" ->
    roadrash.stg.nghuy.link). The zone must already exist in this AWS account;
    the module writes the ACM validation + CNAME records into it.
  DESC
  type = object({
    domain_name      = string
    subdomain_prefix = string
  })
  default = null
}
```

- [ ] **Step 2: Format check**

Run: `terraform fmt -check infra/modules/hosting/variables.tf`
Expected: exits 0 (no output). If it reports a diff, run `terraform fmt infra/modules/hosting/variables.tf` and re-check.

- [ ] **Step 3: Commit**

```bash
git add infra/modules/hosting/variables.tf
git commit -m "feat(hosting): add optional custom_domain variable"
```

---

### Task 2: Add domain association + Route53 records to the hosting module

**Files:**
- Modify: `infra/modules/hosting/main.tf` (append at end)

- [ ] **Step 1: Append the resources**

Add to the end of `infra/modules/hosting/main.tf`:

```hcl

# --- Custom domain (optional) ---------------------------------------------
# Attach the branch to a Route53-hosted subdomain. Everything here is gated on
# var.custom_domain; null leaves it all uncreated so envs without a custom
# domain are unaffected. The zone must already exist in this AWS account.

data "aws_route53_zone" "this" {
  count        = var.custom_domain != null ? 1 : 0
  name         = var.custom_domain.domain_name
  private_zone = false
}

resource "aws_amplify_domain_association" "this" {
  count       = var.custom_domain != null ? 1 : 0
  app_id      = aws_amplify_app.this.id
  domain_name = var.custom_domain.domain_name

  # We create the DNS records below ourselves, so don't block apply on Amplify's
  # ACM verification + CloudFront propagation (can take 15-45 min).
  wait_for_verification = false

  sub_domain {
    branch_name = aws_amplify_branch.this.branch_name
    prefix      = var.custom_domain.subdomain_prefix
  }
}

# ACM DNS-validation record for the Amplify-managed cert. The association exposes
# it as a single space-delimited "<name> <type> <value>" string.
resource "aws_route53_record" "cert_verification" {
  count           = var.custom_domain != null ? 1 : 0
  zone_id         = data.aws_route53_zone.this[0].zone_id
  name            = trimsuffix(element(split(" ", aws_amplify_domain_association.this[0].certificate_verification_dns_record), 0), ".")
  type            = element(split(" ", aws_amplify_domain_association.this[0].certificate_verification_dns_record), 1)
  ttl             = 300
  records         = [trimsuffix(element(split(" ", aws_amplify_domain_association.this[0].certificate_verification_dns_record), 2), ".")]
  allow_overwrite = true
}

# CNAME for each subdomain, pointing at the Amplify CloudFront endpoint. Each
# sub_domain's dns_record is a "<name> CNAME <target>" string.
resource "aws_route53_record" "subdomain" {
  for_each = var.custom_domain != null ? {
    for sd in aws_amplify_domain_association.this[0].sub_domain : sd.prefix => sd.dns_record
  } : {}

  zone_id         = data.aws_route53_zone.this[0].zone_id
  name            = trimsuffix(element(split(" ", each.value), 0), ".")
  type            = element(split(" ", each.value), 1)
  ttl             = 300
  records         = [trimsuffix(element(split(" ", each.value), 2), ".")]
  allow_overwrite = true
}
```

- [ ] **Step 2: Format check**

Run: `terraform fmt -check infra/modules/hosting/main.tf`
Expected: exits 0. If it reports a diff, run `terraform fmt infra/modules/hosting/main.tf` and re-check.

- [ ] **Step 3: Commit**

```bash
git add infra/modules/hosting/main.tf
git commit -m "feat(hosting): amplify domain association + route53 records"
```

---

### Task 3: Add the `custom_domain_url` output to the hosting module

**Files:**
- Modify: `infra/modules/hosting/outputs.tf` (append at end)

- [ ] **Step 1: Append the output**

Add to the end of `infra/modules/hosting/outputs.tf`:

```hcl

output "custom_domain_url" {
  description = "HTTPS URL of the custom domain, or null if none configured."
  value       = var.custom_domain != null ? "https://${var.custom_domain.subdomain_prefix}.${var.custom_domain.domain_name}" : null
}
```

- [ ] **Step 2: Format check**

Run: `terraform fmt -check infra/modules/hosting/outputs.tf`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add infra/modules/hosting/outputs.tf
git commit -m "feat(hosting): output custom_domain_url"
```

---

### Task 4: Wire the custom domain into the staging root

**Files:**
- Modify: `infra/envs/staging/variables.tf` (append at end)
- Modify: `infra/envs/staging/main.tf` (the `module "hosting"` block)
- Modify: `infra/envs/staging/outputs.tf` (append at end)
- Modify: `infra/envs/staging/example.tfvars` (append at end)

- [ ] **Step 1: Add the staging `custom_domain` variable**

Append to `infra/envs/staging/variables.tf`:

```hcl

# --- Custom domain (hosting module) ---------------------------------------
# Attaches the staging Amplify branch to a Route53-hosted subdomain. The zone
# (domain_name) must already exist in this AWS account; Terraform writes the ACM
# validation + CNAME records. Set to null to disable.
variable "custom_domain" {
  description = "Custom domain for the Amplify branch (domain_name = Route53 zone, subdomain_prefix = labels in front). Null disables."
  type = object({
    domain_name      = string
    subdomain_prefix = string
  })
  default = {
    domain_name      = "nghuy.link"
    subdomain_prefix = "roadrash.stg"
  }
}
```

- [ ] **Step 2: Pass it into the hosting module**

In `infra/envs/staging/main.tf`, find the `module "hosting"` block (currently ends with `environment_variables = local.amplify_environment_variables`). Add the `custom_domain` argument so the block reads:

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

- [ ] **Step 3: Add the staging output**

Append to `infra/envs/staging/outputs.tf`:

```hcl

output "amplify_custom_domain_url" {
  description = "HTTPS URL of the staging custom domain."
  value       = module.hosting.custom_domain_url
}
```

- [ ] **Step 4: Document it in example.tfvars**

Append to `infra/envs/staging/example.tfvars`:

```hcl

# Custom domain — attaches the Amplify branch to a Route53-hosted subdomain.
# Defaulted in variables.tf to nghuy.link / roadrash.stg; override or set to
# null here to change/disable. The zone must already exist in this AWS account.
# custom_domain = {
#   domain_name      = "nghuy.link"
#   subdomain_prefix = "roadrash.stg"
# }
```

- [ ] **Step 5: Format check**

Run: `terraform fmt -check -recursive infra`
Expected: exits 0. If it reports diffs, run `terraform fmt -recursive infra` and re-check.

- [ ] **Step 6: Init (no backend) and validate**

Run:
```bash
terraform -chdir=infra/envs/staging init -backend=false -input=false
terraform -chdir=infra/envs/staging validate -no-color
```
Expected: `Success! The configuration is valid.` If validate reports an error about the `sub_domain` set reference or a missing attribute, re-read Task 2 — the `for_each` must key on `sd.prefix` and value `sd.dns_record`.

- [ ] **Step 7: Commit**

```bash
git add infra/envs/staging/variables.tf infra/envs/staging/main.tf infra/envs/staging/outputs.tf infra/envs/staging/example.tfvars
git commit -m "feat(staging): attach custom domain roadrash.stg.nghuy.link"
```

---

### Task 5: Add the new origin to the OAuth + CORS allowlists

The new domain must be added in BOTH places that supply these vars at apply time
(see the design doc): the local gitignored `terraform.tfvars` (local applies) and
the GitHub Actions repo variables (CI applies). Editing only one leaves the
allowlist inconsistent between local and CI.

**Files:**
- Modify: `infra/envs/staging/terraform.tfvars` (gitignored — NOT committed)
- Modify (external): GitHub Actions repo variables via `gh`

- [ ] **Step 1: Update the local terraform.tfvars allowlists**

Edit `infra/envs/staging/terraform.tfvars` so the three lists include the new
origin (keep the trailing slash on callback/logout; none on origins):

```hcl
app_callback_urls = [
  "http://localhost:3000/",
  "https://staging.d1kr94dtjbjs6h.amplifyapp.com/",
  "https://roadrash.stg.nghuy.link/",
]
app_logout_urls = [
  "http://localhost:3000/",
  "https://staging.d1kr94dtjbjs6h.amplifyapp.com/",
  "https://roadrash.stg.nghuy.link/",
]

app_origins = [
  "http://localhost:3000",
  "https://staging.d1kr94dtjbjs6h.amplifyapp.com",
  "https://roadrash.stg.nghuy.link",
]
```

(This file is gitignored — do NOT `git add` it. Nothing to commit for this step.)

- [ ] **Step 2: Inspect the current GitHub Actions variables**

These feed CI's `terraform apply` via `-var=`. Read current values first:

Run:
```bash
gh variable list --repo HuyNguyen260398/road-rash
gh variable get APP_ORIGINS --repo HuyNguyen260398/road-rash
gh variable get APP_CALLBACK_URLS --repo HuyNguyen260398/road-rash
gh variable get APP_LOGOUT_URLS --repo HuyNguyen260398/road-rash
```
Expected: HCL-list-formatted strings (matching the `-var` usage in `.github/workflows/deploy.yaml`). Note their exact current contents. If the variables are defined at the `staging` GitHub *Environment* level rather than repo level, add `--env staging` to these and the `set` commands below.

> **STOP — confirm before writing.** Updating GitHub Actions variables is an outward change to repo config and affects the next CI deploy. Get explicit operator confirmation, and use the exact current value from Step 2 (append the new entry; don't retype from memory) so nothing is dropped.

- [ ] **Step 3: Set the updated variables**

For each variable, take the current value from Step 2 and add the new entry,
preserving HCL list syntax. Example shape (substitute the real current contents):

```bash
gh variable set APP_ORIGINS --repo HuyNguyen260398/road-rash \
  --body '["http://localhost:3000","https://staging.d1kr94dtjbjs6h.amplifyapp.com","https://roadrash.stg.nghuy.link"]'

gh variable set APP_CALLBACK_URLS --repo HuyNguyen260398/road-rash \
  --body '["http://localhost:3000/","https://staging.d1kr94dtjbjs6h.amplifyapp.com/","https://roadrash.stg.nghuy.link/"]'

gh variable set APP_LOGOUT_URLS --repo HuyNguyen260398/road-rash \
  --body '["http://localhost:3000/","https://staging.d1kr94dtjbjs6h.amplifyapp.com/","https://roadrash.stg.nghuy.link/"]'
```

- [ ] **Step 4: Verify**

Run:
```bash
gh variable get APP_ORIGINS --repo HuyNguyen260398/road-rash
gh variable get APP_CALLBACK_URLS --repo HuyNguyen260398/road-rash
gh variable get APP_LOGOUT_URLS --repo HuyNguyen260398/road-rash
```
Expected: each now contains the `roadrash.stg.nghuy.link` entry alongside the originals.

---

### Task 6: Apply and verify (operator runbook — requires AWS credentials)

This task provisions real AWS resources and is run manually by the operator with
AWS credentials and the required `TF_VAR_*` secrets. Do NOT automate it.

- [ ] **Step 1: Build the Lambda bundles**

The lambda module zips `dist/` (gitignored), so build first or the plan/apply fails.

Run: `pnpm build:lambdas`
Expected: each `services/<name>/dist/index.js` is (re)built, no errors.

- [ ] **Step 2: Plan**

Provide secrets via env (`TF_VAR_github_access_token`, `TF_VAR_google_oauth_client_id`, `TF_VAR_google_oauth_client_secret`; leave `gemini_api_key` at its placeholder). Then:

Run:
```bash
terraform -chdir=infra/envs/staging init -input=false
terraform -chdir=infra/envs/staging plan -var-file=terraform.tfvars -out=staging.tfplan
```
Expected additions in the plan:
- `module.hosting.aws_amplify_domain_association.this[0]`
- `module.hosting.aws_route53_record.cert_verification[0]`
- `module.hosting.data.aws_route53_zone.this[0]` (read)
- `module.hosting.aws_route53_record.subdomain[0]`
- Cognito user-pool client + API Gateway/S3 CORS changes reflecting the new origin.

Both Route53 records use `count` (not `for_each`), so their addresses are static and they plan cleanly even though the record values (`dns_record`) are unknown until apply — no for_each/unknown-key error. If the Amplify API returns an empty `dns_record` immediately on first association create (a rare provider quirk), the records' `records` value would be empty; if so, re-run plan/apply once after the association settles.

- [ ] **Step 3: Apply**

Run: `terraform -chdir=infra/envs/staging apply -input=false staging.tfplan`
Expected: apply completes; `amplify_custom_domain_url = "https://roadrash.stg.nghuy.link"` in outputs.

- [ ] **Step 4: Wait for verification, then check**

Amplify cert verification + CloudFront propagation takes ~15-45 min. Check status:

Run:
```bash
aws amplify get-domain-association --app-id d1kr94dtjbjs6h --domain-name nghuy.link \
  --query "domainAssociation.{status:domainStatus,sub:subDomains[].{prefix:subDomainSetting.prefix,verified:verified}}"
dig +short roadrash.stg.nghuy.link
```
Expected: `domainStatus` progresses to `AVAILABLE`; `dig` returns the CloudFront CNAME target. If the domain association is stuck `PENDING_VERIFICATION` and the Route53 records hold empty values (the rare empty-`dns_record`-on-first-create quirk), re-run Steps 2-3 once after the association settles.

- [ ] **Step 5: End-to-end smoke**

Open `https://roadrash.stg.nghuy.link`, confirm TLS is valid and the app loads,
then exercise Google sign-in (verifies the Cognito callback allowlist) and a
favorite/create action (verifies CORS via `app_origins`).

---

## Self-Review notes

- **Spec coverage:** hosting module changes (Tasks 1-3), staging wiring + output (Task 4), OAuth+CORS in both real sources (Task 5), apply/verify runbook incl. the first-create re-apply caveat and `pnpm build:lambdas` (Task 6). All design sections covered.
- **Type consistency:** `custom_domain` object `{ domain_name, subdomain_prefix }` is identical in the module and the staging root; `subdomain` resource keys on `sd.prefix` ("roadrash.stg") with value `sd.dns_record`, matching the Task 6 plan output `subdomain["roadrash.stg"]`; output name `custom_domain_url` (module) → `amplify_custom_domain_url` (root) used consistently.
- **No placeholders:** every code step shows the exact HCL/commands; the only intentional human-in-the-loop gap is substituting the real current GitHub variable contents in Task 5 Step 3, which is unavoidable (their current values aren't knowable until Step 2 reads them).
