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

# query runs the queries on the Stacks (TR-PF-11). Read access to the Stacks themselves
# is still open (OP-PF-14).
resource "google_project_iam_member" "query_jobs" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = google_service_account.service["query"].member
}
