output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

# Placeholder output (empty until the thumbnails bucket lands in M2/TASK-017).
output "thumbnails_bucket_name" {
  description = "Name of the S3 bucket holding trip thumbnails."
  value       = ""
}
