# query

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/query` |
| Schema | `query` |
| Domains | [Resources](../../requirements/functional/04-stacks-and-resources.md) (querying), [Log and notifications](../../requirements/functional/07-log-and-notifications.md) (the Query Log), [Channels](../../requirements/functional/13-channels.md) |

**In one sentence:** query is the only service that reads the tables of the Resources: it runs the queries of Query and keeps them in the Query Log, and later shows previews, runs free SQL for Claude and serves feeds to Excel, always only over Resources the User may see.

## Responsibilities

- Query, a section for SQL over the Resources the User may see: [FR-SR-41](../../requirements/functional/04-stacks-and-resources.md#fr-sr-41), built as [TR-SR-15](../../requirements/technical/04-stacks-and-resources.md#tr-sr-15) to [TR-SR-17](../../requirements/technical/04-stacks-and-resources.md#tr-sr-17)
- The Pre-flight before every query, with its two thresholds and the partition filter: [FR-SR-36](../../requirements/functional/04-stacks-and-resources.md#fr-sr-36), [FR-SR-37](../../requirements/functional/04-stacks-and-resources.md#fr-sr-37), [FR-SR-40](../../requirements/functional/04-stacks-and-resources.md#fr-sr-40)
- A limit on scanned bytes and a label with the User on every query: [FR-SR-27](../../requirements/functional/04-stacks-and-resources.md#fr-sr-27)
- The Query Log, with a Query ID on every result: [FR-LN-05](../../requirements/functional/07-log-and-notifications.md#fr-ln-05), [DEC-LN-01](../../requirements/functional/07-log-and-notifications.md#dec-ln-01)
- Later: the preview of the first rows ([FR-SR-38](../../requirements/functional/04-stacks-and-resources.md#fr-sr-38)), free SQL through Claude ([FR-SR-26](../../requirements/functional/04-stacks-and-resources.md#fr-sr-26)) and feeds for Excel through Power Query ([DEC-DH-46](../../overview/data-hub.md#dec-dh-46))

## How a query is checked

Its service account may read every table of the project ([DEC-SR-32](../../requirements/functional/04-stacks-and-resources.md#dec-sr-32)), so query decides what a query reads, in its Pre-flight and again before every run ([TR-SR-15](../../requirements/technical/04-stacks-and-resources.md#tr-sr-15)):

1. query asks catalogue, with the token of the User, for each Resource of the query: whether the User may see it, its Key, its fields and how it is stored.
2. It reads the tables named in the SQL: each must be one of those Resources.
3. A dry run in BigQuery says what the query reads at most, that it only reads (`SELECT`), and which tables it reads: those Resources, or the tables beneath them.
4. The bytes give the range: up to 100 MB it runs, up to 1 GB its author approves it, above it goes to the Data Team. Without a filter on the partition column of a Resource that requires one, it does not run ([TR-SR-16](../../requirements/technical/04-stacks-and-resources.md#tr-sr-16)).
5. It runs as a job with a maximum on the bytes billed and labels with the User and its Query ID; the pages of its result are read from that job.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /queries`, `GET /queries?all=true` | The queries of the User, newest run first; everyone's for the Data Team ([TR-SR-17](../../requirements/technical/04-stacks-and-resources.md#tr-sr-17)) |
| `POST /queries` | A new query: its name, question and Resources, with SQL that filters on their partition columns |
| `GET /queries/{id}`, `PATCH /queries/{id}` | A query with its Resources and its last run, for who made it and the Data Team; its name, question and SQL changed by who made it |
| `POST /queries/{id}/preflight` | The Pre-flight of the SQL being written, which it keeps ([TR-SR-16](../../requirements/technical/04-stacks-and-resources.md#tr-sr-16)) |
| `POST /queries/{id}/runs` | A run, with its first page, after the same checks |
| `GET /runs/{queryId}/rows?page=n` | A page of 100 rows of a run, from the same job, for who ran it |
| `GET /resources/{id}/preview`, `GET /feeds/{id}` | Later: the preview of a Resource, a feed for Power Query with an Excel key ([TR-PF-07](../../requirements/technical/00-platform.md#tr-pf-07)) |

## Data

The schema `query` ([DEC-PF-29](../../requirements/technical/00-platform.md#dec-pf-29)): `queries`, one row per query with its Resources as they were named when it was made and the SQL being written, and `runs`, the Query Log, one row per run ([TR-SR-17](../../requirements/technical/04-stacks-and-resources.md#tr-sr-17)). The Data Team reads it in Cloud SQL Studio ([TR-PF-28](../../requirements/technical/00-platform.md#tr-pf-28)). Its migrations are in `services/query/src/migrations`.

## Talks to

BigQuery, in the project and location of Data Hub (`DATAHUB_BIGQUERY_PROJECT`, `DATAHUB_BIGQUERY_LOCATION`), and catalogue (`DATAHUB_CATALOGUE_URL`), with the token of the User.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): BigQuery Data Viewer on the project of Data Hub and BigQuery Job User, and Cloud SQL client. The only service with access to data.
