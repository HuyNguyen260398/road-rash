# apigateway module — HTTP API + Cognito JWT authorizer (M2 / TASK-019).
# Establishes the API and the auth pattern; concrete routes/integrations are
# added per handler in M3+ (protected routes attach the JWT authorizer; public
# GET routes leave it off — REQ-002/SEC-002). No routes are defined here yet.
locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  # API-level CORS so the browser can call the API cross-origin. Bearer tokens
  # travel in the Authorization header (not cookies), so credentials stay off.
  cors_configuration {
    allow_origins = var.cors_allowed_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 3000
  }
}

# JWT authorizer validating Cognito user-pool tokens. Routes opt in by setting
# authorization_type = JWT + this authorizer id (wired in M3).
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.this.id
  name             = "${local.name_prefix}-cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = var.jwt_issuer
    audience = [var.jwt_audience]
  }
}

# Auto-deploying default stage: its invoke URL has no stage path segment, so the
# API base URL is clean (https://<id>.execute-api.<region>.amazonaws.com/).
# Default throttling caps all routes; the public POST /suggest route gets a
# tighter per-route override when it lands in M6 (RISK-006).
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = var.throttling_burst_limit
    throttling_rate_limit  = var.throttling_rate_limit
  }
}

# --- Integrations + routes (M3) --------------------------------------------
# One AWS_PROXY integration per Lambda. integration_method is always POST for
# the Lambda proxy invocation regardless of the HTTP method the route exposes.
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = var.integrations

  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Routes. Protected routes attach the JWT authorizer; public routes set NONE
# (PAT-002): GET /trips, GET /trips/{id}, GET /uploads/thumbnail stay open.
resource "aws_apigatewayv2_route" "this" {
  for_each = { for r in var.routes : r.route_key => r }

  api_id    = aws_apigatewayv2_api.this.id
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value.target].id}"

  authorization_type = each.value.authorized ? "JWT" : "NONE"
  authorizer_id      = each.value.authorized ? aws_apigatewayv2_authorizer.jwt.id : null
}

# Allow API Gateway to invoke each integrated Lambda. Scoped to this API's
# execution ARN; /*/* covers every stage+route so new routes need no new grant.
resource "aws_lambda_permission" "apigw" {
  for_each = var.integrations

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
