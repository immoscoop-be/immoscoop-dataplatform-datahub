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

  dbt_source_jobs = {
    "9367"  = "322951"
    "17121" = "739003"
  }

  mail_from = "Data Hub uat <datahub@immoscoop.be>"
}

run "every_service_runs_the_shared_image_of_this_code" {
  command = plan

  assert {
    condition     = length(google_cloud_run_v2_service.service) == 7
    error_message = "Expected identity, catalogue, registry, query, semgraph, mcp and web."
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

run "semgraph_is_open_to_everyone_and_reaches_no_data" {
  command = plan

  assert {
    condition     = contains([for env in google_cloud_run_v2_service.service["semgraph"].template[0].containers[0].env : "${env.name}=${env.value}"], "MCP_AUTH=none")
    error_message = "The MCP server of semgraph is open to everyone, like its API (DEC-PF-24)."
  }

  assert {
    condition     = !contains(keys(google_project_iam_member.database_client), "semgraph") && !contains(keys(google_project_iam_member.database_login), "semgraph")
    error_message = "semgraph is open without login, so it may never reach data (DEC-PF-24)."
  }

  assert {
    condition     = google_cloud_run_v2_service.service["semgraph"].template[0].scaling[0].max_instance_count <= 2
    error_message = "Until its rate limit is in place, the number of instances caps what an open semgraph can cost (TR-PF-30)."
  }

  assert {
    condition     = output.semgraph_url == "https://datahub-semgraph-123456789.europe-west1.run.app"
    error_message = "semgraph's address must follow Cloud Run's fixed address format."
  }
}

run "only_services_with_data_get_a_database_login" {
  command = plan

  assert {
    condition     = toset(keys(google_sql_user.service)) == toset(["identity", "catalogue", "registry", "query"])
    error_message = "identity, catalogue, registry and query keep data, and only they get a database login."
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
    condition     = google_secret_manager_secret_iam_member.reader["datahub-dbt-webhook-secret"].role == "roles/secretmanager.secretAccessor"
    error_message = "registry must be able to read the secret dbt Cloud signs its webhook with."
  }

  assert {
    condition     = google_secret_manager_secret_iam_member.reader["datahub-slack-bot-token"].role == "roles/secretmanager.secretAccessor"
    error_message = "catalogue must be able to read the bot token of the Slack app (DEC-LN-05)."
  }

  assert {
    condition     = length(google_secret_manager_secret_iam_member.reader) == 4
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
    condition     = toset(keys(google_cloud_run_v2_job.migrate)) == toset(["identity", "catalogue", "registry", "query"])
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
    condition     = length(google_cloud_run_v2_service.service["semgraph"].template[0].containers[0].env) == length(local.common_env) + 1
    error_message = "semgraph keeps no data, so it gets no database settings."
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

run "identity_signs_in_only_the_own_domains_and_known_mcp_clients" {
  command = plan

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["identity"].template[0].containers[0].env : env.value if env.name == "DATAHUB_WORKSPACE_DOMAIN"],
      "thenextimmoscoop.be,immoscoop.be"
    )
    error_message = "Only accounts of the two domains of the Workspace may sign in (DEC-UM-09)."
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

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["web"].template[0].containers[0].env : env.value if env.name == "DATAHUB_SEMGRAPH_URL"],
      "https://datahub-semgraph-123456789.europe-west1.run.app"
    )
    error_message = "The page of the web app shows the charts of semgraph, so it needs its address."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["web"].template[0].containers[0].env : env.value if env.name == "DATAHUB_REGISTRY_URL"],
      "https://datahub-registry-123456789.europe-west1.run.app"
    )
    error_message = "The page of the web app searches registry, at its fixed address."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["web"].template[0].containers[0].env : env.value if env.name == "DATAHUB_QUERY_URL"],
      "https://datahub-query-123456789.europe-west1.run.app"
    )
    error_message = "The page of the web app runs queries through query, at its fixed address."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["web"].template[0].containers[0].env : env.value if env.name == "DATAHUB_CATALOGUE_URL"],
      "https://datahub-catalogue-123456789.europe-west1.run.app"
    )
    error_message = "The page of the web app shows the Collections of catalogue, at its fixed address."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : env.value if env.name == "DATAHUB_TOKEN_ISSUER"],
      "https://datahub-identity-123456789.europe-west1.run.app"
    )
    error_message = "catalogue asks identity for the groups of the User, at the address of the issuer (TR-CO-03)."
  }
}

run "registry_starts_its_ingest_job_which_runs_its_image_as_registry" {
  command = plan

  override_resource {
    target          = google_service_account.service["registry"]
    override_during = plan
    values = {
      email  = "datahub-registry@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-registry@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition     = google_cloud_run_v2_job.registry_ingest.template[0].template[0].containers[0].image == google_cloud_run_v2_service.service["registry"].template[0].containers[0].image
    error_message = "The ingest job runs the same image as registry (DEC-PF-20)."
  }

  assert {
    condition     = google_cloud_run_v2_job.registry_ingest.template[0].template[0].containers[0].command == tolist(["node", "dist/ingest.js"])
    error_message = "The ingest job runs dist/ingest.js."
  }

  assert {
    condition     = google_cloud_run_v2_job.registry_ingest.template[0].template[0].service_account == "datahub-registry@test-project.iam.gserviceaccount.com"
    error_message = "The ingest job runs as registry, which may read the dbt Cloud token and write to the bucket."
  }

  assert {
    condition     = google_cloud_run_v2_job_iam_member.registry_starts_ingest.role == "roles/run.invoker" && google_cloud_run_v2_job_iam_member.registry_starts_ingest.member == "serviceAccount:datahub-registry@test-project.iam.gserviceaccount.com"
    error_message = "registry may start the ingest job, and only start it."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["registry"].template[0].containers[0].env : env.value if env.name == "DATAHUB_INGEST_JOB"],
      "projects/test-project/locations/europe-west1/jobs/datahub-registry-ingest"
    )
    error_message = "registry must know the full name of the job it starts."
  }

  assert {
    condition = (
      [for env in google_cloud_run_v2_job.registry_ingest.template[0].template[0].containers[0].env : env.value if env.name == "DATAHUB_DB_USER"]
      == [for env in google_cloud_run_v2_service.service["registry"].template[0].containers[0].env : env.value if env.name == "DATAHUB_DB_USER"]
    )
    error_message = "The ingest job logs in to Postgres as registry."
  }
}

run "registry_hands_catalogue_the_exposed_tables_as_itself" {
  command = plan

  override_resource {
    target          = google_service_account.service["registry"]
    override_during = plan
    values = {
      email  = "datahub-registry@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-registry@test-project.iam.gserviceaccount.com"
    }
  }

  # query tells catalogue about its Lenses as itself too (TR-CV-02).
  override_resource {
    target          = google_service_account.service["query"]
    override_during = plan
    values = {
      email  = "datahub-query@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-query@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_job.registry_ingest.template[0].template[0].containers[0].env : env.value if env.name == "DATAHUB_CATALOGUE_URL"],
      "https://datahub-catalogue-123456789.europe-west1.run.app"
    )
    error_message = "The ingest job hands the exposed tables to catalogue, at its fixed address (TR-AR-08)."
  }

  assert {
    condition = (
      [for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : env.value if env.name == "DATAHUB_REGISTRY_SERVICE_ACCOUNT"]
      == ["datahub-registry@test-project.iam.gserviceaccount.com"]
    )
    error_message = "catalogue takes the exposed tables from the service account of registry, and from no one else (TR-SR-01)."
  }

  assert {
    condition = (
      [for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : env.value if env.name == "DATAHUB_QUERY_SERVICE_ACCOUNT"]
      == ["datahub-query@test-project.iam.gserviceaccount.com"]
    )
    error_message = "catalogue hears about the Lenses and the decisions on them from the service account of query, and from no one else (TR-CV-02)."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : env.value if env.name == "DATAHUB_CATALOGUE_URL"],
      "https://datahub-catalogue-123456789.europe-west1.run.app"
    )
    error_message = "catalogue only accepts ID tokens issued for its own address."
  }
}

run "catalogue_reads_the_lineage_around_a_resource_from_registry_as_itself" {
  command = plan

  override_resource {
    target          = google_service_account.service["catalogue"]
    override_during = plan
    values = {
      email  = "datahub-catalogue@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-catalogue@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition = (
      [for env in google_cloud_run_v2_service.service["registry"].template[0].containers[0].env : env.value if env.name == "DATAHUB_CATALOGUE_SERVICE_ACCOUNT"]
      == ["datahub-catalogue@test-project.iam.gserviceaccount.com"]
    )
    error_message = "registry gives the lineage around a Resource to the service account of catalogue, and to no one else (DEC-AR-06)."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["registry"].template[0].containers[0].env : env.value if env.name == "DATAHUB_REGISTRY_URL"],
      "https://datahub-registry-123456789.europe-west1.run.app"
    )
    error_message = "registry only accepts ID tokens issued for its own address."
  }

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : env.value if env.name == "DATAHUB_REGISTRY_URL"],
      "https://datahub-registry-123456789.europe-west1.run.app"
    )
    error_message = "catalogue asks registry at its fixed address."
  }

  assert {
    condition     = length([for env in google_cloud_run_v2_job.registry_ingest.template[0].template[0].containers[0].env : env.name if env.name == "DATAHUB_CATALOGUE_SERVICE_ACCOUNT"]) == 0
    error_message = "The ingest job answers no one: it needs no caller to accept."
  }
}

run "registry_reads_the_source_jobs_of_its_own_environment" {
  command = plan

  assert {
    condition = contains(
      [for env in google_cloud_run_v2_job.registry_ingest.template[0].template[0].containers[0].env : env.value if env.name == "DATAHUB_DBT_SOURCE_JOBS"],
      "17121:739003,9367:322951"
    )
    error_message = "The Source Jobs reach registry and its job as <project>:<job> (DEC-AR-01)."
  }

  assert {
    condition     = output.registry_webhook_url == "https://datahub-registry-123456789.europe-west1.run.app/webhooks/dbt-cloud"
    error_message = "The webhook endpoint to give dbt Cloud is registry's /webhooks/dbt-cloud."
  }
}

run "source_jobs_are_named_by_their_ids" {
  command = plan

  variables {
    dbt_source_jobs = {
      "dbt-prod" = "daily build"
    }
  }

  expect_failures = [var.dbt_source_jobs]
}

run "the_data_team_reads_registry_catalogue_and_query_in_cloud_sql_studio" {
  command = plan

  assert {
    condition     = google_sql_user.reader["datahub-datateam@thenextimmoscoop.be"].type == "CLOUD_IAM_GROUP"
    error_message = "The Role Group of the Data Team is the database login of people, so Workspace decides who may look (TR-PF-28)."
  }

  assert {
    condition     = length(google_sql_user.reader) == 1 && alltrue([for user in google_sql_user.reader : user.password == null])
    error_message = "Only the Data Team may look, and never with a password."
  }

  assert {
    condition     = google_project_iam_member.reader_studio["datahub-datateam@thenextimmoscoop.be"].role == "roles/cloudsql.studioUser" && google_project_iam_member.reader_studio["datahub-datateam@thenextimmoscoop.be"].member == "group:datahub-datateam@thenextimmoscoop.be"
    error_message = "The Data Team reads through Cloud SQL Studio."
  }

  assert {
    condition = alltrue([
      for name in ["registry", "catalogue", "query"] :
      contains([for env in google_cloud_run_v2_job.migrate[name].template[0].template[0].containers[0].env : env.value if env.name == "DATAHUB_DB_READERS"], "datahub-datateam@thenextimmoscoop.be")
    ])
    error_message = "The migrations of registry, catalogue and query give the Data Team read access (DEC-PF-29)."
  }

  assert {
    condition     = length([for env in google_cloud_run_v2_job.migrate["identity"].template[0].template[0].containers[0].env : env if env.name == "DATAHUB_DB_READERS"]) == 0
    error_message = "Nobody reads identity's sessions and personal data."
  }
}

run "query_runs_jobs_reads_the_tables_and_asks_catalogue" {
  command = plan

  override_resource {
    target          = google_service_account.service["query"]
    override_during = plan
    values = {
      member = "serviceAccount:datahub-query@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition     = google_project_iam_member.query_jobs.role == "roles/bigquery.jobUser" && google_project_iam_member.query_jobs.member == "serviceAccount:datahub-query@test-project.iam.gserviceaccount.com"
    error_message = "query runs its queries as BigQuery jobs, as itself."
  }

  assert {
    condition     = google_project_iam_member.query_reads.role == "roles/bigquery.dataViewer" && google_project_iam_member.query_reads.project == "test-project" && google_project_iam_member.query_reads.member == "serviceAccount:datahub-query@test-project.iam.gserviceaccount.com"
    error_message = "query reads the tables of the project of Data Hub, and nothing more than reading (DEC-SR-32)."
  }

  assert {
    condition = alltrue([
      for pair in [["DATAHUB_CATALOGUE_URL", "https://datahub-catalogue-123456789.europe-west1.run.app"], ["DATAHUB_BIGQUERY_PROJECT", "test-project"], ["DATAHUB_BIGQUERY_LOCATION", "europe-west1"]] :
      contains([for env in google_cloud_run_v2_service.service["query"].template[0].containers[0].env : env.value if env.name == pair[0]], pair[1])
    ])
    error_message = "query asks catalogue what the User may see, and runs its jobs in the project and location of Data Hub."
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

run "the_scheduler_checks_every_lens_once_a_day_with_its_own_token" {
  command = plan

  override_resource {
    target          = google_service_account.scheduler
    override_during = plan
    values = {
      email  = "datahub-scheduler@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-scheduler@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition     = google_cloud_scheduler_job.lens_check.http_target[0].http_method == "POST" && google_cloud_scheduler_job.lens_check.http_target[0].uri == "https://datahub-query-123456789.europe-west1.run.app/internal/lenses/check"
    error_message = "The scheduler starts the daily check of every Lens at query (DEC-LE-20)."
  }

  assert {
    condition = (
      google_cloud_scheduler_job.lens_check.http_target[0].oidc_token[0].service_account_email == "datahub-scheduler@test-project.iam.gserviceaccount.com" &&
      google_cloud_scheduler_job.lens_check.http_target[0].oidc_token[0].audience == "https://datahub-query-123456789.europe-west1.run.app"
    )
    error_message = "The scheduler calls with a Google ID token of its own, for query's own address, which query checks itself (TR-PF-14)."
  }

  assert {
    condition = alltrue([
      contains([for env in google_cloud_run_v2_service.service["query"].template[0].containers[0].env : "${env.name}=${env.value}"], "DATAHUB_SCHEDULER_SERVICE_ACCOUNT=datahub-scheduler@test-project.iam.gserviceaccount.com"),
      contains([for env in google_cloud_run_v2_service.service["query"].template[0].containers[0].env : "${env.name}=${env.value}"], "DATAHUB_QUERY_URL=https://datahub-query-123456789.europe-west1.run.app"),
    ])
    error_message = "query must know the scheduler and its own address, to check who starts the daily check."
  }

  assert {
    condition     = google_cloud_scheduler_job.lens_check.schedule == "17 5 * * *" && google_cloud_scheduler_job.lens_check.time_zone == "Europe/Brussels"
    error_message = "Every Lens is checked once a day, early in the morning in Belgium, so a Broken one is found within a day (DEC-LE-20)."
  }
}

run "catalogue_has_query_check_what_reads_a_resource_that_changed" {
  command = plan

  override_resource {
    target          = google_service_account.service["catalogue"]
    override_during = plan
    values = {
      email  = "datahub-catalogue@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-catalogue@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition     = contains([for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : "${env.name}=${env.value}"], "DATAHUB_QUERY_URL=https://datahub-query-123456789.europe-west1.run.app")
    error_message = "catalogue must know where query is, to have it check what reads a Resource that changed (FR-SR-52)."
  }

  assert {
    condition     = contains([for env in google_cloud_run_v2_service.service["query"].template[0].containers[0].env : "${env.name}=${env.value}"], "DATAHUB_CATALOGUE_SERVICE_ACCOUNT=datahub-catalogue@test-project.iam.gserviceaccount.com")
    error_message = "query must know catalogue's service account, the only caller besides the scheduler that starts a check (FR-SR-52)."
  }
}

run "catalogue_sends_mail_from_one_fixed_address_and_nothing_else_does" {
  command = plan

  assert {
    condition     = google_compute_address.egress.address_type == "EXTERNAL" && google_compute_router_nat.datahub.nat_ip_allocate_option == "MANUAL_ONLY"
    error_message = "The traffic leaves from one static address of Data Hub, never one Google picks, as the SMTP relay of Workspace admits that address only (DEC-PF-31)."
  }

  assert {
    condition     = google_compute_router_nat.datahub.source_subnetwork_ip_ranges_to_nat == "LIST_OF_SUBNETWORKS" && google_compute_subnetwork.datahub.private_ip_google_access
    error_message = "Only the network of Data Hub goes out through the NAT; Google's own APIs stay on Google's network."
  }

  assert {
    condition     = google_cloud_run_v2_service.service["catalogue"].template[0].vpc_access[0].egress == "ALL_TRAFFIC"
    error_message = "All traffic of catalogue goes out through the fixed address, the mail to the relay included (DEC-PF-31)."
  }

  assert {
    condition     = alltrue([for name, service in google_cloud_run_v2_service.service : length(service.template[0].vpc_access) == 0 if name != "catalogue"])
    error_message = "Only catalogue sends notifications; the other services keep the network of Cloud Run."
  }
}

run "catalogue_notifies_by_mail_and_slack_and_asks_identity_who_as_itself" {
  command = plan

  override_resource {
    target          = google_service_account.service["catalogue"]
    override_during = plan
    values = {
      email  = "datahub-catalogue@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-catalogue@test-project.iam.gserviceaccount.com"
    }
  }

  override_resource {
    target          = google_secret_manager_secret.secret["datahub-slack-bot-token"]
    override_during = plan
    values = {
      id = "projects/test-project/secrets/datahub-slack-bot-token"
    }
  }

  assert {
    condition = alltrue([
      for pair in [
        "DATAHUB_SMTP_HOST=smtp-relay.gmail.com",
        "DATAHUB_SMTP_PORT=587",
        "DATAHUB_MAIL_FROM=Data Hub uat <datahub@immoscoop.be>",
        "DATAHUB_DATA_TEAM_EMAIL=datahub-datateam@thenextimmoscoop.be",
        "DATAHUB_WEB_URL=https://datahub-web-123456789.europe-west1.run.app",
        "DATAHUB_SLACK_BOT_TOKEN=projects/test-project/secrets/datahub-slack-bot-token/versions/latest",
      ] : contains([for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : "${env.name}=${env.value}"], pair)
    ])
    error_message = "catalogue sends through the relay of Workspace from an address of Immoscoop, to the group of the Data Team, links to the web app and reads the Slack token from its secret (DEC-PF-31, DEC-LN-03, DEC-LN-05)."
  }

  assert {
    condition = (
      [for env in google_cloud_run_v2_service.service["identity"].template[0].containers[0].env : env.value if env.name == "DATAHUB_CATALOGUE_SERVICE_ACCOUNT"]
      == ["datahub-catalogue@test-project.iam.gserviceaccount.com"]
    )
    error_message = "identity tells who to notify to the service account of catalogue, and to no one else (DEC-LN-07)."
  }
}

run "mail_comes_from_an_address_of_a_workspace_domain" {
  command = plan

  variables {
    mail_from = "Data Hub <noreply@example.com>"
  }

  expect_failures = [var.mail_from]
}

run "the_scheduler_has_catalogue_send_what_is_left_every_few_minutes" {
  command = plan

  override_resource {
    target          = google_service_account.scheduler
    override_during = plan
    values = {
      email  = "datahub-scheduler@test-project.iam.gserviceaccount.com"
      member = "serviceAccount:datahub-scheduler@test-project.iam.gserviceaccount.com"
    }
  }

  assert {
    condition     = google_cloud_scheduler_job.notifications.http_target[0].http_method == "POST" && google_cloud_scheduler_job.notifications.http_target[0].uri == "https://datahub-catalogue-123456789.europe-west1.run.app/internal/notifications/deliver"
    error_message = "The scheduler starts a delivery round at catalogue (DEC-LN-02)."
  }

  assert {
    condition = (
      google_cloud_scheduler_job.notifications.http_target[0].oidc_token[0].service_account_email == "datahub-scheduler@test-project.iam.gserviceaccount.com" &&
      google_cloud_scheduler_job.notifications.http_target[0].oidc_token[0].audience == "https://datahub-catalogue-123456789.europe-west1.run.app"
    )
    error_message = "The scheduler calls with a Google ID token of its own, for catalogue's own address, which catalogue checks itself (TR-PF-14)."
  }

  assert {
    condition     = contains([for env in google_cloud_run_v2_service.service["catalogue"].template[0].containers[0].env : "${env.name}=${env.value}"], "DATAHUB_SCHEDULER_SERVICE_ACCOUNT=datahub-scheduler@test-project.iam.gserviceaccount.com")
    error_message = "catalogue must know the scheduler, to check who starts a delivery round."
  }

  assert {
    condition     = google_cloud_scheduler_job.notifications.schedule == "*/5 * * * *"
    error_message = "What did not go out at once goes within five minutes; a notification is never held for a digest (DEC-LN-02)."
  }
}
