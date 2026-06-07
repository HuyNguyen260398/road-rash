# Copy to terraform.tfvars (gitignored) and adjust as needed, then:
#   terraform -chdir=infra/bootstrap init
#   terraform -chdir=infra/bootstrap apply -var-file=terraform.tfvars
#
# All values below are optional — the defaults derive a unique bucket name from
# the AWS account ID, so an empty tfvars also works.

region  = "ap-southeast-1"
project = "road-rash"

# Override only if you need a specific (globally-unique) bucket name:
# state_bucket_name = "road-rash-tfstate-prod"
