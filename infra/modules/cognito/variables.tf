variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

# --- OAuth app callback/logout URLs ---------------------------------------
# The app domain (Amplify branch/custom domain) is NOT wired in from the
# hosting module on purpose: hosting consumes Cognito outputs as env vars, so
# referencing the hosting URL here would create a module dependency cycle.
# Supply the app URLs explicitly (localhost for dev; add the Amplify URL after
# the first apply surfaces it). These feed the user pool client's allowed
# OAuth redirect targets.

variable "callback_urls" {
  description = "Allowed OAuth sign-in redirect URLs for the app (Hosted UI -> app)."
  type        = list(string)
  default     = ["http://localhost:3000/"]
}

variable "logout_urls" {
  description = "Allowed OAuth sign-out redirect URLs for the app."
  type        = list(string)
  default     = ["http://localhost:3000/"]
}

# --- Google OAuth credentials (TASK-008/009) -------------------------------
# Created in Google Cloud Console; secret values must NEVER be committed.
# Supply via TF_VAR_google_oauth_client_id / _secret or a gitignored tfvars.
# Both default to null so the pool/client/domain can be applied first (to learn
# the Hosted UI domain for the Google redirect URI), then the Google IdP is
# created on a subsequent apply once the credentials are filled in.

variable "google_oauth_client_id" {
  description = "Google OAuth 2.0 client ID for the Cognito Google IdP. Null disables the Google IdP."
  type        = string
  default     = null
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google OAuth 2.0 client secret for the Cognito Google IdP. Null disables the Google IdP."
  type        = string
  default     = null
  sensitive   = true
}
