# Outputs feed Amplify Hosting env vars and app config. Expanded as modules gain
# real resources (Cognito IDs, API base URL, thumbnails bucket — see TASK-006).

output "region" {
  description = "AWS region for this environment."
  value       = var.region
}

output "environment" {
  description = "Environment name."
  value       = var.environment
}
