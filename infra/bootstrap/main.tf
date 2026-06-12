data "aws_caller_identity" "current" {}

locals {
  # A derived, account-scoped default keeps the bucket name globally unique
  # without the operator having to invent one.
  state_bucket_name = coalesce(
    var.state_bucket_name,
    "${var.project}-tfstate-${data.aws_caller_identity.current.account_id}",
  )
}

resource "aws_s3_bucket" "state" {
  bucket = local.state_bucket_name
}

# Versioning lets us recover a previous state if an apply corrupts it.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# State can contain secrets/ARNs, so encrypt at rest. AES256 (SSE-S3) avoids the
# extra KMS key + grants; switch to aws:kms if a CMK is later required.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# State must never be public.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Reject any non-TLS access to the state bucket.
resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state.json

  # Apply the policy only after the public-access block so the two don't race.
  depends_on = [aws_s3_bucket_public_access_block.state]
}

data "aws_iam_policy_document" "state" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

# Account-level GitHub Actions OIDC provider (singleton — only one per account
# for this issuer). Lives here, not in a per-env root, so staging and prod can
# both reference it without colliding. Per-env deploy roles (modules/github-oidc)
# federate to this provider. The thumbprints are GitHub's well-known intermediate
# CA fingerprints; IAM also validates against its trusted CA store.
resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fee",
  ]
}
