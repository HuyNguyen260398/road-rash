# lambda module — reusable per-function wrapper (M2 / TASK-020). Called once per
# handler in M3+ (trips, favorites, presign, suggest-trips), each with its own
# IAM role (from the iam module) and env vars (table names, bucket, SSM
# parameter *names* — never secret values, PAT-003).
#
# Bundling: the caller points `source_dir` at a directory of already-bundled JS.
# The esbuild TS->JS build step + zip glue lands with the handlers in M3 (DEP-005);
# this module just zips the build output and ships it.
locals {
  name_prefix   = "${var.project}-${var.environment}"
  function_name = "${local.name_prefix}-${var.function_name}"
}

data "archive_file" "this" {
  type       = "zip"
  source_dir = var.source_dir
  # Write the zip under the root module's .terraform scratch dir (already
  # gitignored) so build artifacts never land in the version-controlled module
  # source tree. archive_file creates the parent directory.
  output_path = "${path.root}/.terraform/lambda-build/${var.function_name}.zip"
}

# Explicit log group so retention is controlled (Lambda would otherwise create
# one with never-expire retention). Function name must match /aws/lambda/<name>.
resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "this" {
  function_name = local.function_name
  role          = var.role_arn
  handler       = var.handler
  runtime       = var.runtime
  memory_size   = var.memory_size
  timeout       = var.timeout

  filename         = data.archive_file.this.output_path
  source_code_hash = data.archive_file.this.output_base64sha256

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  # Ensure the log group exists (with our retention) before the function runs.
  depends_on = [aws_cloudwatch_log_group.this]
}

# Allow API Gateway to invoke this function. Created only when an API execution
# ARN is supplied (public/handlerless uses can omit it).
resource "aws_lambda_permission" "apigw" {
  count = var.api_execution_arn != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}
