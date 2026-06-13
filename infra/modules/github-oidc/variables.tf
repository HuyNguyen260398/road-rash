variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

variable "repository" {
  description = "GitHub <owner>/<repo> whose Actions OIDC may assume the deploy role."
  type        = string
}

variable "github_environment" {
  description = "GitHub Environment name the deploy job targets; its OIDC subject (repo:<owner>/<repo>:environment:<name>) is the only identity allowed to assume the role."
  type        = string
}

variable "amplify_app_arn" {
  description = "ARN of the Amplify app this role may trigger RELEASE jobs on (StartJob/GetJob scoped to its branches/jobs)."
  type        = string
}

variable "create_terraform_role" {
  description = "Also create a broad-permission role the CI deploy job assumes to run `terraform apply` for this env (state bucket + all managed resources). Off by default — opt in per env (staging) so an unused env never gets a powerful CI role."
  type        = bool
  default     = false
}
