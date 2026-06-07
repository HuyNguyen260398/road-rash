output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

output "user_pool_id" {
  description = "Cognito User Pool ID."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_client_id" {
  description = "Cognito User Pool app client ID."
  value       = aws_cognito_user_pool_client.this.id
}

output "identity_pool_id" {
  description = "Cognito Identity Pool ID."
  value       = aws_cognito_identity_pool.this.id
}

output "domain" {
  description = "Cognito Hosted UI domain host (no protocol), e.g. road-rash-staging.auth.<region>.amazoncognito.com."
  value       = "${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "issuer" {
  description = "OIDC issuer URL for the User Pool (used by the API Gateway JWT authorizer)."
  value       = "https://${aws_cognito_user_pool.this.endpoint}"
}

output "audience" {
  description = "JWT audience (the app client ID) for the API Gateway authorizer."
  value       = aws_cognito_user_pool_client.this.id
}
