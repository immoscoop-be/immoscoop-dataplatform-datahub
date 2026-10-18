output "service_urls" {
  description = "The address of every service."
  value       = { for name, service in google_cloud_run_v2_service.service : name => service.uri }
}

output "identity_url" {
  description = "The issuer of the Access Tokens; the login callback for Sign in with Google is on this address."
  value       = local.identity_url
}

output "web_url" {
  description = "The web app: open it in a browser to sign in."
  value       = local.urls["web"]
}

output "semgraph_url" {
  description = "The Chart Server, open to everyone; its gallery is on /gallery, its MCP server on /mcp."
  value       = local.urls["semgraph"]
}

output "mcp_url" {
  description = "The address to add as a connector in Claude."
  value       = "${local.urls["mcp"]}/mcp"
}

output "database_connection_name" {
  description = "The Cloud SQL instance, as the Cloud SQL connector names it."
  value       = google_sql_database_instance.main.connection_name
}

output "artifact_bucket" {
  description = "Where registry keeps the Artifacts."
  value       = google_storage_bucket.artifacts.name
}

output "registry_webhook_url" {
  description = "The endpoint of the webhook in dbt Cloud (docs/architecture/gcp-setup.md, step 10)."
  value       = "${local.urls["registry"]}/webhooks/dbt-cloud"
}
