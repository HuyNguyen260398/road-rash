output "state_bucket_name" {
  description = "Name of the S3 bucket holding Terraform remote state. Use this as the `bucket` in every `backend \"s3\"` block."
  value       = aws_s3_bucket.state.id
}

output "state_bucket_arn" {
  description = "ARN of the state bucket."
  value       = aws_s3_bucket.state.arn
}

output "region" {
  description = "Region the state bucket lives in. Use this as the backend `region`."
  value       = var.region
}

output "github_oidc_provider_arn" {
  description = "ARN of the account-level GitHub Actions OIDC provider. Per-env deploy roles (modules/github-oidc) federate to it."
  value       = aws_iam_openid_connect_provider.github_actions.arn
}
