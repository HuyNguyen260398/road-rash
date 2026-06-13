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

# --- Terraform-apply role (opt-in via create_terraform_role) ----------------
# A separate, broad-permission role the CI deploy job assumes to run
# `terraform apply` for this environment. Kept distinct from the Amplify-only
# `deploy` role above so the minimal release job never inherits infra power.
# Trust is the same pinned GitHub-Environment subject (data.aws_iam_policy_document.assume).
#
# Tradeoff (accepted): running `terraform apply` for the whole stack needs
# wide access. We attach the AWS-managed PowerUserAccess (every service EXCEPT
# IAM/Organizations/Account) and add a narrow IAM policy below scoped to this
# project's roles/policies, rather than granting AdministratorAccess.
data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

resource "aws_iam_role" "terraform" {
  count              = var.create_terraform_role ? 1 : 0
  name               = "${local.name_prefix}-gha-terraform"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

# Everything except IAM/Organizations/Account — covers S3 (Terraform state +
# lock and the app buckets), DynamoDB, Lambda, API Gateway, Cognito, CloudWatch
# Logs, SSM, Amplify, etc.
resource "aws_iam_role_policy_attachment" "terraform_poweruser" {
  count      = var.create_terraform_role ? 1 : 0
  role       = aws_iam_role.terraform[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/PowerUserAccess"
}

# The IAM piece PowerUserAccess omits: manage only this project's roles and
# customer-managed policies (name-prefixed), pass project roles to services, and
# the read-only lookups Terraform data sources need (incl. the bootstrap OIDC
# provider). Wildcards on the project prefix keep this from touching unrelated
# identities.
data "aws_iam_policy_document" "terraform_iam" {
  statement {
    sid    = "ProjectRoleManagement"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRoleTags",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:PassRole",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/${var.project}-*",
    ]
  }

  statement {
    sid    = "ProjectPolicyManagement"
    effect = "Allow"
    actions = [
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:ListPolicyVersions",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:policy/${var.project}-*",
    ]
  }

  # Read-only lookups that have no resource-level scoping (list/get on the
  # account-level OIDC provider and roles/policies Terraform refreshes).
  statement {
    sid    = "IamReadOnly"
    effect = "Allow"
    actions = [
      "iam:GetOpenIDConnectProvider",
      "iam:ListOpenIDConnectProviders",
      "iam:ListRoles",
      "iam:ListPolicies",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "terraform_iam" {
  count  = var.create_terraform_role ? 1 : 0
  name   = "${local.name_prefix}-gha-terraform-iam"
  role   = aws_iam_role.terraform[0].id
  policy = data.aws_iam_policy_document.terraform_iam.json
}
