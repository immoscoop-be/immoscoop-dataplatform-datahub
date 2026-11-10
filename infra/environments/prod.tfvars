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

# Who gets Admin when no User of Admin can still sign in (EC-PL-03, TR-UM-06): the first of them to sign in then
break_glass_admins = [
  "maxime@thenextimmoscoop.be",
  "maxime@immoscoop.be",
  "stefan.demeijer@immoscoop.be",
  "sibe.peetermans@thenextimmoscoop.be",
  "sibe.peetermans@immoscoop.be",
  "marc.vangoolen@thenextimmoscoop.be",
  "marc.vangoolen@immoscoop.be",
]
