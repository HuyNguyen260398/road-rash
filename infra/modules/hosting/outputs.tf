output "app_id" {
  description = "Amplify app ID."
  value       = aws_amplify_app.this.id
}

output "app_arn" {
  description = "Amplify app ARN."
  value       = aws_amplify_app.this.arn
}

output "default_domain" {
  description = "Amplify-provided default domain for the app (e.g. <id>.amplifyapp.com)."
  value       = aws_amplify_app.this.default_domain
}

output "branch_name" {
  description = "Deployed branch name."
  value       = aws_amplify_branch.this.branch_name
}

output "branch_url" {
  description = "Public URL of the deployed branch."
  value       = "https://${aws_amplify_branch.this.branch_name}.${aws_amplify_app.this.default_domain}"
}

output "custom_domain_url" {
  description = "HTTPS URL of the custom domain, or null if none configured."
  value       = var.custom_domain != null ? "https://${var.custom_domain.hostname}" : null
}
