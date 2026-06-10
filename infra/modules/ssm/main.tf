# ssm module — SecureString parameters read by Lambdas at runtime (M6 / TASK-038).
# The Gemini API key lives here (SEC-001) and is read by the suggest-trips Lambda
# via ssm:GetParameter (scoped in the iam module). The value never reaches the
# browser and is never committed: Terraform creates the parameter with a
# placeholder, then ignores subsequent value changes so the real key — injected
# out-of-band — is not reverted or surfaced through committed config.
#
# Name convention `/<env>/<project>/gemini_api_key` MUST match the ARN the iam
# module scopes the suggest-trips GetParameter policy to.
locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_ssm_parameter" "gemini_api_key" {
  name        = "/${var.environment}/${var.project}/gemini_api_key"
  description = "Gemini API key for the suggest-trips Lambda (${local.name_prefix})."
  type        = "SecureString"
  value       = var.gemini_api_key

  lifecycle {
    # The real secret is set out-of-band after create; don't let Terraform revert
    # it back to the placeholder on subsequent applies (and keep it out of git).
    ignore_changes = [value]
  }
}
