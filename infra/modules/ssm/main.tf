# ssm module — SecureString parameters read by Lambdas at runtime (M6 / TASK-038).
# The Gemini API key lives here (SEC-001) and is read by the suggest-trips Lambda
# via ssm:GetParameter (scoped in the iam module). The value never reaches the
# browser. To keep it out of Terraform state, ALWAYS apply with the placeholder
# default, then set the real key out-of-band (`aws ssm put-parameter --overwrite`);
# the ignore_changes on value below preserves that out-of-band value across later
# applies. (Anything passed via the var is written to aws_ssm_parameter.value in
# state, so don't pass the real key that way — see variables.tf.)
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
