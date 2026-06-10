variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

# Gemini API key (SEC-001). SECRET — supplied at create time via
# TF_VAR_gemini_api_key or a gitignored tfvars, NEVER committed. The default is a
# harmless placeholder so the first `terraform apply` can create the SecureString
# without the real key present; the actual value is then injected out-of-band
# (e.g. `aws ssm put-parameter --overwrite`) and preserved by ignore_changes
# below, so the secret never has to live in tfvars/state-as-committed/git.
variable "gemini_api_key" {
  description = "Gemini API key value for the SecureString parameter. Secret — supply via TF_VAR_gemini_api_key on first apply, never commit."
  type        = string
  default     = "REPLACE_ME"
  sensitive   = true
}
