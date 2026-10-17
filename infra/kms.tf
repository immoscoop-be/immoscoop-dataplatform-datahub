# The key identity signs Access Tokens with (DEC-PF-17, TR-PF-24). It lives in Cloud KMS: the
# private key never leaves Google, and only identity may sign with it.
#
# Google never deletes key rings or keys, only key versions, so these names are taken for good.
# In prod Terraform refuses to destroy the key, as that would destroy every version and log
# everyone out.

resource "google_kms_key_ring" "datahub" {
  name     = "datahub"
  location = var.region
}

resource "google_kms_crypto_key" "access_token" {
  name            = "access-token"
  key_ring        = google_kms_key_ring.datahub.id
  purpose         = "ASYMMETRIC_SIGN"
  deletion_policy = var.deletion_protection ? "PREVENT" : "DELETE"

  # The versions are listed in var.token_signing_key_versions, so a rotation is a change here.
  skip_initial_version_creation = true

  version_template {
    algorithm        = "EC_SIGN_P256_SHA256" # ES256, the only algorithm @datahub/auth accepts
    protection_level = "SOFTWARE"
  }
}

resource "google_kms_crypto_key_version" "access_token" {
  for_each = var.token_signing_key_versions

  crypto_key = google_kms_crypto_key.access_token.id
  state      = each.value
}

resource "google_kms_crypto_key_iam_member" "identity_signs" {
  crypto_key_id = google_kms_crypto_key.access_token.id
  role          = "roles/cloudkms.signerVerifier"
  member        = google_service_account.service["identity"].member
}

locals {
  enabled_token_signing_keys = sort([for label, state in var.token_signing_key_versions : label if state == "ENABLED"])

  # identity signs with the newest enabled version and publishes every enabled version, so
  # tokens signed before a rotation stay valid until the previous version is disabled.
  token_signing_env = {
    DATAHUB_TOKEN_SIGNING_KEY = google_kms_crypto_key_version.access_token[element(local.enabled_token_signing_keys, length(local.enabled_token_signing_keys) - 1)].name
    DATAHUB_TOKEN_PUBLIC_KEYS = join(",", [for label in local.enabled_token_signing_keys : google_kms_crypto_key_version.access_token[label].name])
  }
}
