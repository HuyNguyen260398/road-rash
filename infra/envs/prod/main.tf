# Prod environment root — composes the per-concern modules. Modules are
# stubs today; each milestone fills in its module and this composition grows.

locals {
  # Browser-safe runtime config surfaced to the Next.js app as Amplify env vars.
  # Right-hand sides are placeholder ("") until Cognito (M1) and API Gateway (M2)
  # produce real outputs — the plumbing is wired now so later milestones only
  # swap the values (TASK-006). NEVER put secrets here.
  amplify_environment_variables = {
    NEXT_PUBLIC_AWS_REGION                  = var.region
    NEXT_PUBLIC_COGNITO_USER_POOL_ID        = module.cognito.user_pool_id
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID = module.cognito.user_pool_client_id
    NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID    = module.cognito.identity_pool_id
    NEXT_PUBLIC_COGNITO_DOMAIN              = module.cognito.domain
    NEXT_PUBLIC_API_BASE_URL                = module.apigateway.api_base_url
    NEXT_PUBLIC_THUMBNAILS_BUCKET           = module.s3.thumbnails_bucket_name
  }
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  project     = var.project
  environment = var.environment
}

module "s3" {
  source      = "../../modules/s3"
  project     = var.project
  environment = var.environment

  cors_allowed_origins = var.app_origins
}

module "iam" {
  source      = "../../modules/iam"
  project     = var.project
  environment = var.environment

  trip_table_arn        = module.dynamodb.trip_table_arn
  favorite_table_arn    = module.dynamodb.favorite_table_arn
  thumbnails_bucket_arn = module.s3.thumbnails_bucket_arn
}

module "cognito" {
  source      = "../../modules/cognito"
  project     = var.project
  environment = var.environment

  callback_urls = var.app_callback_urls
  logout_urls   = var.app_logout_urls

  # Secrets — supplied via TF_VAR_* or a gitignored tfvars, never committed.
  google_oauth_client_id     = var.google_oauth_client_id
  google_oauth_client_secret = var.google_oauth_client_secret
}

# NOTE: the reusable `lambda` module is instantiated per handler in M3 (trips,
# favorites, presign, suggest-trips), each wired to its iam role + env vars.

module "apigateway" {
  source      = "../../modules/apigateway"
  project     = var.project
  environment = var.environment

  jwt_issuer           = module.cognito.issuer
  jwt_audience         = module.cognito.audience
  cors_allowed_origins = var.app_origins
}

module "hosting" {
  source                = "../../modules/hosting"
  project               = var.project
  environment           = var.environment
  repository_url        = var.repository_url
  github_access_token   = var.github_access_token
  branch_name           = var.branch_name
  environment_variables = local.amplify_environment_variables
}
