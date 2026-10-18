# registry

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/registry` |
| Schema | `registry` |
| Domains | [Artifact registry](../../requirements/functional/01-artifact-registry.md) |

**In one sentence:** registry is the accession register: it fetches the dbt Artifacts after every prod run, keeps them, turns them into Nodes, columns, Edges and tests, and works out what changed.

## Responsibilities

- Fetching and storing the Artifacts of the Source Jobs: [FR-AR-01](../../requirements/functional/01-artifact-registry.md#fr-ar-01) to [FR-AR-06](../../requirements/functional/01-artifact-registry.md#fr-ar-06)
- Processing into Nodes, columns, Edges and tests, across both dbt projects: [FR-AR-07](../../requirements/functional/01-artifact-registry.md#fr-ar-07) to [FR-AR-09](../../requirements/functional/01-artifact-registry.md#fr-ar-09)
- Search by name, free text and lineage: [FR-AR-10](../../requirements/functional/01-artifact-registry.md#fr-ar-10)
- Comparing versions and following Changes downstream: [FR-AR-11](../../requirements/functional/01-artifact-registry.md#fr-ar-11), [FR-AR-12](../../requirements/functional/01-artifact-registry.md#fr-ar-12). registry knows the lineage; catalogue knows which Nodes are Resources. registry therefore hands over each Change with the downstream Nodes and their distance, and catalogue writes the Log Entries.
- Fetching and processing a run again manually: [FR-AR-14](../../requirements/functional/01-artifact-registry.md#fr-ar-14)

In the proposal this service was called ingest, as a Cloud Run job. It became a service because catalogue, query and mcp need to read Nodes and lineage from it, and [DEC-PF-05](../../requirements/technical/00-platform.md#dec-pf-05) forbids reading its schema directly. The processing itself still runs as a job ([DEC-PF-20](../../requirements/technical/00-platform.md#dec-pf-20)).

## How a run comes in

1. A Source Job finishes in dbt Cloud, which calls `POST /webhooks/dbt-cloud`, signed with the shared secret ([TR-AR-01](../../requirements/technical/01-artifact-registry.md#tr-ar-01)).
2. registry checks the signature, records the run once as a pending Artifact Set, starts the job `datahub-registry-ingest` and answers.
3. The job fetches `manifest.json` and `catalog.json`, stores them unchanged in the artifact bucket ([TR-AR-02](../../requirements/technical/01-artifact-registry.md#tr-ar-02)), normalises them ([TR-AR-03](../../requirements/technical/01-artifact-registry.md#tr-ar-03)), and makes the set the Current Version in the same transaction ([TR-AR-04](../../requirements/technical/01-artifact-registry.md#tr-ar-04)).

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /webhooks/dbt-cloud` | A finished run, from dbt Cloud; public, protected by its signature ([TR-AR-01](../../requirements/technical/01-artifact-registry.md#tr-ar-01)) |
| `GET /projects` | Each dbt project with its Current Version ([TR-AR-05](../../requirements/technical/01-artifact-registry.md#tr-ar-05)) |
| `GET /runs` | The latest runs, with their status and error |
| `GET /nodes?q=&type=` | Search Nodes by name, also with a typo, and by free text in descriptions and columns ([TR-AR-05](../../requirements/technical/01-artifact-registry.md#tr-ar-05)) |
| `GET /nodes/{id}` | One Node with its columns and tests ([TR-AR-06](../../requirements/technical/01-artifact-registry.md#tr-ar-06)) |
| `GET /nodes/{id}/lineage?direction=&depth=` | Lineage upstream or downstream, across both projects ([TR-AR-06](../../requirements/technical/01-artifact-registry.md#tr-ar-06)) |
| `POST /runs/{id}/reprocess` | Fetch and process a run again ([TR-AR-07](../../requirements/technical/01-artifact-registry.md#tr-ar-07)) |

Every route but the webhook needs an Access Token with the role of the Data Team, for now ([OP-AR-05](../../requirements/functional/01-artifact-registry.md#op-ar-05)).

## Data

Artifact Sets with their status and error, Nodes, columns, Edges, tests and Changes, the last four for the Current Version and the one before it ([TR-AR-04](../../requirements/technical/01-artifact-registry.md#tr-ar-04)). The files themselves, unchanged, in the artifact bucket per project and per run, kept for good.

## Talks to

The dbt Cloud Admin API, the artifact bucket, and catalogue (to hand over Changes, with the service identity).

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): Cloud SQL client, write access to the artifact bucket, the dbt Cloud token and the webhook secret from Secret Manager, and starting its ingest job, which runs under the same service account.
