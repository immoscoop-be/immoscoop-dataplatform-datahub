# infra

The Terraform of Data Hub: everything it runs on in GCP, for both environments ([DEC-PF-15](../docs/requirements/technical/00-platform.md#dec-pf-15), [TR-PF-13](../docs/requirements/technical/00-platform.md#tr-pf-13)).

GitHub Actions applies it, never a person ([DEC-PF-16](../docs/requirements/technical/00-platform.md#dec-pf-16)): a push to `uat` applies it to the uat project, a push to `main` to the prod project, each with its own state bucket and its own Terraform identity. What has to exist before Terraform can run is the one-time [GCP setup](../docs/architecture/gcp-setup.md).

## What it creates, per environment

| File | What |
| --- | --- |
| `service-accounts.tf` | One service account per service, `datahub-<service>`, with only its own roles ([TR-PF-11](../docs/requirements/technical/00-platform.md#tr-pf-11)) |
| `database.tf` | Cloud SQL Postgres 17, the database `datahub`, and a login per service that keeps data, by its Google identity: no passwords ([TR-PF-22](../docs/requirements/technical/00-platform.md#tr-pf-22)) |
| `storage.tf` | The bucket for the Artifacts, which only registry may write |
| `secrets.tf` | The secrets, each readable by one service; a person adds the values ([TR-PF-23](../docs/requirements/technical/00-platform.md#tr-pf-23)) |
| `services.tf` | The four services on Cloud Run, `datahub-<service>`, publicly reachable, running the images of exactly this code |
| `environments/*.tfvars` | What differs between uat and prod |

| | uat | prod |
| --- | --- | --- |
| Project | `immoscoop-dataplatform` | `immoscoop-dataplatform-398214` |
| Database machine | `db-f1-micro` | `db-g1-small` |
| Deletion protection | off | on, for the database and the services |
| Point-in-time recovery | off | on |

## Which images it runs

CI passes `image_tag=tree-<git tree hash>`: the images of exactly the code being applied, built on `uat` and reused on `main` ([TR-PF-17](../docs/requirements/technical/00-platform.md#tr-pf-17)). The images live in the prod project, which uat may read ([TR-PF-18](../docs/requirements/technical/00-platform.md#tr-pf-18)).

## Working on it

CI checks every change: `terraform fmt -check`, `validate`, and `test`. The tests in `tests/` plan the infrastructure against a mocked Google provider, so they need no access to GCP:

```sh
terraform -chdir=infra fmt -recursive
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra test
```

Never run `plan` or `apply` against a real project from your machine: the Terraform identities only trust GitHub Actions on `uat` and `main`.

## Adding a service

Add its name to `local.services` in `main.tf`, and to `local.database_services` if it keeps data in Postgres; give its service account the roles it needs in `service-accounts.tf`. See also [Adding a service](../docs/architecture/build-and-deploy.md#adding-a-service).
