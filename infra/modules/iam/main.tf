# iam module — least-privilege execution role per Lambda (M2 / TASK-018, SEC-005).
# Each handler gets its own role whose inline policy names specific table /
# bucket-prefix / parameter ARNs — no `Resource: "*"` except the scoped log
# group. The lambda module (M3+) attaches these roles to the functions.
locals {
  name_prefix = "${var.project}-${var.environment}"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  # All functions are named with the project/env prefix, so logs can be scoped
  # to that prefix wildcard rather than opening up every log group.
  log_group_arns = [
    "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-*",
    "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-*:*",
  ]

  # gemini_api_key SecureString is created in M6; the suggest-trips role is
  # granted read on exactly this parameter name (value never in Terraform).
  gemini_param_arn = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.environment}/${var.project}/gemini_api_key"
}

# Shared trust policy: only the Lambda service may assume these roles.
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# CloudWatch Logs write, scoped to this project/env's Lambda log groups. Reused
# by every function's inline policy via source_policy_documents.
data "aws_iam_policy_document" "logs" {
  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = local.log_group_arns
  }
}

# --- trips handler ---------------------------------------------------------
resource "aws_iam_role" "trips" {
  name               = "${local.name_prefix}-lambda-trips"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "trips" {
  source_policy_documents = [data.aws_iam_policy_document.logs.json]

  statement {
    sid    = "TripTableCrud"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [var.trip_table_arn, "${var.trip_table_arn}/index/*"]
  }
}

resource "aws_iam_role_policy" "trips" {
  name   = "${local.name_prefix}-lambda-trips"
  role   = aws_iam_role.trips.id
  policy = data.aws_iam_policy_document.trips.json
}

# --- favorites handler -----------------------------------------------------
resource "aws_iam_role" "favorites" {
  name               = "${local.name_prefix}-lambda-favorites"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "favorites" {
  source_policy_documents = [data.aws_iam_policy_document.logs.json]

  statement {
    sid    = "FavoriteTableCrud"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [var.favorite_table_arn, "${var.favorite_table_arn}/index/*"]
  }

  statement {
    sid    = "TripFavoriteCounter"
    effect = "Allow"
    # Only the denormalized counter update — not full CRUD on Trip (GUD-003).
    actions   = ["dynamodb:UpdateItem"]
    resources = [var.trip_table_arn]
  }
}

resource "aws_iam_role_policy" "favorites" {
  name   = "${local.name_prefix}-lambda-favorites"
  role   = aws_iam_role.favorites.id
  policy = data.aws_iam_policy_document.favorites.json
}

# --- presign handler -------------------------------------------------------
resource "aws_iam_role" "presign" {
  name               = "${local.name_prefix}-lambda-presign"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "presign" {
  source_policy_documents = [data.aws_iam_policy_document.logs.json]

  statement {
    sid     = "ThumbnailObjectRw"
    effect  = "Allow"
    actions = ["s3:PutObject", "s3:GetObject"]
    # Scoped to the thumbnail object prefix, not the whole bucket.
    resources = ["${var.thumbnails_bucket_arn}/${var.thumbnail_object_prefix}*"]
  }
}

resource "aws_iam_role_policy" "presign" {
  name   = "${local.name_prefix}-lambda-presign"
  role   = aws_iam_role.presign.id
  policy = data.aws_iam_policy_document.presign.json
}

# --- suggest-trips handler -------------------------------------------------
resource "aws_iam_role" "suggest_trips" {
  name               = "${local.name_prefix}-lambda-suggest-trips"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "suggest_trips" {
  source_policy_documents = [data.aws_iam_policy_document.logs.json]

  statement {
    sid       = "TripReadOnly"
    effect    = "Allow"
    actions   = ["dynamodb:Query", "dynamodb:GetItem"]
    resources = [var.trip_table_arn, "${var.trip_table_arn}/index/*"]
  }

  statement {
    sid       = "GeminiKeyRead"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = [local.gemini_param_arn]
    # NOTE: if the parameter is encrypted with a customer-managed KMS key (not
    # the default aws/ssm key), also grant kms:Decrypt on that key here.
  }
}

resource "aws_iam_role_policy" "suggest_trips" {
  name   = "${local.name_prefix}-lambda-suggest-trips"
  role   = aws_iam_role.suggest_trips.id
  policy = data.aws_iam_policy_document.suggest_trips.json
}
