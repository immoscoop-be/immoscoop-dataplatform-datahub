# infra

The Terraform of Data Hub: everything it runs on in GCP, for both environments ([DEC-PF-15](../docs/requirements/technical/00-platform.md#dec-pf-15), [TR-PF-13](../docs/requirements/technical/00-platform.md#tr-pf-13)).

GitHub Actions applies it, never a person ([DEC-PF-16](../docs/requirements/technical/00-platform.md#dec-pf-16)): a push to `uat` applies it to the uat project, a push to `main` to the prod project, each with its own state bucket and its own Terraform identity. What has to exist before Terraform can run is the one-time [GCP setup](../docs/architecture/gcp-setup.md).

## What it creates, per environment

| File | What |
| --- | --- |
| `service-accounts.tf` | One service account per service, `datahub-<service>`, with only its own roles ([TR-PF-11](../docs/requirements/technical/00-platform.md#tr-pf-11)) |
| `database.tf` | Cloud SQL Postgres 17, the database `datahub`, and a login per service that keeps data, by its Google identity: no passwords ([TR-PF-22](../docs/requirements/technical/00-platform.md#tr-pf-22)). Also the login of `datahub-migrator`, which owns the schemas |
| `migrations.tf` | Per service that keeps data, the job that runs its migrations with the new image, before the service is changed ([TR-PF-09](../docs/requirements/technical/00-platform.md#tr-pf-09)) |
| `storage.tf` | The bucket for the Artifacts, which only registry may write |
| `secrets.tf` | The secrets, each readable by one service; a person adds the values ([TR-PF-23](../docs/requirements/technical/00-platform.md#tr-pf-23)) |
| `kms.tf` | The key in Cloud KMS that signs Access Tokens, which only identity may use ([TR-PF-24](../docs/requirements/technical/00-platform.md#tr-pf-24)) |
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

## Rotating the signing key

The key that signs Access Tokens is rotated once a year, and immediately on any suspicion of misuse ([DEC-PF-17](../docs/requirements/technical/00-platform.md#dec-pf-17)). Its versions are listed in `token_signing_key_versions` in `environments/uat.tfvars` and `environments/prod.tfvars`, labelled by the year they were made; a second version in the same year gets a suffix, such as `"2026-2"`, so the labels sort in the order the versions were made. identity signs with the newest enabled version and publishes every enabled one.

**Yearly**, in one pull request for both files, so the change reaches uat first and prod with the next merge into `main`:

1. Add a version for the new year: `"2027" = "ENABLED"`. identity signs with it from the next apply; tokens signed with the previous version stay valid.
2. A day later, in a second pull request, disable the previous version: `"2026" = "DISABLED"`. By then every token it signed has expired.

**On suspicion**, do both at once: add the new version and disable the suspected one in the same pull request. Every token signed with the suspected version stops working as soon as the apply has run, and Users sign in again; nothing else is lost.

A disabled version can be enabled again. Removing a version from the list schedules its destruction after 30 days, which can still be cancelled in that time.

## Adding a service

Add its name to `local.services` in `main.tf`, and to `local.database_services` if it keeps data in Postgres; give its service account the roles it needs in `service-accounts.tf`. See also [Adding a service](../docs/architecture/build-and-deploy.md#adding-a-service).
