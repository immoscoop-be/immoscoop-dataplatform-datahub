# Build and deploy

| | |
| --- | --- |
| Status | Build in place; pushing waits for the one-time GCP setup below; deploying follows once the Cloud Run services exist |
| Source of truth | The requirements in [Platform](../requirements/technical/00-platform.md); this page describes how to work with them |

**In one sentence:** every service becomes its own Docker image, built by GitHub Actions from one shared Dockerfile, stored in Artifact Registry in GCP, and deployed to Cloud Run.

## Working locally

You need Node.js 24 (see `.node-version`) and pnpm, which Corepack provides: `corepack enable`.

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs all dependencies of the workspace |
| `pnpm build` | Compiles every package and service with TypeScript project references |
| `pnpm typecheck` | Compiles, then type-checks the tests and the scripts |
| `pnpm test` | Runs all tests with Vitest |
| `pnpm docs:check` | Validates requirement IDs, statuses and links in `docs/` |
| `pnpm docs:build` | Regenerates the [traceability matrix](../requirements/traceability.md) |
| `pnpm check` | Type-check, tests and the documentation check together, as CI runs them |

To run one service locally after `pnpm build`:

```sh
cd services/catalogue
DATAHUB_TOKEN_ISSUER=… DATAHUB_TOKEN_AUDIENCE=datahub DATAHUB_JWKS_URL=… PORT=8080 pnpm start
```

## Images

- **One Dockerfile for all services.** The service is chosen with a build argument: `docker build --build-arg SERVICE=catalogue -t catalogue .` ([TR-PF-15](../requirements/technical/00-platform.md#tr-pf-15)).
- **Two stages.** The first stage builds the whole workspace. The second copies only the chosen service and its production dependencies (`pnpm deploy`) onto `node:24-slim`, and runs as the non-root user `node`.
- **Tagged with the commit.** Every image is tagged with the full git commit SHA, so an image always says exactly which code it contains.
- **Stored in Artifact Registry in GCP**, not on Docker Hub ([DEC-PF-11](../requirements/technical/00-platform.md#dec-pf-11)). Cloud Run pulls from it with its own identity, without extra credentials, the images stay private, and they live in the same region as the services.

## Pipeline

| Workflow | When | What |
| --- | --- | --- |
| [`ci.yml`](../../.github/workflows/ci.yml) | Every pull request and every push to `main` | Install, type-check, test, and check the documentation |
| [`images.yml`](../../.github/workflows/images.yml) | Every pull request | Builds the image of every service, to prove it builds |
| [`images.yml`](../../.github/workflows/images.yml) | Every push to `main` | Builds the images and pushes them to Artifact Registry, once the variables below are set ([TR-PF-16](../requirements/technical/00-platform.md#tr-pf-16)) |

GitHub authenticates to GCP with **Workload Identity Federation**: GitHub proves to Google which repository a run comes from, and Google hands out a short-lived token. No service account key is stored anywhere.

### Deploying (to follow)

Once the Cloud Run services exist, deploying follows the principle "build once, deploy many" ([TR-PF-17](../requirements/technical/00-platform.md#tr-pf-17)): the image built on `main` goes to uat, and the very same image, by the same tag, goes to prod after approval. An image is never rebuilt for prod.

## One-time setup in GCP

Someone with admin rights on the GCP project does this once, until the infrastructure moves to Terraform ([TR-PF-13](../requirements/technical/00-platform.md#tr-pf-13)). The project and region are still to be chosen ([OP-PF-09](../requirements/technical/00-platform.md#op-pf-09)); the repository name in the trust condition depends on where the repository lives ([OP-PF-11](../requirements/technical/00-platform.md#op-pf-11)).

```sh
PROJECT_ID=<project>                 # OP-PF-09
REGION=<region>                      # OP-PF-09, for example europe-west1
REPO=maximethenextimmoscoopbe/immoscoop-dataplatform-datahub   # OP-PF-11
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

# 1. The Docker repository for the images
gcloud artifacts repositories create datahub --project="$PROJECT_ID" --location="$REGION" \
  --repository-format=docker --description="Data Hub service images"

# 2. The service account GitHub Actions acts as, allowed to push images and nothing else
gcloud iam service-accounts create datahub-ci --project="$PROJECT_ID" --display-name="Data Hub CI"
gcloud artifacts repositories add-iam-policy-binding datahub --project="$PROJECT_ID" --location="$REGION" \
  --member="serviceAccount:datahub-ci@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/artifactregistry.writer

# 3. Trust GitHub Actions runs of this repository, and only this repository
gcloud iam workload-identity-pools create github --project="$PROJECT_ID" --location=global \
  --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc datahub --project="$PROJECT_ID" --location=global \
  --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '$REPO'"
gcloud iam service-accounts add-iam-policy-binding "datahub-ci@$PROJECT_ID.iam.gserviceaccount.com" \
  --project="$PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"
```

Then set these **repository variables** in GitHub (Settings → Secrets and variables → Actions → Variables). They are not secrets: none of them grants access on its own.

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | The project ID |
| `GCP_REGION` | The region, for example `europe-west1` |
| `GCP_ARTIFACT_REPOSITORY` | `datahub` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<project number>/locations/global/workloadIdentityPools/github/providers/datahub` |
| `GCP_CI_SERVICE_ACCOUNT` | `datahub-ci@<project>.iam.gserviceaccount.com` |

From the next push to `main` onwards, the images land in Artifact Registry as `<region>-docker.pkg.dev/<project>/datahub/<service>:<commit SHA>`.

## Adding a service

1. Copy one of the folders under `services/`, and change the name in `package.json`, `src/app.ts` and the test.
2. Add it to the `references` in the root `tsconfig.json` and to the `matrix.service` list in `images.yml`.
3. Describe it in [`services/`](services/) and in the [service map](README.md#services).
