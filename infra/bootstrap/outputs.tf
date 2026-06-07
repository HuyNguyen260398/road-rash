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
