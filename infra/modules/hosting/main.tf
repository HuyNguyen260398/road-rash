# hosting module — AWS Amplify Hosting for the Next.js SSR app (TASK-005).
#
# One Amplify app per environment, each tracking a single branch
# (staging env → `staging`, prod env → `main`). This keeps each environment's
# hosting resources in that environment's own Terraform state, consistent with
# the per-env root layout. Amplify is hosting/CI only — there is no Amplify Gen 2
# backend (CON-004).

locals {
  name_prefix = "${var.project}-${var.environment}"

  # pnpm build spec (RISK-008: Amplify defaults to npm, so this is explicit).
  # corepack activates the pnpm version pinned in package.json#packageManager.
  default_build_spec = <<-YAML
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
  YAML
}

resource "aws_amplify_app" "this" {
  name       = local.name_prefix
  repository = var.repository_url

  # GitHub access token / Amplify GitHub App token. Secret — supplied at apply
  # time (TF_VAR_github_access_token), never committed. Null is fine for
  # validate/plan-without-connect.
  access_token = var.github_access_token

  # WEB_COMPUTE = SSR (Next.js server rendering), not a static SPA.
  platform   = "WEB_COMPUTE"
  build_spec = coalesce(var.build_spec, local.default_build_spec)

  enable_branch_auto_build = var.enable_auto_build

  # App-level env vars (browser-safe NEXT_PUBLIC_* values come from Terraform
  # outputs — see TASK-006). Never put secrets here.
  environment_variables = var.environment_variables

  # Optional service role granting Amplify SSR compute permission to write logs.
  iam_service_role_arn = var.iam_service_role_arn

  # access_token is write-only — the Amplify API never returns it, and it's only
  # needed to establish the repo connection on create. Re-applying without it (or
  # with a different value) makes Terraform send an empty accessToken on
  # UpdateApp, which the API rejects ("length >= 1"). Ignore post-create changes
  # so routine applies — including CI, which need not pass the token for an
  # already-connected app — don't churn it. To rotate the token, set it and
  # `terraform apply -replace=module.hosting.aws_amplify_app.this` (or taint).
  lifecycle {
    ignore_changes = [access_token]
  }
}

resource "aws_amplify_branch" "this" {
  app_id      = aws_amplify_app.this.id
  branch_name = var.branch_name

  framework = "Next.js - SSR"
  stage     = var.environment == "prod" ? "PRODUCTION" : "DEVELOPMENT"

  enable_auto_build = var.enable_auto_build

  # Per-branch overrides on top of the app-level env vars.
  environment_variables = var.branch_environment_variables
}

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
