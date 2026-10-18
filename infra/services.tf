# The services and applications on Cloud Run (TR-PF-01), all publicly reachable: every request is
# checked by the service itself (DEC-PF-10, TR-PF-14), so Cloud Run does not check callers.
# semgraph checks nobody: it is open to everyone and holds no data (DEC-PF-24). Until its rate limit
# stands in front of it (TR-PF-30), the maximum number of instances caps what that can cost.

resource "google_cloud_run_v2_service" "service" {
  for_each = local.services

  name                 = "datahub-${each.key}"
  location             = var.region
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = true
  deletion_protection  = var.deletion_protection

  template {
    service_account = google_service_account.service[each.key].email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = local.images[each.key]

      ports {
        container_port = 8080
      }

      dynamic "env" {
        for_each = merge(local.common_env, local.service_env[each.key])
        content {
          name  = env.key
          value = env.value
        }
      }

      resources {
        cpu_idle = true
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
      }
    }
  }

  # A service gets its new revision only once the migrations of this code have run (TR-PF-09).
  depends_on = [
    google_cloud_run_v2_job.migrate,
    google_project_iam_member.database_client,
    google_project_iam_member.database_login,
    google_kms_crypto_key_iam_member.identity_signs,
    google_secret_manager_secret_iam_member.reader,
    google_storage_bucket_iam_member.registry_artifacts,
    google_cloud_run_v2_job_iam_member.registry_starts_ingest,
  ]
}
