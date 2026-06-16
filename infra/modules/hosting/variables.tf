variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

variable "repository_url" {
  description = "GitHub repository URL connected to Amplify Hosting."
  type        = string
}

variable "github_access_token" {
  description = "GitHub access token / Amplify GitHub App token for the repo connection. Secret — supply at apply time, never commit."
  type        = string
  default     = null
  sensitive   = true
}

variable "branch_name" {
  description = "Git branch this Amplify app deploys from."
  type        = string
}

variable "build_spec" {
  description = "Override the default pnpm build spec. Null uses the module's built-in spec."
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "App-level Amplify environment variables (browser-safe NEXT_PUBLIC_* only; never secrets)."
  type        = map(string)
  default     = {}
}

variable "branch_environment_variables" {
  description = "Per-branch Amplify environment variable overrides."
  type        = map(string)
  default     = {}
}

variable "enable_auto_build" {
  description = "Auto-build the branch on push."
  type        = bool
  default     = true
}

variable "iam_service_role_arn" {
  description = "Optional IAM service role ARN for Amplify SSR compute (e.g. CloudWatch Logs). Null lets Amplify manage it."
  type        = string
  default     = null
}

variable "custom_domain" {
  description = <<-DESC
    Optional custom domain for the Amplify branch. Null = no custom domain.
    zone_name is an existing Route53 public hosted zone in this AWS account
    (e.g. "nghuy.link"); hostname is the full host to serve (e.g.
    "roadrash.stg.nghuy.link"). The module splits the hostname into its leftmost
    label (Amplify's sub_domain prefix, which must be a SINGLE DNS label) and the
    remainder (Amplify's domain_name) — so "roadrash.stg.nghuy.link" becomes
    prefix "roadrash" + domain "stg.nghuy.link" — and writes the ACM validation +
    CNAME records into the zone.
  DESC
  type = object({
    zone_name = string
    hostname  = string
  })
  default = null
}
