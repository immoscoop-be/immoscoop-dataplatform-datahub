# Artifact registry: technical requirements

| | |
| --- | --- |
| Realises | [Artifact registry](../functional/01-artifact-registry.md) |
| Status | Fetching, storing and processing implemented; reading the lineage and Changes follow |
| Source of truth | This file |

How a run of a Source Job becomes the Current Version of its dbt project, in the service [registry](../../architecture/services/registry.md).

## Requirements

<a id="tr-ar-01"></a>
### TR-AR-01 · dbt Cloud announces a run with a signed webhook

**Status:** Implemented · **Realises:** [FR-AR-01](../functional/01-artifact-registry.md#fr-ar-01), [FR-AR-03](../functional/01-artifact-registry.md#fr-ar-03), [FR-AR-05](../functional/01-artifact-registry.md#fr-ar-05), [DEC-AR-02](../functional/01-artifact-registry.md#dec-ar-02)

registry answers `POST /webhooks/dbt-cloud`. The route is public, because dbt Cloud has no Access Token; the signature protects it instead. A delivery counts only when:

- its `Authorization` header holds the HMAC-SHA256 of the raw body, in hex, keyed with the secret `datahub-dbt-webhook-secret`, compared in constant time; otherwise registry answers `401`;
- it reports `job.run.completed` with run status `Success`, for the dbt Cloud account of Data Hub and a Source Job of this environment ([DEC-AR-01](../functional/01-artifact-registry.md#dec-ar-01)); any other signed delivery is answered `204` and ignored.

A delivery that counts records the run as an Artifact Set with status `pending`, at most once per run ID: a repeated delivery changes nothing. registry then starts the ingest job ([TR-AR-02](#tr-ar-02)) and answers, well within the 10 seconds dbt Cloud waits before it tries again.

<a id="tr-ar-02"></a>
### TR-AR-02 · The ingest job fetches and stores the Artifacts

**Status:** Implemented · **Realises:** [FR-AR-01](../functional/01-artifact-registry.md#fr-ar-01), [FR-AR-04](../functional/01-artifact-registry.md#fr-ar-04), [FR-AR-06](../functional/01-artifact-registry.md#fr-ar-06), [EC-AR-02](../functional/01-artifact-registry.md#ec-ar-02), [DEC-DH-22](../../overview/data-hub.md#dec-dh-22), [DEC-PF-20](00-platform.md#dec-pf-20)

The Cloud Run job `datahub-registry-ingest` runs the image of registry (`node dist/ingest.js`) under the service account of registry. It takes the pending Artifact Sets one by one, oldest first, and locks each set it takes, so two runs of the job never work on the same set. A set that has been in progress for more than an hour, because a run of the job stopped halfway, counts as pending again.

For each set it reads `manifest.json` and `catalog.json` from the artifact bucket, at `<dbt project ID>/<run ID>/`. A file that is not there yet is fetched from the dbt Cloud Admin API (`/api/v2/accounts/<account>/runs/<run>/artifacts/<file>`) with the service token in `datahub-dbt-cloud-token`, and stored in the bucket byte for byte as it came. dbt Cloud may need a moment after the run to publish its files, so a missing file is asked for again a few times, with growing pauses. Once in the bucket, a file is never replaced: a run that is processed again reads its files from there, even after dbt Cloud has dropped them.

A set without a catalog, or with a file that cannot be read, gets the status `failed` with the reason, and the job goes on with the next set.

<a id="tr-ar-03"></a>
### TR-AR-03 · The normalised tables

**Status:** Specified · **Realises:** [FR-AR-07](../functional/01-artifact-registry.md#fr-ar-07), [FR-AR-08](../functional/01-artifact-registry.md#fr-ar-08), [DEC-AR-03](../functional/01-artifact-registry.md#dec-ar-03), [DEC-DH-23](../../overview/data-hub.md#dec-dh-23)

Processing turns a set into rows in the schema `registry`, all keyed by the set:

| Table | One row per | Taken from |
| --- | --- | --- |
| `nodes` | model, seed, snapshot, source or exposure | the manifest: unique ID, kind, name, database, schema, table name, description, materialisation, tags, file path, and the checksum of its code |
| `columns` | column of a Node | the catalog: actual name, type and position, with the description from the manifest, matched by name regardless of case. A Node the catalog does not know, such as an ephemeral model or an exposure, keeps the columns of the manifest, without a type |
| `edges` | Node that depends on another Node of the same project | `depends_on.nodes` in the manifest, between Nodes only |
| `tests` | data test on a Node | the test's name (`not_null`, `unique`, `relationships`, …), its Node and column, and its severity; a relationships test also with its target Node and target column |

Links between the two projects ([DEC-AR-03](../functional/01-artifact-registry.md#dec-ar-03)) are not stored. Every Node keeps its table as `database.schema.table`, in lowercase and without quotes, and reading the lineage joins a source to the Node of the other project that has the same table, between the Current Versions.

<a id="tr-ar-04"></a>
### TR-AR-04 · A set becomes current only when all of it is in

**Status:** Implemented · **Realises:** [FR-AR-09](../functional/01-artifact-registry.md#fr-ar-09), [EC-AR-01](../functional/01-artifact-registry.md#ec-ar-01), [FR-AR-06](../functional/01-artifact-registry.md#fr-ar-06), [DEC-DH-24](../../overview/data-hub.md#dec-dh-24)

The rows of a set are written in one transaction, which also makes the set the Current Version of its dbt project, unless the project already has a Current Version from a later run: the Current Version never goes back in time ([EC-AR-01](../functional/01-artifact-registry.md#ec-ar-01)), and such a set is kept as processed but not current. If anything fails, nothing of the set stays behind: it gets the status `failed` with the error, and the Current Version stays as it was.

The rows are kept for the Current Version and the one before it, which the comparison of [FR-AR-11](../functional/01-artifact-registry.md#fr-ar-11) needs. Older sets keep their status, and their files stay in the bucket, so any of them can be processed again ([FR-AR-14](../functional/01-artifact-registry.md#fr-ar-14)).

## Open points

None yet.
