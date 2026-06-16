variable "region" {
  description = "AWS region for this environment."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project slug used to derive resource names and tags."
  type        = string
  default     = "road-rash"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "staging"
}

# --- Amplify Hosting (hosting module) -------------------------------------
# The GitHub connection is created on first apply; the access token is a secret
# and must NOT be committed. Pass it via TF_VAR_github_access_token or a
# gitignored terraform.tfvars at apply time.

variable "repository_url" {
  description = "GitHub repository URL connected to Amplify Hosting."
  type        = string
  default     = "https://github.com/HuyNguyen260398/road-rash"
}

variable "github_access_token" {
  description = "GitHub access token / Amplify GitHub App token for the repo connection. Secret — supply at apply time, never commit."
  type        = string
  default     = null
  sensitive   = true
}

variable "branch_name" {
  description = "Git branch this environment deploys from."
  type        = string
  default     = "staging"
}

# GitHub Environment whose Actions OIDC subject may assume the Amplify deploy
# role (modules/github-oidc). Must match the `environment:` the deploy job sets
# in .github/workflows/deploy.yaml for this branch.
variable "github_deploy_environment" {
  description = "GitHub Environment name the deploy job targets for this env."
  type        = string
  default     = "staging"
}

# Off by default: the .github/workflows/deploy.yaml CI job is the single deploy
# trigger (it runs an Amplify RELEASE after the verify gate). Leaving Amplify's
# own push auto-build on would double-build every push.
variable "enable_auto_build" {
  description = "Let Amplify auto-build the branch on push. Keep false so the gated CI workflow is the only deploy trigger."
  type        = bool
  default     = false
}

# --- App origins (s3 CORS + API Gateway CORS) -----------------------------
# Browser origins allowed to call the API and PUT/GET thumbnails. No trailing
# slash (CORS origins are scheme+host only). Add the Amplify URL after apply.

variable "app_origins" {
  description = "App origins (no trailing slash) allowed by API and S3 CORS."
  type        = list(string)
  default     = ["http://localhost:3000"]
}

# --- Thumbnails (presign Lambda + iam scope) ------------------------------
# One source of truth for the thumbnail key prefix so the presign IAM policy
# scope and the keys the Lambda generates always match.

variable "thumbnail_object_prefix" {
  description = "Key prefix for thumbnail objects; scopes both the presign IAM policy and the keys the presign Lambda generates."
  type        = string
  default     = "thumbnails/"
}

variable "max_thumbnail_bytes" {
  description = "Maximum allowed thumbnail upload size in bytes (enforced by the presign Lambda, SEC-004)."
  type        = number
  default     = 5242880
}

# --- Cognito (cognito module) ---------------------------------------------
# OAuth redirect targets for the app. Defaults cover local dev; add the Amplify
# branch/custom-domain URL once the first apply surfaces it. Not derived from
# the hosting module to avoid a hosting<->cognito dependency cycle.

variable "app_callback_urls" {
  description = "Allowed OAuth sign-in redirect URLs for the app."
  type        = list(string)
  default     = ["http://localhost:3000/"]
}

variable "app_logout_urls" {
  description = "Allowed OAuth sign-out redirect URLs for the app."
  type        = list(string)
  default     = ["http://localhost:3000/"]
}

# Google OAuth credentials (TASK-008/009). Secret — supply via
# TF_VAR_google_oauth_client_id / _secret or a gitignored tfvars, never commit.
# Null leaves the Google IdP uncreated so the pool/domain can be applied first.

variable "google_oauth_client_id" {
  description = "Google OAuth 2.0 client ID for the Cognito Google IdP."
  type        = string
  default     = null
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google OAuth 2.0 client secret for the Cognito Google IdP."
  type        = string
  default     = null
  sensitive   = true
}

# --- Gemini (ssm module, M6) ----------------------------------------------
# Leave at the placeholder. The ssm module creates the SecureString with this
# value, then the real key is set out-of-band (`aws ssm put-parameter
# --overwrite`) and preserved (the module ignores value changes). Do NOT pass the
# real key via TF_VAR_gemini_api_key / tfvars — aws_ssm_parameter.value is
# persisted in Terraform state, so that would leak the secret into state.

variable "gemini_api_key" {
  description = "Placeholder seed for the Gemini SecureString. Leave at the default and set the real key out-of-band — any real value passed here is persisted in Terraform state."
  type        = string
  default     = "REPLACE_ME"
  sensitive   = true
}

# --- Custom domain (hosting module) ---------------------------------------
# Attaches the staging Amplify branch to a Route53-hosted subdomain. zone_name
# must be an existing Route53 public hosted zone in this AWS account; hostname is
# the full host to serve. Terraform writes the ACM validation + CNAME records.
# Set to null to disable.
variable "custom_domain" {
  description = "Custom domain for the Amplify branch (zone_name = Route53 hosted zone, hostname = full host to serve). Null disables."
  type = object({
    zone_name = string
    hostname  = string
  })
  default = {
    zone_name = "nghuy.link"
    hostname  = "roadrash.stg.nghuy.link"
  }
}
