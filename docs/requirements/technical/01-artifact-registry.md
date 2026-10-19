# Artifact registry: technical requirements

| | |
| --- | --- |
| Realises | [Artifact registry](../functional/01-artifact-registry.md) |
| Status | Fetching, storing, processing and reading implemented; Changes follow |
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

**Status:** Implemented · **Realises:** [FR-AR-07](../functional/01-artifact-registry.md#fr-ar-07), [FR-AR-08](../functional/01-artifact-registry.md#fr-ar-08), [DEC-AR-03](../functional/01-artifact-registry.md#dec-ar-03), [DEC-DH-23](../../overview/data-hub.md#dec-dh-23)

Processing turns a set into rows in the schema `registry`, all keyed by the set:

| Table | One row per | Taken from |
| --- | --- | --- |
| `nodes` | model, seed, snapshot, source or exposure | the manifest: unique ID, kind, name, database, schema, table name, description, materialisation, tags, file path, the checksum of its code, and its meta as JSON, as the dbt project writes it (`meta` of the Node and of its config, the config winning per key) |
| `columns` | column of a Node | the catalog: actual name, type and position, with the description from the manifest, matched by name regardless of case. A Node the catalog does not know, such as an ephemeral model or an exposure, keeps the columns of the manifest, without a type |
| `edges` | Node that depends on another Node of the same project | `depends_on.nodes` in the manifest, between Nodes only |
| `tests` | data test on a Node | the test's name (`not_null`, `unique`, `relationships`, …), its Node and column, and its severity; a relationships test also with its target Node and target column |

Links between the two projects ([DEC-AR-03](../functional/01-artifact-registry.md#dec-ar-03)) are not stored. Every Node keeps its table as `database.schema.table`, in lowercase and without quotes, and reading the lineage joins a source to the Node of the other project that has the same table, between the Current Versions.

<a id="tr-ar-04"></a>
### TR-AR-04 · A set becomes current only when all of it is in

**Status:** Implemented · **Realises:** [FR-AR-09](../functional/01-artifact-registry.md#fr-ar-09), [EC-AR-01](../functional/01-artifact-registry.md#ec-ar-01), [FR-AR-06](../functional/01-artifact-registry.md#fr-ar-06), [DEC-DH-24](../../overview/data-hub.md#dec-dh-24)

The rows of a set are written in one transaction, which also makes the set the Current Version of its dbt project, unless the project already has a Current Version from a later run: the Current Version never goes back in time ([EC-AR-01](../functional/01-artifact-registry.md#ec-ar-01)), and such a set is kept as processed but not current. If anything fails, nothing of the set stays behind: it gets the status `failed` with the error, and the Current Version stays as it was.

The rows are kept for the Current Version and the one before it, which the comparison of [FR-AR-11](../functional/01-artifact-registry.md#fr-ar-11) needs. Older sets keep their status, and their files stay in the bucket, so any of them can be processed again ([FR-AR-14](../functional/01-artifact-registry.md#fr-ar-14)).

<a id="tr-ar-05"></a>
### TR-AR-05 · Searching the Nodes

**Status:** Implemented · **Realises:** [FR-AR-10](../functional/01-artifact-registry.md#fr-ar-10), [DEC-SR-10](../functional/04-stacks-and-resources.md#dec-sr-10)

`GET /nodes?q=<text>&type=<kind>&project=<ID>` searches the Nodes of the Current Versions, in Postgres itself ([DEC-SR-10](../functional/04-stacks-and-resources.md#dec-sr-10)):

- **by name**, also with a typo or half a name, through trigrams (`pg_trgm`, in the schema `public`, which every schema can use);
- **by free text** in the descriptions of Nodes and columns, and in column names, through full-text search with the `simple` configuration, which neither stems nor drops words, since the descriptions mix English and Dutch.

An exact name comes first, then names that start with the text, then the closest names and the best text matches. Each hit names up to five matching columns. `type` limits the search to models, seeds, snapshots, sources or exposures, and `project` to one dbt project, by its ID in dbt Cloud.

Every route of registry that reads, and processing a run again, needs the role of the Data Team for now (`datateam`, from its Role Group). Who else may read the registry is open ([OP-AR-05](../functional/01-artifact-registry.md#op-ar-05)). `GET /projects` gives each dbt project with its Current Version; `GET /runs` gives the latest runs dbt Cloud reported, with their status and error.

<a id="tr-ar-06"></a>
### TR-AR-06 · One Node and its lineage, across both projects

**Status:** Implemented · **Realises:** [FR-AR-08](../functional/01-artifact-registry.md#fr-ar-08), [FR-AR-10](../functional/01-artifact-registry.md#fr-ar-10), [DEC-AR-03](../functional/01-artifact-registry.md#dec-ar-03)

`GET /nodes/{unique ID}` gives a Node of a Current Version with its meta, its columns, in the order of the table, and its tests. A set processed before registry kept the meta has none until it is processed again ([TR-AR-07](#tr-ar-07)). `GET /nodes/{unique ID}/lineage?direction=upstream|downstream&depth=<n>` follows the Edges of the Current Versions, plus the links between the projects ([TR-AR-03](#tr-ar-03)), up to `depth` steps (10 by default, at most 50). It gives every Node reached with its shortest distance, the links between them, and whether more Nodes lie beyond the first 500.

<a id="tr-ar-07"></a>
### TR-AR-07 · Processing a run again by hand

**Status:** Implemented · **Realises:** [FR-AR-14](../functional/01-artifact-registry.md#fr-ar-14), [DEC-AR-02](../functional/01-artifact-registry.md#dec-ar-02)

`POST /runs/{run ID}/reprocess` puts a processed or failed Artifact Set back in the queue and starts the ingest job, which reads the files from the bucket and only goes to dbt Cloud for a file that is not there. A set in progress is left alone (`409`). A run registry never heard of, because its webhook was lost, is first looked up in dbt Cloud: only a successful run of a Source Job of this environment is recorded and processed.

<a id="tr-ar-08"></a>
### TR-AR-08 · registry tells catalogue which tables are exposed to Data Hub

**Status:** Implemented · **Realises:** [FR-SR-32](../functional/04-stacks-and-resources.md#fr-sr-32), [DEC-SR-22](../functional/04-stacks-and-resources.md#dec-sr-22), [DEC-SR-23](../functional/04-stacks-and-resources.md#dec-sr-23), [DEC-SR-24](../functional/04-stacks-and-resources.md#dec-sr-24), [DEC-PF-26](00-platform.md#dec-pf-26)

When the ingest job has made an Artifact Set the Current Version of its dbt project, it collects every Node an exposure with the tag `datahub` depends on and that is a table or view in BigQuery (the tag may stand at the top of the exposure or in its `config`, as dbt Fusion prefers), so with a `relation` ([TR-AR-03](#tr-ar-03)). Per table it sends its `relation` as Key, its unique ID, name, kind of Node and description, the names of those exposures, and the `label` of an exposure that depends on that table alone.

It sends them, all at once for the project, to catalogue's `POST /internal/resources`, with a Google ID token of the service account of registry for catalogue's address as audience. A set that is processed but does not become current is not sent. A call that fails is logged and does not fail the set: the next run of the project sends the whole state again, and processing a run again ([TR-AR-07](#tr-ar-07)) sends it at once.

## Open points

None yet.
