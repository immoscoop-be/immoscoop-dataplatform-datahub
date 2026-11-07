# Terraform creates the secrets and decides who may read them; their values are added by a
# person (docs/architecture/gcp-setup.md, step 8). Services read them through the API when
# they need them, so a secret without a value yet does not block a deployment.

locals {
  secrets = {
    "datahub-dbt-cloud-token"     = "registry"  # fetching the Artifacts from dbt Cloud
    "datahub-dbt-webhook-secret"  = "registry"  # checking that a webhook comes from dbt Cloud
    "datahub-google-oauth-client" = "identity"  # Sign in with Google
    "datahub-slack-bot-token"     = "catalogue" # direct messages from the Slack app of Data Hub (DEC-LN-05)
  }
}

resource "google_secret_manager_secret" "secret" {
  for_each = local.secrets

  secret_id = each.key

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "reader" {
  for_each = local.secrets

  secret_id = google_secret_manager_secret.secret[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.service[each.value].member
}
