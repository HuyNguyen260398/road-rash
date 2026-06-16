# Design: custom domain `roadrash.stg.nghuy.link` for staging

Date: 2026-06-15
Status: Approved (pending spec review)

## Goal

Serve the deployed **staging** Amplify app at the custom subdomain
`roadrash.stg.nghuy.link`, using the existing Route53 public hosted zone for
`nghuy.link` (same AWS account). The apex/`roadrash.nghuy.link` is reserved for a
future prod environment, hence the `stg` label for staging.

Everything is provisioned through Terraform — no manual AWS console edits — per
the project's "Terraform owns all AWS resources" rule.

## Context (as found on disk)

- Staging Amplify app id `d1kr94dtjbjs6h`, branch **`staging`**, current URL
  `https://staging.d1kr94dtjbjs6h.amplifyapp.com`.
- The `hosting` module (`infra/modules/hosting`) creates `aws_amplify_app` +
  `aws_amplify_branch`. It has **no** custom-domain resource today.
- OAuth/CORS allowlists are **not** driven by Terraform variable defaults. Real
  values are supplied at apply time via `-var=`:
  - CI: GitHub Actions variables `APP_ORIGINS` / `APP_CALLBACK_URLS` /
    `APP_LOGOUT_URLS` (see `.github/workflows/deploy.yaml`).
  - Local: the gitignored `infra/envs/staging/terraform.tfvars`.
  Current values contain only `http://localhost:3000(/)` and the
  `staging.d1kr94dtjbjs6h.amplifyapp.com` origin.

## Decisions (locked during brainstorming)

1. Target the **staging** Amplify app (only env currently deployed).
2. Subdomain is `roadrash.stg.nghuy.link` (prefix `roadrash.stg` on zone
   `nghuy.link`).
3. The `nghuy.link` hosted zone is in the **same AWS account** → Terraform writes
   the DNS validation + CNAME records automatically.
4. Also wire the new origin into **Cognito OAuth + CORS** so sign-in and API/S3
   calls work from the new domain.

## Approach

Extend the reusable `hosting` module with an **optional, gated** custom-domain
capability rather than inlining resources in the staging root. When the new
`custom_domain` variable is `null`, no new resources are created — zero impact on
any environment that does not set it. Prod can later reuse the same module with
prefix `roadrash` (no `stg`).

## Component changes

### 1. `infra/modules/hosting`

**`variables.tf`** — new variable:

```hcl
variable "custom_domain" {
  description = <<-DESC
    Optional custom domain for the Amplify branch. Null = no custom domain.
    domain_name is the Route53 public zone (e.g. "nghuy.link"); subdomain_prefix
    is the label(s) in front of it (e.g. "roadrash.stg" -> roadrash.stg.nghuy.link).
  DESC
  type = object({
    domain_name      = string
    subdomain_prefix = string
  })
  default = null
}
```

**`main.tf`** — new resources, all gated on `var.custom_domain != null`:

- `data "aws_route53_zone" "this"` — `name = var.custom_domain.domain_name`,
  `private_zone = false`.
- `aws_amplify_domain_association "this"`:
  - `app_id = aws_amplify_app.this.id`
  - `domain_name = var.custom_domain.domain_name`
  - `wait_for_verification = false` (don't block apply on ACM/CloudFront
    propagation; we create the DNS records ourselves)
  - one `sub_domain { branch_name = aws_amplify_branch.this.branch_name, prefix = var.custom_domain.subdomain_prefix }`
  - Amplify-managed TLS cert (default) — no separate `aws_acm_certificate`.
- `aws_route53_record "cert_verification"` — parses the space-delimited
  `certificate_verification_dns_record` (`<name> <type> <value>`) via `split`,
  trims trailing dots, `allow_overwrite = true`, `ttl = 300`.
- `aws_route53_record "subdomain"` — `for_each` over
  `aws_amplify_domain_association.this[0].sub_domain`, parsing each `dns_record`
  (`<name> CNAME <target>`) the same way, `ttl = 300`.

**`outputs.tf`** — new output:

```hcl
output "custom_domain_url" {
  description = "HTTPS URL of the custom domain, or null if none configured."
  value       = var.custom_domain != null ? "https://${var.custom_domain.subdomain_prefix}.${var.custom_domain.domain_name}" : null
}
```

### 2. `infra/envs/staging`

- **`variables.tf`** — new `custom_domain` variable (same object type) with
  default `{ domain_name = "nghuy.link", subdomain_prefix = "roadrash.stg" }` so
  CI applies it with no extra configuration.
- **`main.tf`** — pass `custom_domain = var.custom_domain` into `module "hosting"`.
- **`outputs.tf`** — new `amplify_custom_domain_url = module.hosting.custom_domain_url`.
- **`example.tfvars`** — document the `custom_domain` block.

### 3. OAuth + CORS allowlists (two real sources)

Add the new origin in **both** places that supply these vars at apply time:

- **Local** `infra/envs/staging/terraform.tfvars` (gitignored):
  - `app_callback_urls` += `"https://roadrash.stg.nghuy.link/"` (trailing slash)
  - `app_logout_urls`   += `"https://roadrash.stg.nghuy.link/"` (trailing slash)
  - `app_origins`       += `"https://roadrash.stg.nghuy.link"` (no trailing slash)
- **CI** GitHub Actions variables `APP_CALLBACK_URLS`, `APP_LOGOUT_URLS`,
  `APP_ORIGINS` — update via `gh` CLI (with explicit confirmation, since it is an
  outward change to repo config) or by hand in the GitHub UI. These must include
  the same new entries or the next CI apply would revert the allowlists.

## Apply & verification (runbook, not code)

1. `pnpm build:lambdas` (the lambda module zips `dist/`, which is gitignored).
2. `terraform -chdir=infra/envs/staging plan -var-file=terraform.tfvars` (supply
   secrets via `TF_VAR_*`), review, then `apply`.
3. Amplify cert verification + CloudFront propagation can take ~15–45 min;
   `wait_for_verification = false` means apply returns promptly.
4. Known provider quirk: the first create can return empty `dns_record` /
   `certificate_verification_dns_record`, leaving the Route53 records uncreated.
   If so, re-run `apply` once the attributes are populated.
5. Verify:
   - `aws amplify get-domain-association --app-id d1kr94dtjbjs6h --domain-name nghuy.link`
   - `dig +short roadrash.stg.nghuy.link`
   - load `https://roadrash.stg.nghuy.link` and exercise Google sign-in.

## Out of scope

- Prod custom domain (`roadrash.nghuy.link`) — deferred until the prod stack is
  applied (TASK-049). The module supports it via the same variable.
- Apex (`nghuy.link`) / `www` redirects.
- Changing the Amplify branch mapping.
