# The Artifacts of the dbt projects, stored unchanged per project and per run (FR-AR-06).

resource "google_storage_bucket" "artifacts" {
  name                        = "${var.project_id}-datahub-artifacts"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
}

resource "google_storage_bucket_iam_member" "registry_artifacts" {
  bucket = google_storage_bucket.artifacts.name
  role   = "roles/storage.objectAdmin"
  member = google_service_account.service["registry"].member
}
