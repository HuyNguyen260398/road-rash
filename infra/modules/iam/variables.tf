variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

variable "trip_table_arn" {
  description = "ARN of the Trip DynamoDB table (GSIs scoped via arn/index/*)."
  type        = string
}

variable "favorite_table_arn" {
  description = "ARN of the Favorite DynamoDB table (GSIs scoped via arn/index/*)."
  type        = string
}

variable "thumbnails_bucket_arn" {
  description = "ARN of the thumbnails S3 bucket."
  type        = string
}

variable "thumbnail_object_prefix" {
  description = "Key prefix within the thumbnails bucket the presign role may read/write (least-privilege scope; the presign Lambda + M5 uploads must use this prefix)."
  type        = string
  default     = "thumbnails/"
}
