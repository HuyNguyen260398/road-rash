terraform {
  # Native S3 state locking (use_lockfile, Terraform >= 1.10) — no DynamoDB lock
  # table (ALT-003). `bucket` and `region` are account-specific and backend
  # blocks can't use variables, so they're supplied at init time:
  #   terraform -chdir=infra/envs/prod init -backend-config=backend.hcl
  backend "s3" {
    key          = "env/prod/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}
