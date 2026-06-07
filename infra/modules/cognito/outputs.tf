output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

# Placeholder outputs (empty until the real Cognito resources land in M1/TASK-010).
# They establish the output contract so env roots can wire Amplify env vars now.

output "user_pool_id" {
  description = "Cognito User Pool ID."
  value       = ""
}

output "user_pool_client_id" {
  description = "Cognito User Pool app client ID."
  value       = ""
}

output "identity_pool_id" {
  description = "Cognito Identity Pool ID."
  value       = ""
}

output "domain" {
  description = "Cognito Hosted UI domain."
  value       = ""
}
