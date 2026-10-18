project_id          = "immoscoop-dataplatform-398214"
environment         = "prod"
database_tier       = "db-g1-small"
deletion_protection = true

# Rotate once a year and on any suspicion (README.md#rotating-the-signing-key)
token_signing_key_versions = {
  "2026" = "ENABLED"
}
