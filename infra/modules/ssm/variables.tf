variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

# Gemini API key (SEC-001). Leave this at the placeholder default. The first
# `terraform apply` creates the SecureString with the placeholder; the real key
# is then set out-of-band (`aws ssm put-parameter --overwrite`) and preserved by
# the ignore_changes on value in main.tf.
#
# Do NOT pass the real key via TF_VAR_gemini_api_key / tfvars: whatever value is
# applied is persisted to `aws_ssm_parameter.value` in Terraform state (the S3
# backend), which would leak the secret into state. The override exists only to
# seed a non-placeholder in throwaway/dev setups where state secrecy doesn't
# matter.
variable "gemini_api_key" {
  description = "Placeholder seed for the Gemini SecureString. Leave at the default and set the real key out-of-band — any real value passed here is persisted in Terraform state."
  type        = string
  default     = "REPLACE_ME"
  sensitive   = true
}
