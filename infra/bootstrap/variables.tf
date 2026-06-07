variable "region" {
  description = "AWS region for the Terraform remote-state bucket."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project slug, used to derive resource names and tags."
  type        = string
  default     = "road-rash"
}

variable "state_bucket_name" {
  description = <<-EOT
    Globally-unique name for the S3 state bucket. Leave null to derive a unique
    name as "<project>-tfstate-<account-id>". Override only if you need a
    specific name (it must be globally unique across all of S3).
  EOT
  type        = string
  default     = null
}
