variable "project" {
  description = "Project slug used to derive resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, prod)."
  type        = string
}

variable "jwt_issuer" {
  description = "Cognito OIDC issuer URL for the JWT authorizer."
  type        = string
}

variable "jwt_audience" {
  description = "Cognito app client ID (JWT audience) accepted by the authorizer."
  type        = string
}

variable "cors_allowed_origins" {
  description = "App origins allowed to call the API cross-origin (no trailing slash)."
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "throttling_burst_limit" {
  description = "Default per-route throttling burst limit for the stage."
  type        = number
  default     = 50
}

variable "throttling_rate_limit" {
  description = "Default per-route steady-state request rate for the stage."
  type        = number
  default     = 100
}

# --- Lambda integrations + routes (M3+) -----------------------------------
# One AWS_PROXY integration per Lambda (keyed by a logical name); routes target
# an integration by that key. The lambda module no longer needs the API
# execution ARN — invoke permission is granted here, keeping the dependency
# graph acyclic (apigateway -> lambda, never the reverse).

variable "integrations" {
  description = "Lambda integrations keyed by logical name; routes target one by key."
  type = map(object({
    invoke_arn    = string
    function_name = string
  }))
  default = {}
}

variable "routes" {
  description = "HTTP API routes. authorized=true attaches the JWT authorizer (protected); false leaves the route public (open GETs)."
  type = list(object({
    route_key  = string # e.g. "POST /trips"
    target     = string # key into var.integrations
    authorized = bool
  }))
  default = []
}
