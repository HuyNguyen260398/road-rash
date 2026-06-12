output "deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions to assume. Set this as the AWS_DEPLOY_ROLE_ARN variable in the matching GitHub Environment."
  value       = aws_iam_role.deploy.arn
}
