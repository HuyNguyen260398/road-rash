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
