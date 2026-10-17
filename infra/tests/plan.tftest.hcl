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
}

run "every_service_runs_the_shared_image_of_this_code" {
  command = plan

  assert {
    condition     = length(google_cloud_run_v2_service.service) == 4
    error_message = "Expected the four services identity, catalogue, registry and query."
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
    condition     = length(google_secret_manager_secret_iam_member.reader) == 3
    error_message = "Each secret has exactly one reader."
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
}

run "an_unknown_environment_is_refused" {
  command = plan

  variables {
    environment = "dev"
  }

  expect_failures = [var.environment]
}
