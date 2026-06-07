# apigateway module — stub. Real resources land in a later milestone (see
# plan/feature-road-rash-mvp-1.md). Kept compositionally wired so env roots
# validate today.
locals {
  name_prefix = "${var.project}-${var.environment}"
}
