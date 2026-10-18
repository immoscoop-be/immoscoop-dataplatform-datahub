# The migrations of each service that keeps data run as a separate step at deploy (TR-PF-09): a
# Cloud Run job with the new image of the service, which Terraform runs and waits for. The
# service gets its new revision only after it (depends_on in services.tf); a failed migration
# stops the apply, and the running revision keeps serving.

resource "google_cloud_run_v2_job" "migrate" {
  for_each = local.database_services

  name                = "datahub-${each.key}-migrate"
  location            = var.region
  deletion_protection = var.deletion_protection

  # A new execution for every new image of the code, waited for until it has finished. Cloud Run
  # allows at most 62 characters for the job name and this token together.
  run_execution_token = substr(var.image_tag, 0, 17)

  template {
    task_count = 1

    template {
      service_account = google_service_account.migrator.email
      max_retries     = 0
      timeout         = "600s"

      containers {
        image   = local.images[each.key]
        command = ["node", "dist/migrate.js"]

        dynamic "env" {
          for_each = merge(
            local.database,
            {
              DATAHUB_DB_USER         = google_sql_user.migrator.name
              DATAHUB_DB_SERVICE_USER = google_sql_user.service[each.key].name
            },
            contains(local.readable_services, each.key) ? { DATAHUB_DB_READERS = join(",", [for reader in google_sql_user.reader : reader.name]) } : {},
          )
          content {
            name  = env.key
            value = env.value
          }
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_iam_member.migrator,
    google_sql_database.datahub,
    google_sql_user.migrator,
    google_sql_user.reader,
    google_sql_user.service,
  ]
}
