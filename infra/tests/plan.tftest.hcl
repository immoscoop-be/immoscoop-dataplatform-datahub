# Plans the infrastructure against a mocked Google provider, so the logic is tested
# without GCP: terraform test (runs in CI).

mock_provider "google" {
  mock_data "google_project" {
    defaults = {
      number = "123456789"
    }
  }
}

variables {
  project_id          = "test-project"
  environment         = "uat"
  database_tier       = "db-f1-micro"
  deletion_protection = false
  image_tag           = "tree-abc123"

  token_signing_key_versions = {
    "2026" = "ENABLED"
  }
}

run "every_service_runs_the_shared_image_of_this_code" {
  command = plan

  assert {
    condition     = length(google_cloud_run_v2_service.service) == 6
    error_message = "Expected identity, catalogue, registry, query, mcp and web."
  }

  assert {
    condition     = google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].image == "europe-west1-docker.pkg.dev/immoscoop-dataplatform-398214/datahub/catalogue:tree-abc123"
    error_message = "A service must run its image from the shared repository, by the tree tag of the code."
  }

  assert {
    condition     = google_cloud_run_v2_service.service["query"].name == "datahub-query"
    error_message = "Service names are prefixed with datahub-, as the projects are shared."
  }
}

run "every_service_knows_where_identity_is" {
  command = plan

  assert {
    condition     = output.identity_url == "https://datahub-identity-123456789.europe-west1.run.app"
    error_message = "identity's address must follow Cloud Run's fixed address format."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["registry"].template[0].containers[0].env : env.value if env.name == "DATAHUB_JWKS_URL"],
      "https://datahub-identity-123456789.europe-west1.run.app/.well-known/jwks.json"
    )
    error_message = "Every service must get the JWKS URL of identity to validate Access Tokens."
  }
}

run "services_are_public_and_check_tokens_themselves" {
  command = plan

  assert {
    condition     = alltrue([for service in google_cloud_run_v2_service.service : service.invoker_iam_disabled && service.ingress == "INGRESS_TRAFFIC_ALL"])
    error_message = "Services are publicly reachable; the token check in each service protects them (DEC-PF-10)."
  }
}

run "only_services_with_data_get_a_database_login" {
  command = plan

  assert {
    condition     = toset(keys(google_sql_user.service)) == toset(["identity", "catalogue", "registry"])
    error_message = "query stores nothing in v1 and gets no database login."
  }

  assert {
    condition     = alltrue([for user in google_sql_user.service : user.type == "CLOUD_IAM_SERVICE_ACCOUNT"])
    error_message = "Services log in with their Google identity, never with a password."
  }
}

run "only_the_right_service_reads_each_secret" {
  command = plan

  assert {
    condition     = google_secret_manager_secret_iam_member.reader["datahub-dbt-cloud-token"].role == "roles/secretmanager.secretAccessor"
    error_message = "registry must be able to read the dbt Cloud token."
  }

  assert {
    condition     = length(google_secret_manager_secret_iam_member.reader) == 2
    error_message = "Each secret has exactly one reader."
  }
}

run "only_identity_signs_access_tokens_with_an_es256_key_in_kms" {
  command = plan

  override_resource {
    target          = google_service_account.service["identity"]
    override_during = plan
    values = {
      member = "serviceAccount:datahub-identity@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition     = google_kms_crypto_key.access_token.purpose == "ASYMMETRIC_SIGN" && google_kms_crypto_key.access_token.version_template[0].algorithm == "EC_SIGN_P256_SHA256"
    error_message = "Access Tokens are signed with an ES256 key in Cloud KMS, the only algorithm @datahub/auth accepts (TR-PF-24)."
  }

  assert {
    condition     = google_kms_crypto_key_iam_member.identity_signs.member == "serviceAccount:datahub-identity@test-project.iam.gserviceaccount.com" && google_kms_crypto_key_iam_member.identity_signs.role == "roles/cloudkms.signerVerifier"
    error_message = "identity must be able to sign with the key."
  }

  assert {
    condition = alltrue([
      for name in ["catalogue", "registry", "query"] :
      !contains([for env in google_cloud_run_v2_service.service[name].template[0].containers[0].env : env.name], "DATAHUB_TOKEN_SIGNING_KEY")
    ])
    error_message = "Only identity is told which key signs Access Tokens."
  }
}

run "the_newest_enabled_key_version_signs_and_all_enabled_versions_are_published" {
  command = plan

  variables {
    token_signing_key_versions = {
      "2025" = "DISABLED"
      "2026" = "ENABLED"
      "2027" = "ENABLED"
    }
  }

  override_resource {
    target          = google_kms_crypto_key_version.access_token["2025"]
    override_during = plan
    values          = { name = "key/cryptoKeyVersions/1" }
  }

  override_resource {
    target          = google_kms_crypto_key_version.access_token["2026"]
    override_during = plan
    values          = { name = "key/cryptoKeyVersions/2" }
  }

  override_resource {
    target          = google_kms_crypto_key_version.access_token["2027"]
    override_during = plan
    values          = { name = "key/cryptoKeyVersions/3" }
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["identity"].template[0].containers[0].env : env.value if env.name == "DATAHUB_TOKEN_SIGNING_KEY"],
      "key/cryptoKeyVersions/3"
    )
    error_message = "identity must sign with the newest enabled version of the key."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["identity"].template[0].containers[0].env : env.value if env.name == "DATAHUB_TOKEN_PUBLIC_KEYS"],
      "key/cryptoKeyVersions/2,key/cryptoKeyVersions/3"
    )
    error_message = "identity must publish every enabled version, and no disabled one, so tokens from before a rotation stay valid."
  }
}

run "a_signing_key_without_an_enabled_version_is_refused" {
  command = plan

  variables {
    token_signing_key_versions = {
      "2026" = "DISABLED"
    }
  }

  expect_failures = [var.token_signing_key_versions]
}

run "migrations_run_as_their_own_identity_with_the_image_of_the_service" {
  command = plan

  override_resource {
    target          = google_service_account.migrator
    override_during = plan
    values = {
      email  = "datahub-migrator@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-migrator@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition     = toset(keys(google_cloud_run_v2_job.migrate)) == toset(["identity", "catalogue", "registry"])
    error_message = "Every service that keeps data, and only those, has a migration job."
  }

  assert {
    condition = alltrue([
      for name, job in google_cloud_run_v2_job.migrate :
      job.template[0].template[0].containers[0].image == google_cloud_run_v2_service.service[name].template[0].containers[0].image
    ])
    error_message = "A migration job runs the same image as the service it migrates."
  }

  assert {
    condition = alltrue([
      for job in google_cloud_run_v2_job.migrate :
      job.template[0].template[0].service_account == "datahub-migrator@test-project.iam.gserviceaccount.com" && job.template[0].template[0].containers[0].command == tolist(["node", "dist/migrate.js"])
    ])
    error_message = "Migrations run dist/migrate.js as datahub-migrator, never as the service itself."
  }

  assert {
    condition     = google_sql_user.migrator.database_roles == tolist(["cloudsqlsuperuser"]) && alltrue([for user in google_sql_user.service : user.database_roles == null])
    error_message = "Only the migrator may create schemas; the services get no database roles."
  }

  assert {
    condition     = length(google_cloud_run_v2_service.service["query"].template[0].containers[0].env) == length(local.common_env)
    error_message = "query keeps no data, so it gets no database settings."
  }
}

run "every_new_image_runs_the_migrations_once" {
  command = plan

  variables {
    image_tag = "tree-0123456789abcdef0123456789abcdef01234567"
  }

  assert {
    condition     = alltrue([for job in google_cloud_run_v2_job.migrate : job.run_execution_token == "tree-0123456789ab"])
    error_message = "The migrations run again for every new image of the code."
  }

  assert {
    condition     = alltrue([for job in google_cloud_run_v2_job.migrate : length(job.name) + length(job.run_execution_token) < 63])
    error_message = "Cloud Run refuses a job name and execution token of 63 characters or more together."
  }
}

run "identity_signs_in_only_the_own_domain_and_known_mcp_clients" {
  command = plan

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["identity"].template[0].containers[0].env : env.value if env.name == "DATAHUB_WORKSPACE_DOMAIN"],
      "thenextimmoscoop.be"
    )
    error_message = "Only accounts of thenextimmoscoop.be may sign in (DEC-UM-06)."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["identity"].template[0].containers[0].env : env.value if env.name == "DATAHUB_MCP_REDIRECT_URIS"],
      "https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback"
    )
    error_message = "MCP clients may only register Claude's callbacks."
  }

  assert {
    condition = alltrue([
      for name in ["catalogue", "registry", "query"] :
      !contains([for env in google_cloud_run_v2_service.service[name].template[0].containers[0].env : env.name], "DATAHUB_GOOGLE_OAUTH_CLIENT")
    ])
    error_message = "Only identity knows where the OAuth client is."
  }
}

run "claude_finds_mcp_and_signs_in_at_identity" {
  command = plan

  assert {
    condition     = output.mcp_url == "https://datahub-mcp-123456789.europe-west1.run.app/mcp"
    error_message = "mcp's address must follow Cloud Run's fixed address format, with the endpoint /mcp."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["mcp"].template[0].containers[0].env : env.value if env.name == "DATAHUB_MCP_RESOURCE"],
      "https://datahub-mcp-123456789.europe-west1.run.app/mcp"
    )
    error_message = "mcp must know its own address, which it gives to MCP clients as the protected resource."
  }

  assert {
    condition     = !contains(keys(google_cloud_run_v2_job.migrate), "mcp") && !contains(keys(google_sql_user.service), "mcp")
    error_message = "mcp keeps no data: no database login, no migrations."
  }
}

run "the_web_app_signs_in_at_its_own_address_and_may_call_the_services" {
  command = plan

  assert {
    condition     = output.web_url == "https://datahub-web-123456789.europe-west1.run.app"
    error_message = "The web app's address must follow Cloud Run's fixed address format."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["identity"].template[0].containers[0].env : env.value if env.name == "DATAHUB_WEB_REDIRECT_URI"],
      "https://datahub-web-123456789.europe-west1.run.app/auth/callback"
    )
    error_message = "identity knows the web app as a client, with its callback on the web app's own address."
  }

  assert {
    condition = alltrue([
      for service in google_cloud_run_v2_service.service :
      contains([for env in service.template[0].containers[0].env : env.value if env.name == "DATAHUB_ALLOWED_ORIGINS"], "https://datahub-web-123456789.europe-west1.run.app")
    ])
    error_message = "Every service accepts calls from the pages of the web app, and only from there."
  }
}

run "uat_can_be_torn_down" {
  command = plan

  assert {
    condition     = !google_sql_database_instance.main.deletion_protection
    error_message = "uat has no deletion protection."
  }
}

run "prod_is_protected_and_recoverable" {
  command = plan

  variables {
    project_id          = "test-prod"
    environment         = "prod"
    database_tier       = "db-g1-small"
    deletion_protection = true
  }

  assert {
    condition     = google_sql_database_instance.main.deletion_protection && google_sql_database_instance.main.settings[0].deletion_protection_enabled
    error_message = "The prod database must be protected against deletion, in Terraform and in GCP."
  }

  assert {
    condition     = google_sql_database_instance.main.settings[0].backup_configuration[0].point_in_time_recovery_enabled
    error_message = "prod must support point-in-time recovery."
  }

  assert {
    condition     = alltrue([for service in google_cloud_run_v2_service.service : service.deletion_protection])
    error_message = "prod services must be protected against deletion."
  }

  assert {
    condition     = google_kms_crypto_key.access_token.deletion_policy == "PREVENT"
    error_message = "Terraform must never destroy the prod signing key: that would log everyone out."
  }
}

run "an_unknown_environment_is_refused" {
  command = plan

  variables {
    environment = "dev"
  }

  expect_failures = [var.environment]
}
