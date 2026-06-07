variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

variable "cors_allowed_origins" {
  description = "App origins allowed to PUT/GET thumbnails via presigned URLs (no trailing slash)."
  type        = list(string)
  default     = ["http://localhost:3000"]
}
