# The daily check of every Lens (FR-LE-17, DEC-LE-20): once a day Cloud Scheduler has query dry-run
# every Lens with its defaults, which finds a Lens that is Broken or that grew (DEC-LE-19). A dry run
# reads nothing and costs nothing. Cloud Run does not check callers, so query checks the Google ID
# token of the scheduler itself, for its own address (DEC-PF-10, TR-PF-14).

# The identity of the scheduled jobs: it holds no role; query knows it by its address.
resource "google_service_account" "scheduler" {
  account_id   = "datahub-scheduler"
  display_name = "Data Hub scheduler"
  description  = "Starts the scheduled jobs of Data Hub (${var.environment}), such as the daily check of every Lens; holds no roles."
}

resource "google_cloud_scheduler_job" "lens_check" {
  name        = "datahub-lens-check"
  description = "Dry-runs every Lens with its defaults, to find what is Broken or grew (FR-LE-17, DEC-LE-20)."
  region      = var.region
  # Early in the morning, after the nightly dbt runs and before the working day.
  schedule  = "17 5 * * *"
  time_zone = "Europe/Brussels"
  # As long as Cloud Run waits for an answer; a check that fails is tried once more.
  attempt_deadline = "300s"

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "${local.urls["query"]}/internal/lenses/check"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.urls["query"]
    }
  }

  depends_on = [google_cloud_run_v2_service.service]
}
