# One Postgres instance per environment, one schema per service (DEC-PF-05, TR-PF-08).
# Everyone logs in with IAM database authentication: no passwords (TR-PF-22). The migration
# jobs log in as datahub-migrator, which creates the schemas and tables and gives each service
# access to the rows of its own schema only (TR-PF-09, migrations.tf), and the Data Team read
# access to the schemas it may read (TR-PF-28).

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

# A member of cloudsqlsuperuser, the most Cloud SQL allows: it creates the schemas.
resource "google_sql_user" "migrator" {
  instance       = google_sql_database_instance.main.name
  name           = trimsuffix(google_service_account.migrator.email, ".gserviceaccount.com")
  type           = "CLOUD_IAM_SERVICE_ACCOUNT"
  database_roles = ["cloudsqlsuperuser"]
}

resource "google_sql_user" "service" {
  for_each = local.database_services

  instance = google_sql_database_instance.main.name
  name     = trimsuffix(google_service_account.service[each.key].email, ".gserviceaccount.com")
  type     = "CLOUD_IAM_SERVICE_ACCOUNT"
}

# The Data Team reads the tables in Cloud SQL Studio as members of its Role Group: the group is the
# database login, so Workspace decides who may look (TR-PF-28). What it may read, read-only, the
# migration jobs grant.
resource "google_sql_user" "reader" {
  for_each = toset(local.database_readers)

  instance = google_sql_database_instance.main.name
  name     = each.key
  type     = "CLOUD_IAM_GROUP"
}

resource "google_project_iam_member" "reader_studio" {
  for_each = toset(local.database_readers)

  project = var.project_id
  role    = "roles/cloudsql.studioUser"
  member  = "group:${each.key}"
}
