# The ingest job of registry (TR-AR-02, DEC-PF-20): it fetches, stores and processes the Artifact
# Sets that registry has recorded. registry starts it when dbt Cloud reports a run; it runs the
# image of registry under the same service account, without the time limit of a request.

resource "google_cloud_run_v2_job" "registry_ingest" {
  name                = local.ingest_job
  location            = var.region
  deletion_protection = var.deletion_protection

  template {
    task_count = 1

    template {
      service_account = google_service_account.service["registry"].email
      # A set that fails keeps its reason and does not fail the job; a job that stops halfway is
      # tried once more, and a set left in progress is taken again after an hour.
      max_retries = 1
      timeout     = "1800s"

      containers {
        image   = local.images["registry"]
        command = ["node", "dist/ingest.js"]

        dynamic "env" {
          for_each = merge(local.common_env, local.registry_env)
          content {
            name  = env.key
            value = env.value
          }
        }

        resources {
          # A manifest of a large dbt project is read into memory whole.
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }
    }
  }

  depends_on = [
    google_cloud_run_v2_job.migrate,
    google_project_iam_member.database_client,
    google_project_iam_member.database_login,
    google_secret_manager_secret_iam_member.reader,
    google_storage_bucket_iam_member.registry_artifacts,
  ]
}

# registry may start the job, and nothing else of it (TR-PF-11).
resource "google_cloud_run_v2_job_iam_member" "registry_starts_ingest" {
  name     = google_cloud_run_v2_job.registry_ingest.name
  location = var.region
  role     = "roles/run.invoker"
  member   = google_service_account.service["registry"].member
}
