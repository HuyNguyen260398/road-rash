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
  default     = "prod"
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
  default     = "main"
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
# Gemini API key value for the SecureString parameter. Secret — supply via
# TF_VAR_gemini_api_key on first apply, never commit. The default placeholder
# lets the parameter be created first; the real value is then injected
# out-of-band and preserved (the ssm module ignores value changes).

variable "gemini_api_key" {
  description = "Gemini API key value stored in SSM (SecureString). Secret — supply via TF_VAR_gemini_api_key on first apply, never commit."
  type        = string
  default     = "REPLACE_ME"
  sensitive   = true
}
