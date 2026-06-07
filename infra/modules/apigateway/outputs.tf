output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

# Placeholder output (empty until the HTTP API lands in M2/TASK-019).
output "api_base_url" {
  description = "Base URL (invoke URL) of the HTTP API."
  value       = ""
}
