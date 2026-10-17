# One Postgres instance per environment, one schema per service (DEC-PF-05, TR-PF-08).
# The services log in with IAM database authentication; the schemas and their grants are
# created by the migrations of each service (TR-PF-09).

resource "google_sql_database_instance" "main" {
  name                = "datahub-${var.environment}"
  database_version    = "POSTGRES_17"
  region              = var.region
  deletion_protection = var.deletion_protection

  settings {
    edition                     = "ENTERPRISE"
    tier                        = var.database_tier
    availability_type           = "ZONAL"
    disk_autoresize             = true
    deletion_protection_enabled = var.deletion_protection

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.environment == "prod"
    }

    ip_configuration {
      # Reached only through the Cloud SQL connector, which encrypts and checks IAM;
      # no network is allowed to connect directly.
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
  }
}

resource "google_sql_database" "datahub" {
  name     = "datahub"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "service" {
  for_each = local.database_services

  instance = google_sql_database_instance.main.name
  name     = trimsuffix(google_service_account.service[each.key].email, ".gserviceaccount.com")
  type     = "CLOUD_IAM_SERVICE_ACCOUNT"
}
