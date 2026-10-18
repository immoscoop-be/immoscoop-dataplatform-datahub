output "service_urls" {
  description = "The address of every service."
  value       = { for name, service in google_cloud_run_v2_service.service : name => service.uri }
}

output "identity_url" {
  description = "The issuer of the Access Tokens; the login callback for Sign in with Google is on this address."
  value       = local.identity_url
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
