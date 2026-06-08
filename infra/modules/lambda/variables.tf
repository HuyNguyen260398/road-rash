variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

variable "function_name" {
  description = "Short function name; the full name becomes <project>-<environment>-<function_name>."
  type        = string
}

variable "source_dir" {
  description = "Directory of bundled handler JS to zip and deploy (esbuild output, populated in M3)."
  type        = string
}

variable "role_arn" {
  description = "Execution role ARN for this function (from the iam module)."
  type        = string
}

variable "handler" {
  description = "Lambda handler entrypoint."
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "Lambda runtime. Plan targets Node 24; defaults to nodejs22.x — bump to nodejs24.x once it is a supported Lambda runtime."
  type        = string
  default     = "nodejs22.x"
}

variable "environment_variables" {
  description = "Environment variables (table names, bucket, SSM parameter NAMES — never secret values)."
  type        = map(string)
  default     = {}
}

variable "memory_size" {
  description = "Function memory in MB."
  type        = number
  default     = 256
}

variable "timeout" {
  description = "Function timeout in seconds."
  type        = number
  default     = 10
}

variable "api_execution_arn" {
  description = "API Gateway execution ARN; when set, grants apigateway invoke permission. Empty to skip."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention for this function's log group."
  type        = number
  default     = 14
}
