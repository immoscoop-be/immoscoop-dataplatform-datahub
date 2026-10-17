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

In the proposal this service was called ingest, as a Cloud Run job. It became a service because catalogue, query and mcp need to read Nodes and lineage from it, and [DEC-PF-05](../../requirements/technical/00-platform.md#dec-pf-05) forbids reading its schema directly. How the processing itself runs is open ([OP-PF-01](../../requirements/technical/00-platform.md#op-pf-01)).

## API

First sketch; the exact contracts follow in the technical requirements of the domain.

| Endpoint | Purpose |
| --- | --- |
| `POST /runs` | Signal of a finished run, from a dbt Cloud webhook or a scheduled poll ([OP-AR-02](../../requirements/functional/01-artifact-registry.md#op-ar-02)) |
| `POST /runs/{id}/reprocess` | Fetch and process a run again (Data Team) |
| `GET /projects/{project}/current` | The Current Version of a dbt project |
| `GET /nodes`, `GET /nodes/{id}` | Search Nodes, read one Node with its columns |
| `GET /nodes/{id}/lineage` | Lineage upstream or downstream, across both projects |

## Data

Artifact Sets with their status and error, Nodes, columns, Edges, tests and Changes. The files themselves, unchanged, in a GCS bucket per project and per run.

## Talks to

The dbt Cloud Admin API, the artifact bucket, and catalogue (to hand over Changes, with the service identity).

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): Cloud SQL client, write access to the artifact bucket, the dbt Cloud token from Secret Manager.
