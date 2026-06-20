# Outputs feed Amplify Hosting env vars and app config. Values sourced from the
# stub modules are placeholder ("") until the real resources land in M1/M2
# (TASK-006 wires the plumbing).

output "region" {
  description = "AWS region for this environment."
  value       = var.region
}

output "environment" {
  description = "Environment name."
  value       = var.environment
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID."
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool app client ID."
  value       = module.cognito.user_pool_client_id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID."
  value       = module.cognito.identity_pool_id
}

output "cognito_domain" {
  description = "Cognito Hosted UI domain."
  value       = module.cognito.domain
}

output "cognito_issuer" {
  description = "Cognito OIDC issuer URL (for the API Gateway JWT authorizer in M2)."
  value       = module.cognito.issuer
}

output "cognito_audience" {
  description = "JWT audience (app client ID) for the API Gateway authorizer."
  value       = module.cognito.audience
}

output "api_base_url" {
  description = "HTTP API base URL."
  value       = module.apigateway.api_base_url
}

output "thumbnails_bucket_name" {
  description = "S3 thumbnails bucket name."
  value       = module.s3.thumbnails_bucket_name
}

output "amplify_app_id" {
  description = "Amplify app ID for this environment."
  value       = module.hosting.app_id
}

output "amplify_default_domain" {
  description = "Amplify default domain for this environment."
  value       = module.hosting.default_domain
}

output "amplify_branch_url" {
  description = "Public URL of the deployed branch."
  value       = module.hosting.branch_url
}

output "github_deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions to assume. Set as AWS_DEPLOY_ROLE_ARN in the matching GitHub Environment."
  value       = module.github_oidc.deploy_role_arn
}

output "github_terraform_role_arn" {
  description = "IAM role ARN the CI deploy job assumes for `terraform apply`. Set as AWS_TERRAFORM_ROLE_ARN in the matching GitHub Environment."
  value       = module.github_oidc.terraform_role_arn
}

output "amplify_custom_domain_url" {
  description = "HTTPS URL of the prod custom domain."
  value       = module.hosting.custom_domain_url
}
