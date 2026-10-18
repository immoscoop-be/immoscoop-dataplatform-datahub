# GCP setup

| | |
| --- | --- |
| Status | To be run once, by hand ([OP-PF-10](../requirements/technical/00-platform.md#op-pf-10)) |
| Source of truth | This file, for everything that exists before Terraform can run |

**In one sentence:** this is the one-time bootstrap you run from your own machine, so that from then on GitHub Actions builds the images and applies the Terraform of Data Hub, uat from the branch `uat` and prod from the branch `main` ([DEC-PF-16](../requirements/technical/00-platform.md#dec-pf-16)).

Everything else (Cloud Run services, Cloud SQL, buckets, secrets, the service accounts of the services) is created by Terraform in `infra/`, never by hand ([TR-PF-13](../requirements/technical/00-platform.md#tr-pf-13)).

## What the bootstrap creates

| What | Where | Why |
| --- | --- | --- |
| The APIs Data Hub needs | both projects | Terraform and the services call them |
| Terraform state bucket | both projects | Terraform remembers what it created |
| Service account `datahub-terraform` | both projects | The identity GitHub uses to apply Terraform in that project |
| Artifact Registry repository `datahub` | prod project | The images of the services ([DEC-PF-11](../requirements/technical/00-platform.md#dec-pf-11), [TR-PF-18](../requirements/technical/00-platform.md#tr-pf-18)) |
| Service account `datahub-ci` | prod project | The identity GitHub uses to push images, and nothing else |
| Workload identity pool `datahub-github` | prod project | GitHub proves which repository and branch a run comes from; no keys are stored anywhere ([TR-PF-16](../requirements/technical/00-platform.md#tr-pf-16)) |
| Branch-bound trust | prod pool → three service accounts | `uat` may act as uat Terraform, `main` as prod Terraform, both may push images ([NFR-SEC-04](../requirements/non-functional/security.md#nfr-sec-04)) |
| GitHub environments and variables | the repository | Tell the workflows which project, identity and bucket to use |

| | prod | uat |
| --- | --- | --- |
| Project | `immoscoop-dataplatform-398214` | `immoscoop-dataplatform` |
| Region | `europe-west1` | `europe-west1` |
| Branch that changes it | `main` | `uat` |
| Terraform state bucket | `immoscoop-dataplatform-398214-datahub-tfstate` | `immoscoop-dataplatform-datahub-tfstate` |
| Terraform service account | `datahub-terraform@immoscoop-dataplatform-398214.iam.gserviceaccount.com` | `datahub-terraform@immoscoop-dataplatform.iam.gserviceaccount.com` |

## Before you start

- The [gcloud CLI](https://cloud.google.com/sdk/docs/install), logged in with `gcloud auth login` as an account that is **Owner** of both projects. (If you are not Owner, you need at least: Project IAM Admin, Service Account Admin, Service Usage Admin, Storage Admin, Artifact Registry Admin and Workload Identity Pool Admin.)
- Admin rights on the GitHub repository, for step 7.
- For step 9 you need a **Google Workspace admin**; that step can wait until after the first Terraform run.

All commands are for a bash or zsh shell. Run them in order, in one terminal: later steps use the variables of step 1. Every step can be run again safely; a command that finds its resource already there reports an error and changes nothing.

## 1. Set the variables

```sh
REGION=europe-west1
PROD=immoscoop-dataplatform-398214
UAT=immoscoop-dataplatform
REPO=immoscoop-be/immoscoop-dataplatform-datahub
PROD_NUMBER=$(gcloud projects describe "$PROD" --format='value(projectNumber)')
UAT_NUMBER=$(gcloud projects describe "$UAT" --format='value(projectNumber)')
echo "prod $PROD_NUMBER, uat $UAT_NUMBER"
```

## 2. Enable the APIs, in both projects

```sh
for PROJECT in "$PROD" "$UAT"; do
  gcloud services enable --project="$PROJECT" \
    run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com \
    cloudscheduler.googleapis.com storage.googleapis.com bigquery.googleapis.com \
    iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
    cloudresourcemanager.googleapis.com serviceusage.googleapis.com \
    artifactregistry.googleapis.com cloudidentity.googleapis.com cloudkms.googleapis.com \
    admin.googleapis.com
done
```

## 3. Terraform state buckets, in both projects

Versioned, so that an earlier state can always be restored; never public.

```sh
for PROJECT in "$PROD" "$UAT"; do
  BUCKET="gs://$PROJECT-datahub-tfstate"
  gcloud storage buckets create "$BUCKET" --project="$PROJECT" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
  gcloud storage buckets update "$BUCKET" --versioning
done
```

## 4. Terraform service accounts, in both projects

The identity that applies Terraform needs to create the resources of Data Hub. These roles are broad on purpose, because Terraform creates service accounts and gives them their own, narrow roles ([TR-PF-11](../requirements/technical/00-platform.md#tr-pf-11)); only a run on the right branch can use this identity (step 6).

```sh
for PROJECT in "$PROD" "$UAT"; do
  SA="datahub-terraform@$PROJECT.iam.gserviceaccount.com"
  gcloud iam service-accounts create datahub-terraform --project="$PROJECT" \
    --display-name="Data Hub Terraform" \
    --description="Applies the Terraform of Data Hub; used by GitHub Actions only"
  for ROLE in \
    roles/run.admin \
    roles/iam.serviceAccountAdmin \
    roles/iam.serviceAccountUser \
    roles/resourcemanager.projectIamAdmin \
    roles/cloudsql.admin \
    roles/storage.admin \
    roles/secretmanager.admin \
    roles/cloudkms.admin \
    roles/cloudscheduler.admin; do
    gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" \
      --role="$ROLE" --condition=None --quiet > /dev/null
  done
  gcloud storage buckets add-iam-policy-binding "gs://$PROJECT-datahub-tfstate" \
    --member="serviceAccount:$SA" --role=roles/storage.objectAdmin > /dev/null
done
```

| Role | For |
| --- | --- |
| Cloud Run Admin | The Cloud Run services |
| Service Account Admin, Service Account User | Creating the service account of each service, and running a service as it |
| Project IAM Admin | Giving those service accounts their narrow roles, such as Cloud SQL Client |
| Cloud SQL Admin | The Postgres instance, its databases and users |
| Storage Admin | The bucket for the Artifacts |
| Secret Manager Admin | The secrets: dbt Cloud token, OAuth client |
| Cloud KMS Admin | The key that signs Access Tokens ([TR-PF-24](../requirements/technical/00-platform.md#tr-pf-24)); managing the key does not allow signing with it |
| Cloud Scheduler Admin | The scheduled jobs, such as the Synchronisation of Groups |

## 5. Image repository and CI service account, in the prod project

```sh
gcloud artifacts repositories create datahub --project="$PROD" --location="$REGION" \
  --repository-format=docker --description="Data Hub service images"

gcloud iam service-accounts create datahub-ci --project="$PROD" \
  --display-name="Data Hub CI" --description="Pushes the Data Hub images; used by GitHub Actions only"
gcloud artifacts repositories add-iam-policy-binding datahub --project="$PROD" --location="$REGION" \
  --member="serviceAccount:datahub-ci@$PROD.iam.gserviceaccount.com" --role=roles/artifactregistry.writer

# Cloud Run in uat may pull the same images (TR-PF-18)
gcloud artifacts repositories add-iam-policy-binding datahub --project="$PROD" --location="$REGION" \
  --member="serviceAccount:service-$UAT_NUMBER@serverless-robot-prod.iam.gserviceaccount.com" \
  --role=roles/artifactregistry.reader

# Terraform of both environments may read the images it deploys
for PROJECT in "$PROD" "$UAT"; do
  gcloud artifacts repositories add-iam-policy-binding datahub --project="$PROD" --location="$REGION" \
    --member="serviceAccount:datahub-terraform@$PROJECT.iam.gserviceaccount.com" \
    --role=roles/artifactregistry.reader
done
```

Two identities read the images. The Cloud Run service agent pulls an image whenever a service starts; in the prod project it already may, in uat it needs the first binding. And Cloud Run refuses to create or change a service unless the identity that deploys it may read its image, so both Terraform service accounts need the last binding; without it, the apply fails with "Permission 'artifactregistry.repositories.downloadArtifacts' denied".

The binding for the uat service agent needs the Cloud Run service agent of uat to exist. Enabling the Cloud Run API in step 2 creates it; if the command still reports that the account does not exist, wait a minute and run it again.

## 6. Trust between GitHub and GCP, with branch-bound access

One pool, in the prod project, used by this repository only. Its provider accepts only runs of this repository, and every service account trusts only the branches that may use it.

```sh
gcloud iam workload-identity-pools create datahub-github --project="$PROD" --location=global \
  --display-name="Data Hub GitHub" --description="GitHub Actions of $REPO only"

gcloud iam workload-identity-pools providers create-oidc github --project="$PROD" --location=global \
  --workload-identity-pool=datahub-github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '$REPO'"

POOL="principalSet://iam.googleapis.com/projects/$PROD_NUMBER/locations/global/workloadIdentityPools/datahub-github"

# uat Terraform: only runs on the branch uat
gcloud iam service-accounts add-iam-policy-binding "datahub-terraform@$UAT.iam.gserviceaccount.com" \
  --project="$UAT" --role=roles/iam.workloadIdentityUser --member="$POOL/attribute.ref/refs/heads/uat"

# prod Terraform: only runs on the branch main
gcloud iam service-accounts add-iam-policy-binding "datahub-terraform@$PROD.iam.gserviceaccount.com" \
  --project="$PROD" --role=roles/iam.workloadIdentityUser --member="$POOL/attribute.ref/refs/heads/main"

# Images: pushed from uat and from main
for REF in refs/heads/uat refs/heads/main; do
  gcloud iam service-accounts add-iam-policy-binding "datahub-ci@$PROD.iam.gserviceaccount.com" \
    --project="$PROD" --role=roles/iam.workloadIdentityUser --member="$POOL/attribute.ref/$REF"
done

echo "Workload identity provider: projects/$PROD_NUMBER/locations/global/workloadIdentityPools/datahub-github/providers/github"
```

Do not add providers for other repositories to this pool: the branch rules above trust every provider in it.

## 7. GitHub: environments and variables

In the repository, under **Settings → Environments**, create two environments. Each may only be used from its own branch, a second lock next to step 6.

| Environment | Deployment branches and tags | Variables |
| --- | --- | --- |
| `uat` | Selected branches: `uat` | `GCP_PROJECT_ID` = `immoscoop-dataplatform`<br>`GCP_TERRAFORM_SERVICE_ACCOUNT` = `datahub-terraform@immoscoop-dataplatform.iam.gserviceaccount.com`<br>`TF_STATE_BUCKET` = `immoscoop-dataplatform-datahub-tfstate` |
| `prod` | Selected branches: `main` | `GCP_PROJECT_ID` = `immoscoop-dataplatform-398214`<br>`GCP_TERRAFORM_SERVICE_ACCOUNT` = `datahub-terraform@immoscoop-dataplatform-398214.iam.gserviceaccount.com`<br>`TF_STATE_BUCKET` = `immoscoop-dataplatform-398214-datahub-tfstate` |

Then, under **Settings → Secrets and variables → Actions → Variables**, the repository variables. None of them is a secret: none grants access on its own.

| Repository variable | Value |
| --- | --- |
| `GCP_REGION` | `europe-west1` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | the line printed at the end of step 6 |
| `GCP_IMAGES_PROJECT_ID` | `immoscoop-dataplatform-398214` |
| `GCP_ARTIFACT_REPOSITORY` | `datahub` |
| `GCP_CI_SERVICE_ACCOUNT` | `datahub-ci@immoscoop-dataplatform-398214.iam.gserviceaccount.com` |

From the next push to `uat`, the images land in `europe-west1-docker.pkg.dev/immoscoop-dataplatform-398214/datahub/<service>`.

## 8. Values Terraform cannot know

**This step comes after the first Terraform run**, because Terraform creates the secrets these values go into. Until then, you can prepare them: create the dbt Cloud token and keep it somewhere safe (never in GitHub), check that both Source Jobs generate the docs ("Generate docs on run"), and set up the branding of Sign in with Google with audience **Internal** in both projects.

Terraform creates the secrets in Secret Manager, but some values only a person can provide. Add them per environment once Terraform has created the secret, with `printf '%s' '<value>' | gcloud secrets versions add <secret> --project=<project> --data-file=-`. The key that signs Access Tokens is not among them: Terraform creates it in Cloud KMS, and nobody ever sees it ([TR-PF-24](../requirements/technical/00-platform.md#tr-pf-24)).

| Secret | Value | Where it comes from |
| --- | --- | --- |
| `datahub-dbt-cloud-token` | A dbt Cloud service token that may read job Artifacts; one per environment | dbt Cloud → Account settings → Service tokens. The Source Jobs are probably `324502` (prod) and `324451` (uat), to be confirmed ([OP-AR-01](../requirements/functional/01-artifact-registry.md#op-ar-01)) |
| `datahub-google-oauth-client` | The JSON file the Google console downloads for an OAuth client of type "Web application", for Sign in with Google; add it with `gcloud secrets versions add datahub-google-oauth-client --project=<project> --data-file=<file>.json` and delete the file | GCP console → Google Auth Platform, per project: branding with audience **Internal**, then a client. Its redirect URI is the login callback of identity: `https://datahub-identity-<project number>.europe-west1.run.app/callback` (the Terraform output `identity_url`), until the domain names are chosen ([OP-PF-08](../requirements/technical/00-platform.md#op-pf-08)) |

## 9. Google Workspace, by a Workspace admin

After the first Terraform run has created the service account of identity in each project:

1. **Groups Reader for identity.** Admin console → Account → Admin roles → **Groups Reader** → Assign service accounts → add `datahub-identity@immoscoop-dataplatform-398214.iam.gserviceaccount.com` and `datahub-identity@immoscoop-dataplatform.iam.gserviceaccount.com` ([DEC-UM-03](../requirements/functional/02-user-management.md#dec-um-03), [OP-UM-03](../requirements/functional/02-user-management.md#op-um-03)).
2. **Data Hub user reader for identity.** Admin console → Account → Admin roles → **Create new role** `Data Hub user reader`, with only **Admin API privileges → Users → Read** → Assign service accounts → the same two addresses. identity checks with it at every renewal whether an account is still active ([TR-PF-26](../requirements/technical/00-platform.md#tr-pf-26)); it cannot change anything.
3. **The first Groups**, following the Naming Convention: the Role Group of the Data Team, `datahub-datateam@`, and the first Owner Units ([OP-UM-04](../requirements/functional/02-user-management.md#op-um-04), [OP-CO-03](../requirements/functional/03-collections.md#op-co-03)).

## Check that it worked

- `gcloud iam service-accounts list --project="$PROD"` and `--project="$UAT"` show `datahub-terraform` (and `datahub-ci` in prod).
- `gcloud artifacts repositories get-iam-policy datahub --project="$PROD" --location="$REGION"` shows `datahub-ci` as writer, and as readers the Cloud Run service agent of uat and `datahub-terraform` of both projects.
- `gcloud iam workload-identity-pools providers describe github --project="$PROD" --location=global --workload-identity-pool=datahub-github` shows the condition on the repository.
- After the next merge into `uat`, the job "image (catalogue)" in GitHub Actions logs in to Google Cloud and pushes; the image appears in Artifact Registry.

## Not part of this setup

- **Read access to the Stacks for query.** The Stacks dataset does not exist yet. Whether Terraform or dbt grants query its read access is still open ([OP-PF-14](../requirements/technical/00-platform.md#op-pf-14)).
- **Domain names** for the services ([OP-PF-08](../requirements/technical/00-platform.md#op-pf-08)).
