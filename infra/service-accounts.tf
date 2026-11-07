# One service account per service, with only what its responsibility needs (DEC-PF-08, TR-PF-11).

resource "google_service_account" "service" {
  for_each = local.services

  account_id   = "datahub-${each.key}"
  display_name = "Data Hub ${each.key}"
  description  = "Runs the ${each.key} service of Data Hub (${var.environment})."
}

resource "google_project_iam_member" "database_client" {
  for_each = local.database_services

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = google_service_account.service[each.key].member
}

# Logging in to Postgres with the service's own Google identity: no database passwords.
resource "google_project_iam_member" "database_login" {
  for_each = local.database_services

  project = var.project_id
  role    = "roles/cloudsql.instanceUser"
  member  = google_service_account.service[each.key].member
}

# The identity of the migration jobs (TR-PF-09): it owns the schemas and their tables; the
# services can only read and write rows (TR-PF-22). No service runs as it.
resource "google_service_account" "migrator" {
  account_id   = "datahub-migrator"
  display_name = "Data Hub migrator"
  description  = "Runs the database migrations of Data Hub (${var.environment}); used by the migration jobs only."
}

resource "google_project_iam_member" "migrator" {
  for_each = toset(["roles/cloudsql.client", "roles/cloudsql.instanceUser"])

  project = var.project_id
  role    = each.key
  member  = google_service_account.migrator.member
}

# query runs the queries on the Resources (TR-PF-11), as BigQuery jobs in the project of Data Hub.
resource "google_project_iam_member" "query_jobs" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = google_service_account.service["query"].member
}

# ...and reads every table of the project, where the tables of its dbt projects are (DEC-SR-32).
# Who reads what is decided in Data Hub: a query reads only its own Resources (TR-SR-15).
resource "google_project_iam_member" "query_reads" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = google_service_account.service["query"].member
}
