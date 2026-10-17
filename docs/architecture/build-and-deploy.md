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
- **Tagged with its code.** Every image is tagged with the git tree hash of its code (`tree-<hash>`) and with the commit SHA. The tree hash is a fingerprint of the code itself: two commits with the same code have the same tree hash, which is what lets prod reuse the image of uat.
- **Stored in Artifact Registry in GCP**, not on Docker Hub ([DEC-PF-11](../requirements/technical/00-platform.md#dec-pf-11)). Cloud Run pulls from it with its own identity, without extra credentials, the images stay private, and they live in the same region as the services.

## Pipeline

| Workflow | When | What |
| --- | --- | --- |
All of it is one workflow, [`ci.yml`](../../.github/workflows/ci.yml), with one gate at the end ([TR-PF-20](../requirements/technical/00-platform.md#tr-pf-20)).

| Job | When | What |
| --- | --- | --- |
| Type-check, test and check the docs | Every pull request, and every push to `uat` or `main` | Install, type-check, test, and check the documentation |
| Find the services | Every run | Lists the folders under `services/`; every folder is a service with its own image |
| image (*service*) | Every pull request | Builds the image of every service, to prove it builds |
| image (*service*) | Every push to `uat` | Builds the images and pushes them to Artifact Registry, once the variables below are set ([TR-PF-16](../requirements/technical/00-platform.md#tr-pf-16)) |
| image (*service*) | Every push to `main` | Finds the images of the same code from uat and tags them with the new commit; builds only if they are missing ([TR-PF-17](../requirements/technical/00-platform.md#tr-pf-17)) |
| Verify source branch is uat | Every pull request into `main` | Fails unless the pull request comes from `uat` ([TR-PF-19](../requirements/technical/00-platform.md#tr-pf-19)) |
| **ci** | Always, last | Passes only when every job above passed; the source-branch job may be skipped, because it only runs on pull requests into `main`. **This is the only check the branch rules require.** |

GitHub authenticates to GCP with **Workload Identity Federation**: GitHub proves to Google which repository a run comes from, and Google hands out a short-lived token. No service account key is stored anywhere.

### Deploying (to follow)

Once the Cloud Run services exist, a push to `uat` deploys to the uat project, and a push to `main` deploys to the prod project. Deploying follows the principle "build once, deploy many" ([TR-PF-17](../requirements/technical/00-platform.md#tr-pf-17)): prod runs the very same images that ran on uat. An image is never rebuilt for prod.

## Branches and environments

Every change goes first to uat, then from uat to prod ([DEC-PF-14](../requirements/technical/00-platform.md#dec-pf-14)), as in the data repository.

```mermaid
flowchart LR
  feature["feature branch"] -- "pull request" --> uat["uat"]
  uat -- "pull request, only from uat" --> main["main"]
  uat -. deploys .-> uatenv["uat: immoscoop-dataplatform"]
  main -. deploys .-> prodenv["prod: immoscoop-dataplatform-398214"]
```

| Branch | Receives | Deploys to |
| --- | --- | --- |
| a feature branch | your commits | nothing; its pull request is checked and its images are built |
| `uat` | pull requests from feature branches | the uat project |
| `main` | pull requests from `uat` only | the prod project |

### Rules in GitHub

The check `ci` blocks a pull request with failing tests, a broken image, or, into `main`, the wrong source branch. Only GitHub's branch rules make it impossible to go around it. An admin of the repository sets them up once ([OP-PF-12](../requirements/technical/00-platform.md#op-pf-12)), under **Settings → Rules → Rulesets → New branch ruleset**:

| Ruleset | Target branch | Rules |
| --- | --- | --- |
| `main` | `main` | Restrict deletions; block force pushes; require a pull request before merging, with allowed merge method **Merge** only; require status check `ci` to pass |
| `uat` | `uat` | Restrict deletions; block force pushes; require a pull request before merging; require status check `ci` to pass |

- **Merge, not squash, into `main`.** A squash would give `main` commits that `uat` does not have, and the next pull request from `uat` would show old changes again. Into `uat`, squash or merge are both fine.
- **Required approvals** are your choice; once there is more than one person working on Data Hub, one approval on each ruleset is a sensible start.
- **Default branch.** Set `uat` as the default branch (**Settings → General → Default branch**), so that new pull requests target `uat` by default.
- **One required check.** Both rulesets require only `ci`. A new service or a new job in the pipeline never changes the settings in GitHub.
- **Bypass.** Leave the bypass list empty, so that the rules also hold for admins.

## One-time setup in GCP

Someone with admin rights on both GCP projects does this once, until the infrastructure moves to Terraform ([TR-PF-13](../requirements/technical/00-platform.md#tr-pf-13)). The image repository, the CI service account and Workload Identity Federation live in the prod project ([TR-PF-18](../requirements/technical/00-platform.md#tr-pf-18)); the uat project only gets permission to read the images. The trust condition names the repository, `immoscoop-be/immoscoop-dataplatform-datahub` ([DEC-PF-12](../requirements/technical/00-platform.md#dec-pf-12)); if it ever moves, the condition moves with it.

```sh
PROJECT_ID=immoscoop-dataplatform-398214   # prod: holds the image repository (DEC-PF-13, TR-PF-18)
UAT_PROJECT_ID=immoscoop-dataplatform
REGION=europe-west1
REPO=immoscoop-be/immoscoop-dataplatform-datahub
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

# 4. Let Cloud Run in uat pull the same images (its service agent reads the repository)
UAT_PROJECT_NUMBER=$(gcloud projects describe "$UAT_PROJECT_ID" --format='value(projectNumber)')
gcloud artifacts repositories add-iam-policy-binding datahub --project="$PROJECT_ID" --location="$REGION" \
  --member="serviceAccount:service-$UAT_PROJECT_NUMBER@serverless-robot-prod.iam.gserviceaccount.com" \
  --role=roles/artifactregistry.reader
```

Then set these **repository variables** in GitHub (Settings → Secrets and variables → Actions → Variables). They are not secrets: none of them grants access on its own.

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | `immoscoop-dataplatform-398214` |
| `GCP_REGION` | `europe-west1` |
| `GCP_ARTIFACT_REPOSITORY` | `datahub` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<project number>/locations/global/workloadIdentityPools/github/providers/datahub` |
| `GCP_CI_SERVICE_ACCOUNT` | `datahub-ci@immoscoop-dataplatform-398214.iam.gserviceaccount.com` |

From the next push to `main` onwards, the images land in Artifact Registry as `europe-west1-docker.pkg.dev/immoscoop-dataplatform-398214/datahub/<service>:<commit SHA>`.

## Adding a service

1. Copy one of the folders under `services/`, and change the name in `package.json`, `src/app.ts` and the test.
2. Add it to the `references` in the root `tsconfig.json`. The pipeline finds the new folder by itself and builds its image; the rules in GitHub stay as they are.
3. Describe it in [`services/`](services/) and in the [service map](README.md#services).
