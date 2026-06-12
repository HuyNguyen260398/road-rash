# github-oidc module — per-environment IAM role assumed by GitHub Actions via
# OIDC (no static AWS keys) to trigger an Amplify RELEASE deploy. The
# account-level OIDC provider is created once in infra/bootstrap; this looks it
# up by URL and scopes a role to exactly one GitHub Environment + one Amplify app
# (least privilege — the role can do nothing but start/poll that app's jobs).
locals {
  name_prefix = "${var.project}-${var.environment}"

  # When a workflow job sets `environment:`, the OIDC token's `sub` claim is
  # `repo:<owner>/<repo>:environment:<name>` — tie the trust to exactly that, so
  # only the gated deploy job for this env can assume the role.
  github_sub = "repo:${var.repository}:environment:${var.github_environment}"
}

# The account-level GitHub provider created in infra/bootstrap (singleton).
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# Trust policy: federate to the GitHub provider, require the AWS STS audience,
# and pin the subject to this repo's GitHub Environment.
data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_sub]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${local.name_prefix}-gha-amplify-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

# Minimal deploy permissions: start a RELEASE job on this env's Amplify app and
# poll its status. Scoped to the app's branches/jobs — nothing wider.
data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "AmplifyRelease"
    effect    = "Allow"
    actions   = ["amplify:StartJob", "amplify:GetJob"]
    resources = ["${var.amplify_app_arn}/branches/*/jobs/*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${local.name_prefix}-gha-amplify-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
