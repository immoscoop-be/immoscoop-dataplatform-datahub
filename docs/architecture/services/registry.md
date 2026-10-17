# registry

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/registry` |
| Schema | `registry` |
| Domains | [Artifact registry](../../requirements/functional/01-artifact-registry.md) |

**In one sentence:** registry is the accession register: it fetches the dbt artifacts after every prod run, keeps them, turns them into nodes, columns, edges and tests, and works out what changed.

## Responsibilities

- Fetching and storing the artifacts of the source jobs: [FR-AR-01](../../requirements/functional/01-artifact-registry.md#fr-ar-01) to [FR-AR-06](../../requirements/functional/01-artifact-registry.md#fr-ar-06)
- Processing into nodes, columns, edges and tests, across both dbt projects: [FR-AR-07](../../requirements/functional/01-artifact-registry.md#fr-ar-07) to [FR-AR-09](../../requirements/functional/01-artifact-registry.md#fr-ar-09)
- Search by name, free text and lineage: [FR-AR-10](../../requirements/functional/01-artifact-registry.md#fr-ar-10)
- Comparing versions and following changes downstream: [FR-AR-11](../../requirements/functional/01-artifact-registry.md#fr-ar-11), [FR-AR-12](../../requirements/functional/01-artifact-registry.md#fr-ar-12). registry knows the lineage; catalogue knows which nodes are resources. registry therefore hands over each change with the downstream nodes and their distance, and catalogue writes the log entries.
- Fetching and processing a run again manually: [FR-AR-14](../../requirements/functional/01-artifact-registry.md#fr-ar-14)

In the proposal this service was called ingest, as a Cloud Run job. It became a service because catalogue, query and mcp need to read nodes and lineage from it, and [DEC-PF-05](../../requirements/technical/00-platform.md#dec-pf-05) forbids reading its schema directly. How the processing itself runs is open ([OP-PF-01](../../requirements/technical/00-platform.md#op-pf-01)).

## API

First sketch; the exact contracts follow in the technical requirements of the domain.

| Endpoint | Purpose |
| --- | --- |
| `POST /runs` | Signal of a finished run, from a dbt Cloud webhook or a scheduled poll ([OP-AR-02](../../requirements/functional/01-artifact-registry.md#op-ar-02)) |
| `POST /runs/{id}/reprocess` | Fetch and process a run again (data team) |
| `GET /projects/{project}/current` | The current version of a dbt project |
| `GET /nodes`, `GET /nodes/{id}` | Search nodes, read one node with its columns |
| `GET /nodes/{id}/lineage` | Lineage upstream or downstream, across both projects |

## Data

Artifact sets with their status and error, nodes, columns, edges, tests and changes. The files themselves, unchanged, in a GCS bucket per project and per run.

## Talks to

The dbt Cloud Admin API, the artifact bucket, and catalogue (to hand over changes, with the service identity).

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): Cloud SQL client, write access to the artifact bucket, the dbt Cloud token from Secret Manager.
