# Copy to terraform.tfvars (gitignored) and adjust, then:
#   terraform -chdir=infra/envs/prod plan -var-file=terraform.tfvars
# All values have defaults in variables.tf, so this file is optional.

region      = "ap-southeast-1"
project     = "road-rash"
environment = "prod"

repository_url = "https://github.com/HuyNguyen260398/road-rash"
branch_name    = "main"

# github_access_token is a SECRET — do not put it here. Supply at apply time via:
#   export TF_VAR_github_access_token=ghp_xxx
