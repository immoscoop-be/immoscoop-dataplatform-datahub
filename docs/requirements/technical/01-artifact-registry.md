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
- it reports `job.run.completed` with run status `Success`, for the dbt Cloud account of Data Hub and a Source Job of this environment ([DEC-AR-09](../functional/01-artifact-registry.md#dec-ar-09)); any other signed delivery is answered `204` and ignored.

A delivery that counts records the run as an Artifact Set with status `pending`, at most once per run ID: a repeated delivery changes nothing. registry then starts the ingest job ([TR-AR-02](#tr-ar-02)) and answers, well within the 10 seconds dbt Cloud waits before it tries again.

*Note of 2026-10-31: the Source Jobs are read at every delivery, so that a change on the page Webhooks counts from the next run ([TR-AR-12](#tr-ar-12)), and every delivery is kept with what registry did with it ([TR-AR-13](#tr-ar-13)).*

<a id="tr-ar-02"></a>
### TR-AR-02 · The ingest job fetches and stores the Artifacts

**Status:** Implemented · **Realises:** [FR-AR-01](../functional/01-artifact-registry.md#fr-ar-01), [FR-AR-04](../functional/01-artifact-registry.md#fr-ar-04), [FR-AR-06](../functional/01-artifact-registry.md#fr-ar-06), [EC-AR-02](../functional/01-artifact-registry.md#ec-ar-02), [DEC-DH-22](../../overview/data-hub.md#dec-dh-22), [DEC-PF-20](00-platform.md#dec-pf-20)

The Cloud Run job `datahub-registry-ingest` runs the image of registry (`node dist/ingest.js`) under the service account of registry. It takes the pending Artifact Sets one by one, oldest first, and locks each set it takes, so two runs of the job never work on the same set. A set that has been in progress for more than an hour, because a run of the job stopped halfway, counts as pending again.

For each set it reads `manifest.json` and `catalog.json` from the artifact bucket, at `<dbt project ID>/<run ID>/`. A file that is not there yet is fetched from the dbt Cloud Admin API (`/api/v2/accounts/<account>/runs/<run>/artifacts/<file>`) with the service token in `datahub-dbt-cloud-token`, and stored in the bucket byte for byte as it came. dbt Cloud may need a moment after the run to publish its files, so a missing file is asked for again a few times, with growing pauses. Once in the bucket, a file is never replaced: a run that is processed again reads its files from there, even after dbt Cloud has dropped them.

A set without a catalog, or with a file that cannot be read, gets the status `failed` with the reason, and the job goes on with the next set.

<a id="tr-ar-03"></a>
### TR-AR-03 · The normalised tables

**Status:** Implemented · **Realises:** [FR-AR-07](../functional/01-artifact-registry.md#fr-ar-07), [FR-AR-08](../functional/01-artifact-registry.md#fr-ar-08), [FR-AR-16](../functional/01-artifact-registry.md#fr-ar-16), [DEC-AR-03](../functional/01-artifact-registry.md#dec-ar-03), [DEC-AR-07](../functional/01-artifact-registry.md#dec-ar-07), [DEC-DH-23](../../overview/data-hub.md#dec-dh-23), [DEC-SR-34](../functional/04-stacks-and-resources.md#dec-sr-34)

Processing turns a set into rows in the schema `registry`, all keyed by the set:

| Table | One row per | Taken from |
| --- | --- | --- |
| `nodes` | model, seed, snapshot, source or exposure | the manifest: unique ID, kind, name, database, schema, table name, description, materialisation, tags, file path, the checksum of its code, and its meta as JSON, as the dbt project writes it (`meta` of the Node and of its config, the config winning per key). For a Node of Colleciónes also its Entity, action, strategy and layer, from the tags its generator writes (`colleciones:entity:<entity>` and so on) or else from `meta.domain` and `meta.model` ([FR-AR-16](../functional/01-artifact-registry.md#fr-ar-16)). How its table is stored in BigQuery, from its config: the field of `partition_by` and the unit of its partitions (`granularity`, a day unless it says otherwise; none for an integer range), the columns of `cluster_by` in their order, and whether `require_partition_filter` is set ([FR-CO-34](../functional/03-collections.md#fr-co-34)) |
| `columns` | column of a Node | the catalog: actual name, type and position, with the description and the meta from the manifest, matched by name regardless of case; the meta is kept as the dbt project writes it, so what Colleciónes says a column maps to is there as it wrote it ([DEC-AR-07](../functional/01-artifact-registry.md#dec-ar-07)). A Node the catalog does not know, such as an ephemeral model or an exposure, keeps the columns of the manifest, without a type |
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

`GET /nodes/{unique ID}` gives a Node of a Current Version with its meta, its Entity, action, strategy and layer, its columns with their meta, in the order of the table, and its tests. A set processed before registry kept the meta has none until it is processed again ([TR-AR-07](#tr-ar-07)). `GET /nodes/{unique ID}/lineage?direction=upstream|downstream&depth=<n>` follows the Edges of the Current Versions, plus the links between the projects ([TR-AR-03](#tr-ar-03)), up to `depth` steps (10 by default, at most 50). It gives every Node reached with its shortest distance, the links between them, and whether more Nodes lie beyond the first 500.

<a id="tr-ar-07"></a>
### TR-AR-07 · Processing a run again by hand

**Status:** Implemented · **Realises:** [FR-AR-14](../functional/01-artifact-registry.md#fr-ar-14), [DEC-AR-02](../functional/01-artifact-registry.md#dec-ar-02)

`POST /runs/{run ID}/reprocess` puts a processed or failed Artifact Set back in the queue and starts the ingest job, which reads the files from the bucket and only goes to dbt Cloud for a file that is not there. A set in progress is left alone (`409`). A run registry never heard of, because its webhook was lost, is first looked up in dbt Cloud: only a successful run of a Source Job of this environment is recorded and processed.

<a id="tr-ar-08"></a>
### TR-AR-08 · registry tells catalogue which tables are exposed to Data Hub

**Status:** Implemented · **Realises:** [FR-SR-32](../functional/04-stacks-and-resources.md#fr-sr-32), [DEC-SR-22](../functional/04-stacks-and-resources.md#dec-sr-22), [DEC-SR-23](../functional/04-stacks-and-resources.md#dec-sr-23), [DEC-SR-24](../functional/04-stacks-and-resources.md#dec-sr-24), [DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44), [DEC-PF-26](00-platform.md#dec-pf-26)

When the ingest job has made an Artifact Set the Current Version of its dbt project, it collects every Node an exposure with the tag `datahub` depends on and that is a table or view in BigQuery (the tag may stand at the top of the exposure or in its `config`, as dbt Fusion prefers), so with a `relation` ([TR-AR-03](#tr-ar-03)). Per table it sends its `relation` as Key, its full name in its own case (its database, schema and table name, without quotes; [DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44)), its unique ID, name, kind of Node and description, the names of those exposures, the `label` of an exposure that depends on that table alone, the checksum of its code, and its columns in the order of the table, each with its name, type and description.

It sends them, all at once for the project, to catalogue's `POST /internal/resources`, with a Google ID token of the service account of registry for catalogue's address as audience. A set that is processed but does not become current is not sent. A call that fails is logged and does not fail the set: the next run of the project sends the whole state again, and processing a run again ([TR-AR-07](#tr-ar-07)) sends it at once.

<a id="tr-ar-09"></a>
### TR-AR-09 · registry reads the Domain Model from the collector, every time

**Status:** Implemented · **Realises:** [FR-AR-15](../functional/01-artifact-registry.md#fr-ar-15), [EC-AR-05](../functional/01-artifact-registry.md#ec-ar-05), [DEC-AR-04](../functional/01-artifact-registry.md#dec-ar-04), [DEC-AR-05](../functional/01-artifact-registry.md#dec-ar-05)

registry reads the Domain Model in use from `GET /domain-model` of the collector of Colleciónes, `https://colleciones-eventos.immoscoop.be` (`DATAHUB_COLLECTOR_URL` overrides it), each time it needs it, and keeps no copy. It takes from the runtime contract its name and version, the release of the package it comes from, its Entities with their identifiers, references and actions, who performs each action, and its relation types with their cardinalities and inverses. A collector that does not answer within ten seconds, or not with a Domain Model, is reported as such ([EC-AR-05](../functional/01-artifact-registry.md#ec-ar-05)).

`GET /domain-model`, for the Data Team, answers with the name, version and release, the relation types a field can map to, and every identity: `entity.identifier`, and `entity.action` for the ID of an event. The relation types are those the Domain Model uses in its references; their inverses, such as `basisFor`, count from the other side and are left out ([DEC-RC-05](../functional/05-resource-card.md#dec-rc-05)). Each type comes with its cardinality, one or many, or both while the Domain Model gives it both. Without the collector it answers `503 domain_model_unavailable`.

<a id="tr-ar-10"></a>
### TR-AR-10 · registry proposes the grain, storage and mappings of a Resource

**Status:** Implemented · **Realises:** [FR-AR-17](../functional/01-artifact-registry.md#fr-ar-17), [FR-CO-33](../functional/03-collections.md#fr-co-33), [FR-CO-34](../functional/03-collections.md#fr-co-34), [DEC-RC-07](../functional/05-resource-card.md#dec-rc-07), [DEC-RC-09](../functional/05-resource-card.md#dec-rc-09), [DEC-RC-14](../functional/05-resource-card.md#dec-rc-14), [DEC-SR-34](../functional/04-stacks-and-resources.md#dec-sr-34)

`GET /nodes/{id}/proposal`, for the Data Team, proposes for the Resource on a Node what the step that adds it shows ([FR-CO-33](../functional/03-collections.md#fr-co-33)). Each value says where it comes from; all are suggestions ([DEC-RC-09](../functional/05-resource-card.md#dec-rc-09)).

- **How it is stored:** from the nearest model up the lineage, the Node itself first, that is partitioned or clustered ([DEC-SR-34](../functional/04-stacks-and-resources.md#dec-sr-34)). Only a column the Node has under the same name counts: a view that derives its own column promises nothing. A partition filter that model requires is required by BigQuery.
- **What it is built on:** the Node itself, or the nearest Colleciónes model up the lineage, with its Entity and action ([FR-AR-16](../functional/01-artifact-registry.md#fr-ar-16)).
- **The grain:** the field of a `unique` test on the Node, from a dbt test; else the field the Colleciónes model declares by the word of its grain, `eventId` for an event, its identifier for a state, from the Domain Model.
- **The model type:** `event` or `state` from the strategy of the Colleciónes model; nothing otherwise.
- **The mappings, per field:** first what `meta.domain` of the column says, on the Node or on the same column of the Colleciónes model ([DEC-AR-07](../functional/01-artifact-registry.md#dec-ar-07)); then, from the Domain Model, for a Colleciónes model: `eventId` is `entity.action`, an identifier of its Entity is that identity, a field named as an identifier of the target of one of its references maps with that relation type, and the field named as an identifier of who performs the action is "performed by", one per event ([DEC-RC-14](../functional/05-resource-card.md#dec-rc-14)); last, for any Node, a field named as the identifier of one Entity, or of the Entity named after it when several share it, is that identity, suggested from its name.

Without the Domain Model the proposal still holds what dbt says, without a mapping from the Domain Model, and says the Domain Model is missing ([EC-AR-05](../functional/01-artifact-registry.md#ec-ar-05)); otherwise it names the release it was made with.

<a id="tr-ar-11"></a>
### TR-AR-11 · registry gives catalogue the lineage around a Resource

**Status:** Implemented · **Realises:** [DEC-AR-06](../functional/01-artifact-registry.md#dec-ar-06), [FR-SR-54](../functional/04-stacks-and-resources.md#fr-sr-54)

`GET /internal/nodes/{id}/lineage?direction=upstream|downstream` takes no Access Token but a Google ID token for registry's own address, of the service account of catalogue only (`DATAHUB_CATALOGUE_SERVICE_ACCOUNT`, `DATAHUB_REGISTRY_URL`), as catalogue checks who may see the Resource ([TR-SR-11](04-stacks-and-resources.md#tr-sr-11)). It walks the lineage of the Node as `GET /nodes/{id}/lineage` does, up to fifty steps and five hundred models, across both dbt projects, and gives of each model only what everyone who sees the Resource may read: its name, kind, layer, project and distance, and the links between them ([DEC-AR-06](../functional/01-artifact-registry.md#dec-ar-06)). The layer is the one Colleciónes tags it with, else the folder under `models/` it sits in, else its kind, such as `seed`. Exposures are left out. A Node no Current Version holds answers 404.

<a id="tr-ar-12"></a>
### TR-AR-12 · registry keeps the Source Jobs, and a Data Admin changes them

**Status:** Implemented · **Realises:** [FR-AR-18](../functional/01-artifact-registry.md#fr-ar-18), [DEC-AR-09](../functional/01-artifact-registry.md#dec-ar-09)

The configuration of the environment names the dbt projects Data Hub follows and the Source Job each starts with (`DATAHUB_DBT_SOURCE_JOBS`, from `dbt_source_jobs` in its `.tfvars`). The table `source_jobs` (migration `0006-webhooks`) keeps, per dbt project, the job a Data Admin chose instead, its name, who chose it and when; that choice counts in place of the configuration, for the webhook ([TR-AR-01](#tr-ar-01)) and for processing a run again ([TR-AR-07](#tr-ar-07)). How the two relate later is open ([OP-AR-10](../functional/01-artifact-registry.md#op-ar-10)).

- `GET /admin/source-jobs` gives per dbt project its Source Job, with its name, kind and environment in dbt Cloud and whether it generates the docs, who set it and when, the last run that delivered an Artifact Set, and the address of the webhook. When dbt Cloud does not answer, it gives what registry keeps itself, and says so.
- `GET /admin/source-jobs/{dbt project ID}/jobs` reads the jobs of the dbt project from the dbt Cloud Admin API (`/api/v2/accounts/<account>/jobs/?project_id=` with its most recent run, and the environments from `/api/v3/accounts/<account>/projects/<project>/environments/`). A job is of the kind merge when it runs on a merge, CI when it builds pull requests, scheduled when it runs on a schedule, else other. A CI job, and a job of another environment than the configured Source Job of that dbt project, cannot be chosen, and the answer says why.
- `PUT /admin/source-jobs/{dbt project ID}` with `jobId` makes a job the Source Job, from the next delivery. It answers `400` without a numeric job ID, `404` for a dbt project the configuration does not name or a job that is not one of the dbt project, `409` for a job that cannot be chosen, and `503` when dbt Cloud does not answer: nobody sets a job registry could not check.

Only the Data Team may use these routes (`403` for anyone else).

<a id="tr-ar-13"></a>
### TR-AR-13 · registry keeps every delivery of the webhook for 30 days

**Status:** Implemented · **Realises:** [FR-AR-19](../functional/01-artifact-registry.md#fr-ar-19)

Every delivery to `POST /webhooks/dbt-cloud` is kept in the table `deliveries` (migration `0006-webhooks`), with when it came and what registry did: `recorded`, `ignored` with its reason (`notARun` for a test or another event, `otherAccount`, `notSucceeded`, `notSourceJob`, `otherProject`), or `refused` for a signature that does not match. Of a delivery it read, it keeps the event, the webhook, the account, the dbt project, the job and its environment, the run and its status and times; of a refused one nothing but when, as nothing of it can be trusted. At most 100 refused deliveries are kept an hour, so that trying the address cannot fill the table. Deliveries older than 30 days are deleted. Keeping a delivery never fails the webhook: an error is logged, and the answer to dbt Cloud stays the same.

`GET /admin/deliveries` gives the deliveries of the last 30 days, the newest first, each recorded one with the status of its Artifact Set as it stands now, its error and whether it is the Current Version of its dbt project, and how many call for a look: refused, or recorded and failed. A failed set is processed again with `POST /runs/{run ID}/reprocess` ([TR-AR-07](#tr-ar-07)). Only the Data Team may use the route.

## Open points

None yet.
