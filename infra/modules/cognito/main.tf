# cognito module — User Pool + Hosted UI domain + Google IdP + Identity Pool
# (M1 / TASK-009, TASK-010). Provides federated Google sign-in for the app and
# the JWT issuer/audience used by the API Gateway authorizer in later milestones.
locals {
  name_prefix = "${var.project}-${var.environment}"

  # The Google IdP (and its SSM-backed secrets) only materialise once real
  # credentials are supplied. Until then the pool/client/domain still apply, so
  # the Hosted UI domain can be learned for the Google redirect URI (TASK-008).
  enable_google = var.google_oauth_client_id != null && var.google_oauth_client_secret != null

  supported_idps = local.enable_google ? ["COGNITO", "Google"] : ["COGNITO"]
}

data "aws_region" "current" {}

# --- Google credentials persisted in SSM (TASK-009) ------------------------
# Stored as SecureString so the credentials live in Parameter Store as the
# durable source of truth; the IdP below consumes the same variable values.
resource "aws_ssm_parameter" "google_client_id" {
  count = local.enable_google ? 1 : 0

  name        = "/${var.environment}/${var.project}/google_oauth_client_id"
  description = "Google OAuth client ID for the Cognito Google IdP."
  type        = "SecureString"
  value       = var.google_oauth_client_id
}

resource "aws_ssm_parameter" "google_client_secret" {
  count = local.enable_google ? 1 : 0

  name        = "/${var.environment}/${var.project}/google_oauth_client_secret"
  description = "Google OAuth client secret for the Cognito Google IdP."
  type        = "SecureString"
  value       = var.google_oauth_client_secret
}

# --- User Pool -------------------------------------------------------------
resource "aws_cognito_user_pool" "this" {
  name = "${local.name_prefix}-users"

  # Email as the sign-in identifier; auto-verified for the federated flow.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # MFA optional for the MVP (REQ: keep onboarding frictionless).
  mfa_configuration = "OFF"

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Federated users arrive with email/name already; password policy still
  # applies to any native users created later.
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
}

# --- Hosted UI domain (feeds TASK-008 redirect URIs) -----------------------
resource "aws_cognito_user_pool_domain" "this" {
  domain       = local.name_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}

# --- Google identity provider ----------------------------------------------
resource "aws_cognito_identity_provider" "google" {
  count = local.enable_google ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_oauth_client_id
    client_secret    = var.google_oauth_client_secret
    authorize_scopes = "email profile openid"
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
  }
}

# --- App client (public SPA client, no secret) -----------------------------
resource "aws_cognito_user_pool_client" "this" {
  name         = "${local.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  # Public SPA client used by Amplify (SSR via the official adapter) — no
  # client secret in the browser bundle.
  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  supported_identity_providers = local.supported_idps

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"

  # Ensure the Google IdP exists before the client references it.
  depends_on = [aws_cognito_identity_provider.google]
}

# --- Identity Pool + auth/unauth roles -------------------------------------
resource "aws_cognito_identity_pool" "this" {
  identity_pool_name = "${local.name_prefix}-identities"

  # The app authenticates API calls with the User Pool JWT and uploads via the
  # presign Lambda — it never requests Identity Pool guest credentials. Disabling
  # unauthenticated identities removes that unused anonymous-credential surface.
  # (The policy-free unauthenticated role below is retained but no longer
  # assumable.)
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.this.id
    provider_name           = aws_cognito_user_pool.this.endpoint
    server_side_token_check = false
  }
}

data "aws_iam_policy_document" "authenticated_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "cognito-identity.amazonaws.com:aud"
      values   = [aws_cognito_identity_pool.this.id]
    }

    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.amazonaws.com:amr"
      values   = ["authenticated"]
    }
  }
}

data "aws_iam_policy_document" "unauthenticated_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "cognito-identity.amazonaws.com:aud"
      values   = [aws_cognito_identity_pool.this.id]
    }

    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.amazonaws.com:amr"
      values   = ["unauthenticated"]
    }
  }
}

# Roles are intentionally policy-free for the MVP: API access uses the User
# Pool JWT (API Gateway authorizer), and S3 thumbnail uploads go through a
# presign Lambda — not Identity Pool credentials. Scoped policies attach in
# later milestones if direct AWS access is ever needed from the browser.
resource "aws_iam_role" "authenticated" {
  name               = "${local.name_prefix}-cognito-authenticated"
  assume_role_policy = data.aws_iam_policy_document.authenticated_assume.json
}

resource "aws_iam_role" "unauthenticated" {
  name               = "${local.name_prefix}-cognito-unauthenticated"
  assume_role_policy = data.aws_iam_policy_document.unauthenticated_assume.json
}

resource "aws_cognito_identity_pool_roles_attachment" "this" {
  identity_pool_id = aws_cognito_identity_pool.this.id

  roles = {
    authenticated   = aws_iam_role.authenticated.arn
    unauthenticated = aws_iam_role.unauthenticated.arn
  }
}
