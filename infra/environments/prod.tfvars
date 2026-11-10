project_id          = "immoscoop-dataplatform-398214"
environment         = "prod"
database_tier       = "db-g1-small"
deletion_protection = true

# Rotate once a year and on any suspicion (README.md#rotating-the-signing-key)
token_signing_key_versions = {
  "2026" = "ENABLED"
}

# Who the e-mail of Data Hub comes from; replies are not read (DEC-PF-31)
mail_from = "Data Hub <datahub@immoscoop.be>"

# Who gets Admin when no User of Admin can still sign in (EC-PL-03); addresses to come from Max
break_glass_admins = []
