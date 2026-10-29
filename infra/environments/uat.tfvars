project_id          = "immoscoop-dataplatform"
environment         = "uat"
database_tier       = "db-f1-micro"
deletion_protection = false

# Rotate once a year and on any suspicion (README.md#rotating-the-signing-key)
token_signing_key_versions = {
  "2026" = "ENABLED"
}

# The Source Jobs this environment reads: dbt-prod and Colleciónes (DEC-AR-01)
dbt_source_jobs = {
  "9367"  = "322951"
  "17121" = "739003"
}

# Who the e-mail of Data Hub comes from; replies are not read (DEC-PF-31)
mail_from = "Data Hub uat <datahub@immoscoop.be>"
