# Copy to terraform.tfvars (gitignored) and adjust, then:
#   terraform -chdir=infra/envs/prod plan -var-file=terraform.tfvars
# All values have defaults in variables.tf, so this file is optional.

region      = "ap-southeast-1"
project     = "road-rash"
environment = "prod"

repository_url = "https://github.com/HuyNguyen260398/road-rash"
branch_name    = "production"

# github_access_token is a SECRET — do not put it here. Supply at apply time via:
#   export TF_VAR_github_access_token=ghp_xxx

# OAuth redirect targets — KEEP the trailing slash (matches Amplify/Cognito).
app_callback_urls = ["http://localhost:3000/", "https://roadrash.nghuy.link/"]
app_logout_urls   = ["http://localhost:3000/", "https://roadrash.nghuy.link/"]

# CORS origins for API Gateway + S3 — NO trailing slash (scheme+host only).
app_origins = ["http://localhost:3000", "https://roadrash.nghuy.link"]

# Google OAuth credentials are SECRETS — do not put them here. Supply via:
#   export TF_VAR_google_oauth_client_id=...
#   export TF_VAR_google_oauth_client_secret=...
# Leaving them unset skips the Google IdP so you can apply the pool first,
# read the Hosted UI domain, register it in Google, then set these and re-apply.

# Gemini API key is a SECRET — do not put it here, and do NOT set
# TF_VAR_gemini_api_key to the real key: aws_ssm_parameter.value is persisted in
# Terraform state, so that would leak it. Apply with the placeholder, then set
# the real value out-of-band (it won't be reverted by later applies):
#   aws ssm put-parameter --name /prod/road-rash/gemini_api_key \
#     --type SecureString --value "$GEMINI_API_KEY" --overwrite

# Custom domain — attaches the Amplify branch to a Route53-hosted subdomain.
# Defaulted in variables.tf to zone nghuy.link / host roadrash.nghuy.link;
# override or set to null here to change/disable. zone_name must be an existing
# Route53 public hosted zone in this AWS account.
# custom_domain = {
#   zone_name = "nghuy.link"
#   hostname  = "roadrash.nghuy.link"
# }
