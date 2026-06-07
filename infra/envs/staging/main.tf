# Staging environment root — composes the per-concern modules. Modules are
# stubs today; each milestone fills in its module and this composition grows.

module "iam" {
  source      = "../../modules/iam"
  project     = var.project
  environment = var.environment
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
}

module "cognito" {
  source      = "../../modules/cognito"
  project     = var.project
  environment = var.environment
}

module "lambda" {
  source      = "../../modules/lambda"
  project     = var.project
  environment = var.environment
}

module "apigateway" {
  source      = "../../modules/apigateway"
  project     = var.project
  environment = var.environment
}

module "hosting" {
  source      = "../../modules/hosting"
  project     = var.project
  environment = var.environment
}
