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

  trip_table_arn          = module.dynamodb.trip_table_arn
  favorite_table_arn      = module.dynamodb.favorite_table_arn
  thumbnails_bucket_arn   = module.s3.thumbnails_bucket_arn
  thumbnail_object_prefix = var.thumbnail_object_prefix
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

# SecureString secrets read by Lambdas at runtime (M6). The Gemini key value is a
# secret — supplied via TF_VAR_gemini_api_key on first apply, then maintained
# out-of-band (the module ignores value changes). Never committed (SEC-001).
module "ssm" {
  source      = "../../modules/ssm"
  project     = var.project
  environment = var.environment

  gemini_api_key = var.gemini_api_key
}

# Lambda handlers (M3). Each points at its esbuild-bundled dist/ output (run
# `pnpm build:lambdas` before plan/apply) and gets its least-privilege iam role
# + env vars (table/bucket names + SSM parameter names — never secret values).
# favorites + suggest-trips land in M4/M6.
module "lambda_trips" {
  source        = "../../modules/lambda"
  project       = var.project
  environment   = var.environment
  function_name = "trips"
  source_dir    = "${path.root}/../../../services/trips/dist"
  role_arn      = module.iam.trips_role_arn

  environment_variables = {
    TRIP_TABLE = module.dynamodb.trip_table_name
  }
}

module "lambda_presign" {
  source        = "../../modules/lambda"
  project       = var.project
  environment   = var.environment
  function_name = "presign"
  source_dir    = "${path.root}/../../../services/presign/dist"
  role_arn      = module.iam.presign_role_arn

  environment_variables = {
    THUMBNAILS_BUCKET = module.s3.thumbnails_bucket_name
    THUMBNAIL_PREFIX  = var.thumbnail_object_prefix
    MAX_UPLOAD_BYTES  = tostring(var.max_thumbnail_bytes)
  }
}

# suggest-trips Lambda (M6). Reads the Trip table (re-validating ranked ids) and
# the Gemini key from SSM by *name* — the secret value is never in env/Terraform.
# Timeout sits just under the API Gateway 30s integration ceiling so we always
# answer (the client falls back to plain search on error/timeout).
module "lambda_suggest_trips" {
  source        = "../../modules/lambda"
  project       = var.project
  environment   = var.environment
  function_name = "suggest-trips"
  source_dir    = "${path.root}/../../../services/suggest-trips/dist"
  role_arn      = module.iam.suggest_trips_role_arn
  timeout       = 29

  environment_variables = {
    TRIP_TABLE        = module.dynamodb.trip_table_name
    GEMINI_PARAM_NAME = module.ssm.gemini_api_key_param_name
  }
}

module "apigateway" {
  source      = "../../modules/apigateway"
  project     = var.project
  environment = var.environment

  jwt_issuer           = module.cognito.issuer
  jwt_audience         = module.cognito.audience
  cors_allowed_origins = var.app_origins

  integrations = {
    trips = {
      invoke_arn    = module.lambda_trips.invoke_arn
      function_name = module.lambda_trips.function_name
    }
    presign = {
      invoke_arn    = module.lambda_presign.invoke_arn
      function_name = module.lambda_presign.function_name
    }
    suggest = {
      invoke_arn    = module.lambda_suggest_trips.invoke_arn
      function_name = module.lambda_suggest_trips.function_name
    }
  }

  # GET routes public (REQ-002); mutating routes + the upload presign behind the
  # JWT authorizer (SEC-002). The public GET /uploads/thumbnail issues read URLs
  # for thumbnails shown on the public card grid. POST /suggest is public but
  # hard-throttled below (RISK-006) since each call drives Gemini spend.
  routes = [
    { route_key = "GET /trips", target = "trips", authorized = false },
    { route_key = "GET /trips/{id}", target = "trips", authorized = false },
    { route_key = "POST /trips", target = "trips", authorized = true },
    { route_key = "PUT /trips/{id}", target = "trips", authorized = true },
    { route_key = "DELETE /trips/{id}", target = "trips", authorized = true },
    { route_key = "POST /uploads/presign", target = "presign", authorized = true },
    { route_key = "GET /uploads/thumbnail", target = "presign", authorized = false },
    { route_key = "POST /suggest", target = "suggest", authorized = false },
  ]

  # Hard cap on the public AI route: ~2 req/s steady, burst 5 — well under the
  # stage default, so abuse can't run up Gemini cost (RISK-006).
  route_throttles = {
    "POST /suggest" = { burst_limit = 5, rate_limit = 2 }
    # Rate-sanity on trip creation (TASK-048): authenticated, but cap the burst so
    # a single signed-in account can't trivially spam the Trip table.
    "POST /trips" = { burst_limit = 10, rate_limit = 5 }
  }
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
