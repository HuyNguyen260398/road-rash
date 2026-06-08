# dynamodb module — Trip + Favorite tables (M2 / TASK-015, TASK-016).
# PAY_PER_REQUEST (on-demand) for both: traffic is spiky/unknown for the MVP and
# this avoids capacity planning. Only key attributes are declared (DynamoDB is
# schemaless for non-key attributes), so favoriteCount / name / location etc.
# live on items without appearing here.
locals {
  name_prefix = "${var.project}-${var.environment}"
}

# --- Trip table (TASK-015) -------------------------------------------------
# Filter/group GSIs for the card grid (REQ-008). favoriteCount stays a plain
# denormalized attribute on the base item (GUD-003) — never scanned from
# Favorite at read time.
resource "aws_dynamodb_table" "trip" {
  name         = "${local.name_prefix}-Trip"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "country"
    type = "S"
  }

  attribute {
    name = "province"
    type = "S"
  }

  attribute {
    name = "city"
    type = "S"
  }

  attribute {
    name = "tripType"
    type = "S"
  }

  attribute {
    name = "vehicle"
    type = "S"
  }

  # One GSI per filter/group dimension. Projection ALL so the card grid can be
  # rendered straight from a single Query without a follow-up GetItem; on-demand
  # billing makes the extra projected-storage cost the pragmatic MVP trade-off.
  global_secondary_index {
    name            = "country-index"
    hash_key        = "country"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "province-index"
    hash_key        = "province"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "city-index"
    hash_key        = "city"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "tripType-index"
    hash_key        = "tripType"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "vehicle-index"
    hash_key        = "vehicle"
    projection_type = "ALL"
  }
}

# --- Favorite table (TASK-016) ---------------------------------------------
# Composite key (tripId, userId) enforces one favorite per user per trip: the
# favorites Lambda writes with a conditional put (attribute_not_exists) so a
# duplicate favorite fails (TEST-007). userId GSI backs the "saved trips" view
# (GET /favorites) — KEYS_ONLY is enough since it returns tripIds to batch-get.
resource "aws_dynamodb_table" "favorite" {
  name         = "${local.name_prefix}-Favorite"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tripId"
  range_key    = "userId"

  attribute {
    name = "tripId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "KEYS_ONLY"
  }
}
