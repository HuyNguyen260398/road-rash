output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

output "trips_role_arn" {
  description = "Execution role ARN for the trips Lambda."
  value       = aws_iam_role.trips.arn
}

output "favorites_role_arn" {
  description = "Execution role ARN for the favorites Lambda."
  value       = aws_iam_role.favorites.arn
}

output "presign_role_arn" {
  description = "Execution role ARN for the presign Lambda."
  value       = aws_iam_role.presign.arn
}

output "suggest_trips_role_arn" {
  description = "Execution role ARN for the suggest-trips Lambda."
  value       = aws_iam_role.suggest_trips.arn
}
