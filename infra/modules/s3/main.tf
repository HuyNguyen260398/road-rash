# s3 module — private thumbnails bucket (M2 / TASK-017). Objects are written by
# the browser via a presigned PUT (issued by the presign Lambda) and read via a
# presigned GET, so the bucket stays fully private: no public access, SSE on,
# CORS limited to the app origins.
locals {
  name_prefix = "${var.project}-${var.environment}"
}

data "aws_caller_identity" "current" {}

# Account id suffix keeps the bucket name globally unique without a random_id
# (deterministic, so re-applies don't churn the bucket).
resource "aws_s3_bucket" "thumbnails" {
  bucket = "${local.name_prefix}-thumbnails-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Browser needs PUT (presigned upload) + GET (presigned read). Origins are
# restricted to the app domains; ETag is exposed so the client can confirm the
# upload. HEAD allows preflight/metadata checks.
resource "aws_s3_bucket_cors_configuration" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
