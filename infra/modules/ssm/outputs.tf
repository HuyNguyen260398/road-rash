output "gemini_api_key_param_name" {
  description = "Name of the Gemini API key SecureString parameter (passed to the suggest-trips Lambda as GEMINI_PARAM_NAME)."
  value       = aws_ssm_parameter.gemini_api_key.name
}

output "gemini_api_key_param_arn" {
  description = "ARN of the Gemini API key SecureString parameter."
  value       = aws_ssm_parameter.gemini_api_key.arn
}
