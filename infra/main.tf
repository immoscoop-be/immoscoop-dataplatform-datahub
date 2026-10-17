provider "google" {
  project = var.project_id
  region  = var.region

  default_labels = {
    app         = "datahub"
    environment = var.environment
  }
}

data "google_project" "this" {}

locals {
  # Every service of Data Hub (docs/architecture/README.md#services).
  services = toset(["identity", "catalogue", "registry", "query"])

  # The services that keep data in Postgres, each in its own schema (TR-PF-08).
  # query stores nothing in v1 (DEC-SR-18).
  database_services = toset(["identity", "catalogue", "registry"])

  # Cloud Run gives every service a fixed address, so identity's address is known
  # before it exists: every service needs it to validate Access Tokens.
  identity_url = "https://datahub-identity-${data.google_project.this.number}.${var.region}.run.app"

  common_env = {
    DATAHUB_ENVIRONMENT    = var.environment
    DATAHUB_TOKEN_ISSUER   = local.identity_url
    DATAHUB_TOKEN_AUDIENCE = var.token_audience
    DATAHUB_JWKS_URL       = "${local.identity_url}/.well-known/jwks.json"
  }

  database_env = {
    DATAHUB_DB_INSTANCE = google_sql_database_instance.main.connection_name
    DATAHUB_DB_NAME     = google_sql_database.datahub.name
  }

  service_env = {
    identity  = merge(local.database_env, local.token_signing_env)
    catalogue = local.database_env
    registry  = merge(local.database_env, { DATAHUB_ARTIFACT_BUCKET = google_storage_bucket.artifacts.name })
    query     = {}
  }
}
