output "deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions to assume. Set this as the AWS_DEPLOY_ROLE_ARN variable in the matching GitHub Environment."
  value       = aws_iam_role.deploy.arn
}

output "terraform_role_arn" {
  description = "IAM role ARN the CI deploy job assumes to run `terraform apply` (null unless create_terraform_role = true). Set as AWS_TERRAFORM_ROLE_ARN in the matching GitHub Environment."
  value       = var.create_terraform_role ? aws_iam_role.terraform[0].arn : null
}
