# eda

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/eda` |
| Schema | `eda` |
| Domains | [EDA](../../requirements/functional/15-eda.md) |

**In one sentence:** eda keeps the EDA of each Resource, its EDA-Probes, their runs, results and readings, writes the SQL of each EDA-Probe and has query run it as the User, and tells catalogue when an EDA-Setup is complete; it reads no data itself ([DEC-ED-26](../../requirements/functional/15-eda.md#dec-ed-26)).

## Responsibilities

- The EDA of a Resource, started by a User with `eda.use`, In progress until its EDA-Setup is complete, then Explored: [FR-ED-01](../../requirements/functional/15-eda.md#fr-ed-01), [FR-ED-02](../../requirements/functional/15-eda.md#fr-ed-02), built as [TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01) and [TR-ED-06](../../requirements/technical/15-eda.md#tr-ed-06)
- The EDA-Probes per model type, which are needed, and when one is complete, from one catalogue in contracts: [FR-ED-05](../../requirements/functional/15-eda.md#fr-ed-05), built as [TR-ED-02](../../requirements/technical/15-eda.md#tr-ed-02)
- The SQL of an EDA-Probe, returning aggregates only, and its result with Data Hub's reading: [FR-ED-07](../../requirements/functional/15-eda.md#fr-ed-07) to [FR-ED-10](../../requirements/functional/15-eda.md#fr-ed-10), built as [TR-ED-03](../../requirements/technical/15-eda.md#tr-ed-03)
- Running an EDA-Probe through query, as the User: [FR-ED-06](../../requirements/functional/15-eda.md#fr-ed-06), built as [TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)
- The readings of who works on the EDA: [FR-ED-11](../../requirements/functional/15-eda.md#fr-ed-11)
- Telling catalogue that an EDA-Setup is complete, which makes the Resource 4 · Explored: [FR-ED-12](../../requirements/functional/15-eda.md#fr-ed-12), built as [TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)

## How an EDA-Probe runs

1. eda asks catalogue, with the token of the User, for the Resource: whether the User sees it, its Level, model type, fields in the order of the Resource Card with their types, its Key Fields, the roles of its model type, its grain, its mappings, the full name of its table in its own case, its partition column and whether a filter on it is required ([TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01)).
2. It sets the EDA-Probe on the fields asked, or on those it applies to by default ([TR-ED-02](../../requirements/technical/15-eda.md#tr-ed-02)), in the order of the Resource Card, and checks its parameters. An EDA-Probe Data Hub does not run yet, one not offered for the model type, The grain holds without recorded grain fields, and Volume over time without the date of its role cannot run (422).
3. It writes one `SELECT` over the table, by its full name, that returns aggregates only ([TR-ED-03](../../requirements/technical/15-eda.md#tr-ed-03)). A table that requires a filter on its partition column gets one that keeps every partition, the one without a value among them, and names the column, so that the Pre-flight of query finds it: `(col is null or col >= <the lowest value of its type>)`.
4. query runs it as the User ([TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)). What its Pre-flight asks is passed on unchanged: to approve, or that it cannot run; nothing is added or kept then.
5. Once it ran, eda turns the answer into a result per subject, the table as a whole (`''`) or a field, with Data Hub's reading, adds the EDA-Probe if it is not yet, sets it on what it ran with, and keeps the run with who ran it, when, the bytes it read and its Query ID, in one transaction.
6. It computes the EDA again from the contracts, with the fields each EDA-Probe last ran on. When every needed EDA-Probe is complete, an EDA in progress becomes Explored and catalogue is told, until it heard it ([TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)). An EDA-Probe Data Hub cannot run yet still counts as needed, so in the first build no EDA becomes Explored ([OP-ED-09](../../requirements/functional/15-eda.md#op-ed-09)).

## The SQL of each EDA-Probe

Each EDA-Probe is a module of its own in `src/probes`, with the SQL it writes and how it reads the answer. Every value of the answer is read as BigQuery writes it, as text.

| EDA-Probe | SQL | Result and Data Hub's reading |
| --- | --- | --- |
| The grain holds ([FR-ED-07](../../requirements/functional/15-eda.md#fr-ed-07)) | One scan, grouped by the grain fields: the rows, the rows with an empty grain field, how many grain values are on 1, 2, 3, or 4 rows and more, the rows they cover, and the 5 on the most rows above one, as JSON | For the table as a whole: expected when no grain value is on more than one row and none is empty, look at this otherwise |
| Nulls per Key Field ([FR-ED-08](../../requirements/functional/15-eda.md#fr-ed-08)) | One scan: the rows, and per field the rows where it is empty | Per field: expected without empty values, for you to judge with some, look at this with some in a field that holds a role ([DEC-ED-22](../../requirements/functional/15-eda.md#dec-ed-22)) |
| Volume over time ([FR-ED-09](../../requirements/functional/15-eda.md#fr-ed-09)) | One scan, each date beside the others: per date and period the rows and, for an aggregate or a fact, the sum of the field that adds up (`addsUp`, or `measure` for a fact). A period is a day, or the week from a Monday for the `period` of an aggregate; a moment falls on its day in Brussels | Per date, in eda: every period from the first to the last, the empty ones, the current one, and per unit, 7, 14, 21 and 28 days from a Monday and a day for a daily unit, the average, the standard deviation of a sample, P25, the median, P75, the lowest and the highest, leaving out a block with an empty period and the current, incomplete one. Look at this with an empty period, expected otherwise ([DEC-ED-23](../../requirements/functional/15-eda.md#dec-ed-23)) |
| Distribution of numbers ([FR-ED-10](../../requirements/functional/15-eda.md#fr-ed-10)) | Two passes, each field beside the others: the quantiles by `APPROX_QUANTILES`, a round width of 1, 2, 2.5 or 5 times a power of ten for about twelve bins up to P95 and the tail from there, or the width and tail the User gave; then the rows per bin and in the tail | Per field, always for you to judge ([DEC-ED-24](../../requirements/functional/15-eda.md#dec-ed-24)) |

Parameters: The grain holds and Nulls per Key Field have none. Volume over time takes `measure`, the field that adds up, or `null` for rows only, and `mayBeEmpty: 'weekends'` for a count per day. Distribution of numbers takes `width` and `tailFrom`, a number for every field or one per field.

## API

Every route needs the Access Token of a User with `eda.use` and answers 403 without it ([TR-ED-06](../../requirements/technical/15-eda.md#tr-ed-06)); a Resource the User does not see is not found. When catalogue or query does not answer, eda answers 503.

| Endpoint | Purpose |
| --- | --- |
| `GET /edas` | The EDAs of the Resources the User sees, each with its Resource, Collection, status and needed EDA-Probes complete, as last computed; and, as `ready`, the Resources at 3 · Confirmed or above without one, from the Collections catalogue lists for the User ([FR-ED-03](../../requirements/functional/15-eda.md#fr-ed-03)) |
| `POST /resources/{id}/eda` | Starts the EDA of a Resource at 3 · Confirmed or above: 201 with the EDA, 409 when it has one, 422 below 3 ([FR-ED-02](../../requirements/functional/15-eda.md#fr-ed-02)) |
| `GET /resources/{id}/eda` | The EDA as the tab Steps and the Maturity of the Resource show it, `EdaView` of the contracts; 404 without an EDA ([FR-ED-04](../../requirements/functional/15-eda.md#fr-ed-04)) |
| `POST /resources/{id}/eda/probes/{probe}/runs` | With `{ fields?, params?, approve? }`: adds the EDA-Probe if it is not yet and runs it through query; `{ state: 'ran', eda }`, or what the Pre-flight asks, `{ state: 'approve', bytes }` or `{ state: 'refused', bytes, reason }` ([FR-ED-06](../../requirements/functional/15-eda.md#fr-ed-06)) |
| `PUT /resources/{id}/eda/probes/{probe}/readings` | With `{ subject, reading }`, `expected`, `known` or `problem`: the reading of a result of its last run, in place of an earlier one; the EDA as it is after ([FR-ED-11](../../requirements/functional/15-eda.md#fr-ed-11)) |

## Data

The schema `eda` ([TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01)), migration `0001-edas`:

- `edas`: one per Resource; its status, who started it and when, when it became Explored, when catalogue heard it (`told_at`), and the needed EDA-Probes and how many are complete as last computed, for the panel.
- `eda_probes`: per EDA and EDA-Probe, the fields and parameters it is set on, who added it and when.
- `eda_runs`: per run, the fields and parameters it ran with, who ran it and when, the bytes it read and its Query ID in the Query Log of query.
- `eda_results`: per run and subject, its numbers as JSON and Data Hub's reading.
- `eda_readings`: per EDA, EDA-Probe and subject, the reading of who works on the EDA, with who gave it and when.

Results hold aggregates only, never rows of a table.

## Talks to

catalogue (`DATAHUB_CATALOGUE_URL`), with the token of the User, for a Resource as the User sees it (`GET /resources/{id}`), the name of its Collection (`GET /collections/{id}`) and the Collections they see (`GET /collections`); and with its Google ID token for catalogue's address when an EDA-Setup is complete (`POST /internal/resources/{id}/eda` with `{ explored: true }`), again until catalogue heard it and whenever catalogue says the Resource is not explored ([TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)); query (`DATAHUB_QUERY_URL`), with the token of the User, to run an EDA-Probe (`POST /resources/{id}/eda/runs`, [TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)); identity (`DATAHUB_TOKEN_ISSUER`) for the public keys of the tokens.

## Permissions

The Cloud SQL client role and its login to Postgres, as every service with a database. No role on BigQuery: query reads the data ([TR-ED-08](../../requirements/technical/15-eda.md#tr-ed-08)).
