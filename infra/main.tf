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
  # Every service and application of Data Hub that runs on Cloud Run, with an image of its own
  # (docs/architecture/README.md#services).
  services = toset(["identity", "catalogue", "registry", "query", "semgraph", "mcp", "web"])

  # The services that keep data in Postgres, each in its own schema (TR-PF-08).
  # query stores nothing in v1 (DEC-SR-18).
  database_services = toset(["identity", "catalogue", "registry"])

  # Cloud Run gives every service a fixed address, so addresses are known before the services
  # exist: every service needs identity's to validate Access Tokens.
  urls         = { for name in local.services : name => "https://datahub-${name}-${data.google_project.this.number}.${var.region}.run.app" }
  identity_url = local.urls["identity"]

  common_env = {
    DATAHUB_ENVIRONMENT    = var.environment
    DATAHUB_TOKEN_ISSUER   = local.identity_url
    DATAHUB_TOKEN_AUDIENCE = var.token_audience
    DATAHUB_JWKS_URL       = "${local.identity_url}/.well-known/jwks.json"
    # The pages of the web app call the services from the browser (CORS).
    DATAHUB_ALLOWED_ORIGINS = local.urls["web"]
  }

  # The image of every service: exactly the code being applied (TR-PF-17).
  images = {
    for name in local.services :
    name => "${var.region}-docker.pkg.dev/${var.images_project_id}/${var.artifact_repository}/${name}:${var.image_tag}"
  }

  database = {
    DATAHUB_DB_INSTANCE = google_sql_database_instance.main.connection_name
    DATAHUB_DB_NAME     = google_sql_database.datahub.name
  }

  # People read the data as the Role Group of the Data Team, read-only, in Cloud SQL Studio, and only
  # the schemas of registry and catalogue: identity keeps sessions and personal data (TR-PF-28).
  database_readers  = ["datahub-datateam@${var.workspace_domain}"]
  readable_services = toset(["registry", "catalogue"])

  # Each service logs in to Postgres as itself (TR-PF-22).
  database_env = {
    for name in local.database_services :
    name => merge(local.database, { DATAHUB_DB_USER = google_sql_user.service[name].name })
  }

  # Signing in through Google, for the web app and MCP clients (TR-PF-06, TR-PF-25).
  sign_in_env = {
    DATAHUB_WORKSPACE_DOMAIN    = var.workspace_domain
    DATAHUB_GOOGLE_OAUTH_CLIENT = "${google_secret_manager_secret.secret["datahub-google-oauth-client"].id}/versions/latest"
    DATAHUB_MCP_REDIRECT_URIS   = join(",", var.mcp_redirect_uris)
    # The server of the web app, a client of identity known in advance (TR-PF-27).
    DATAHUB_WEB_REDIRECT_URI = "${local.urls["web"]}/auth/callback"
  }

  # registry and its ingest job: where the Artifacts come from and where they go (TR-AR-01, TR-AR-02).
  ingest_job = "datahub-registry-ingest"
  registry_env = merge(local.database_env["registry"], {
    DATAHUB_ARTIFACT_BUCKET    = google_storage_bucket.artifacts.name
    DATAHUB_DBT_CLOUD_URL      = var.dbt_cloud_url
    DATAHUB_DBT_ACCOUNT_ID     = var.dbt_account_id
    DATAHUB_DBT_SOURCE_JOBS    = join(",", [for project, job in var.dbt_source_jobs : "${project}:${job}"])
    DATAHUB_DBT_CLOUD_TOKEN    = "${google_secret_manager_secret.secret["datahub-dbt-cloud-token"].id}/versions/latest"
    DATAHUB_DBT_WEBHOOK_SECRET = "${google_secret_manager_secret.secret["datahub-dbt-webhook-secret"].id}/versions/latest"
    DATAHUB_INGEST_JOB         = "projects/${var.project_id}/locations/${var.region}/jobs/${local.ingest_job}"
  })

  service_env = {
    identity  = merge(local.database_env["identity"], local.token_signing_env, local.sign_in_env)
    catalogue = local.database_env["catalogue"]
    registry  = local.registry_env
    query     = {}
    # The Chart Server is open to everyone, its MCP server too (DEC-PF-24).
    semgraph = { MCP_AUTH = "none" }
    # The MCP endpoint Claude connects to (TR-PF-06).
    mcp = { DATAHUB_MCP_RESOURCE = "${local.urls["mcp"]}/mcp" }
    # The web app signs Users in at its own address (DEC-PF-19); its page searches registry and
    # shows the charts of semgraph.
    web = {
      DATAHUB_WEB_URL      = local.urls["web"]
      DATAHUB_REGISTRY_URL = local.urls["registry"]
      DATAHUB_SEMGRAPH_URL = local.urls["semgraph"]
    }
  }
}
