output "name_prefix" {
  description = "Convention prefix <project>-<environment> for this module's resources."
  value       = local.name_prefix
}

output "api_base_url" {
  description = "Base URL (invoke URL) of the HTTP API ($default stage, no stage path)."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "api_id" {
  description = "HTTP API ID (used by M3+ routes/integrations)."
  value       = aws_apigatewayv2_api.this.id
}

output "authorizer_id" {
  description = "JWT authorizer ID for protected routes to attach in M3+."
  value       = aws_apigatewayv2_authorizer.jwt.id
}

output "execution_arn" {
  description = "API execution ARN for aws_lambda_permission source_arn (append /*/* in M3+)."
  value       = aws_apigatewayv2_api.this.execution_arn
}
