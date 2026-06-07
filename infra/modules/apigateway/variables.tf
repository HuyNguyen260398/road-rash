variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

variable "jwt_issuer" {
  description = "Cognito OIDC issuer URL for the JWT authorizer."
  type        = string
}

variable "jwt_audience" {
  description = "Cognito app client ID (JWT audience) accepted by the authorizer."
  type        = string
}

variable "cors_allowed_origins" {
  description = "App origins allowed to call the API cross-origin (no trailing slash)."
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "throttling_burst_limit" {
  description = "Default per-route throttling burst limit for the stage."
  type        = number
  default     = 50
}

variable "throttling_rate_limit" {
  description = "Default per-route steady-state request rate for the stage."
  type        = number
  default     = 100
}
