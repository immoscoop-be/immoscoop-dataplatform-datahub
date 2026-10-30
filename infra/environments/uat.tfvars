project_id          = "immoscoop-dataplatform"
environment         = "uat"
database_tier       = "db-f1-micro"
deletion_protection = false

# Rotate once a year and on any suspicion (README.md#rotating-the-signing-key)
token_signing_key_versions = {
  "2026" = "ENABLED"
}

# The Source Jobs this environment reads, the merge builds of uat (DEC-AR-09). dbt-prod
# keeps its daily UAT build until its own merge build exists (OP-AR-09).
dbt_source_jobs = {
  "9367"  = "322951"
  "17121" = "748279"
}
