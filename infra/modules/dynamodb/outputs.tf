output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

output "trip_table_name" {
  description = "Name of the Trip DynamoDB table."
  value       = aws_dynamodb_table.trip.name
}

output "trip_table_arn" {
  description = "ARN of the Trip DynamoDB table (use arn/index/* for its GSIs)."
  value       = aws_dynamodb_table.trip.arn
}

output "favorite_table_name" {
  description = "Name of the Favorite DynamoDB table."
  value       = aws_dynamodb_table.favorite.name
}

output "favorite_table_arn" {
  description = "ARN of the Favorite DynamoDB table (use arn/index/* for its GSIs)."
  value       = aws_dynamodb_table.favorite.arn
}
