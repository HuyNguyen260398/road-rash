# Bootstrap uses LOCAL state on purpose: the S3 backend cannot store the bucket
# that holds its own state. Run this once, then the infra/ root + envs use the
# bucket created here as their `backend "s3"`. See infra/README.md.
terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Component = "terraform-state"
    }
  }
}
