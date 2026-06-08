output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

output "thumbnails_bucket_name" {
  description = "Name of the S3 bucket holding trip thumbnails."
  value       = aws_s3_bucket.thumbnails.bucket
}

output "thumbnails_bucket_arn" {
  description = "ARN of the thumbnails bucket (use arn/* for object-level policies)."
  value       = aws_s3_bucket.thumbnails.arn
}
