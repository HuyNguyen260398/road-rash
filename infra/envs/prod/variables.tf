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
