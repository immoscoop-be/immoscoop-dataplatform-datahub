<!--
IDs: TR-ED-NN. Every TR links what it realises.
-->

# EDA: technical requirements

| | |
| --- | --- |
| Realises | [EDA](../functional/15-eda.md) |
| Status | Specified for the first build ([DEC-ED-26](../functional/15-eda.md#dec-ed-26)) |
| Source of truth | This file |

## Requirements

<a id="tr-ed-01"></a>
### TR-ED-01 · A service eda keeps the EDAs in its own schema

**Status:** Specified · **Realises:** [DEC-ED-26](../functional/15-eda.md#dec-ed-26), [FR-ED-02](../functional/15-eda.md#fr-ed-02), [FR-ED-06](../functional/15-eda.md#fr-ed-06), [FR-ED-11](../functional/15-eda.md#fr-ed-11)

`services/eda` is a backend service like the others ([TR-PF-11](00-platform.md#tr-pf-11)), with its own schema `eda` in the Postgres of Data Hub ([DEC-PF-29](00-platform.md#dec-pf-29)) and its own migrations. It has no access to BigQuery. Its tables:

- `edas`: one row per EDA, at most one per Resource (unique on `resource_id`): its status, `inProgress` or `explored`, who started it and when, and when it became Explored.
- `eda_probes`: the EDA-Probes added to an EDA, one row per EDA and EDA-Probe: the fields it is set on and its parameters, who added it and when.
- `eda_runs`: one row per run of an EDA-Probe: the fields and parameters it ran with, who ran it and when, the bytes it read and the ID of its run in the Query Log of query.
- `eda_results`: the result of a run per subject, the table as a whole (an empty subject) or a field: its numbers as JSON and Data Hub's reading, `expected`, `look` or `judge`.
- `eda_readings`: the reading of who works on the EDA per EDA, EDA-Probe and subject, `expected`, `known` or `problem`, with who gave it and when; it can be changed.

Every route needs the Access Token of a User whose Permission group holds `eda.use` ([TR-ED-06](#tr-ed-06)):

| Endpoint | Purpose |
| --- | --- |
| `GET /edas` | The EDAs of the Resources the User sees, each with its Resource, status and how many needed EDA-Probes are complete, for the panel ([FR-ED-03](../functional/15-eda.md#fr-ed-03)) |
| `POST /resources/{id}/eda` | Starts the EDA of a Resource the User sees at 3 · Confirmed or above: 409 when it has one, 422 below 3 ([FR-ED-02](../functional/15-eda.md#fr-ed-02)) |
| `GET /resources/{id}/eda` | The EDA with everything the tab Steps and the ladder show: its status, the EDA-Probes of its model type with their level, whether Data Hub runs them, added and complete, their last result and readings, what it covers per field and in its four places, and the best next step ([FR-ED-04](../functional/15-eda.md#fr-ed-04)); 404 without an EDA |
| `POST /resources/{id}/eda/probes/{probe}/runs` | Adds an EDA-Probe if it is not yet, with its fields and parameters, and runs it through query ([TR-ED-04](#tr-ed-04)); answers the EDA as `GET`, or what the Pre-flight asks: to approve, or that it cannot run |
| `PUT /resources/{id}/eda/probes/{probe}/readings` | The reading of a subject: `{ subject, reading }` ([FR-ED-11](../functional/15-eda.md#fr-ed-11)) |

For a Resource, eda asks catalogue with the token of the User whether the User sees it, and its Level, model type, fields with their types, Key Fields, the roles of its model type, its grain fields, and the partition column of its table.

<a id="tr-ed-02"></a>
### TR-ED-02 · One catalogue of EDA-Probes, shared

**Status:** Specified · **Realises:** [FR-ED-05](../functional/15-eda.md#fr-ed-05), [DEC-ED-11](../functional/15-eda.md#dec-ed-11), [DEC-ED-12](../functional/15-eda.md#dec-ed-12), [DEC-ED-17](../functional/15-eda.md#dec-ed-17)

`@datahub/contracts/eda` holds the EDA-Probes of [the table](../functional/15-eda.md#eda-steps-and-eda-probes) for eda and the web app alike: per EDA-Probe its key, name, EDA-Step, place on the table (the rows, one column, two columns together, another Resource), its level per model type (`must`, `should`, `could`, or not offered) and whether Data Hub runs it yet. It also holds what an EDA-Probe applies to on a Resource, the fields a needed one must be set on to be complete, and the shapes of the answers of eda. In the first build Data Hub runs `grainHolds`, `nullsPerKeyField`, `volumeOverTime` and `distributionOfNumbers`; every other EDA-Probe is listed as coming and, needed, still counts ([OP-ED-09](../functional/15-eda.md#op-ed-09)).

A needed EDA-Probe is complete once a run of it covers what it applies to ([DEC-ED-21](../functional/15-eda.md#dec-ed-21)):

| EDA-Probe | Applies to |
| --- | --- |
| The grain holds | The table, through its grain fields; without recorded grain fields it cannot run |
| Nulls per Key Field | Every Key Field |
| Volume over time, with empty periods | The date its role names: when it happened, when it occurred, created at or as of when, the period of an aggregate |
| Distribution of numbers | The numbers among the Key Fields |

<a id="tr-ed-03"></a>
### TR-ED-03 · eda writes the SQL of an EDA-Probe, which returns aggregates only

**Status:** Specified · **Realises:** [FR-ED-07](../functional/15-eda.md#fr-ed-07), [FR-ED-08](../functional/15-eda.md#fr-ed-08), [FR-ED-09](../functional/15-eda.md#fr-ed-09), [FR-ED-10](../functional/15-eda.md#fr-ed-10)

Per EDA-Probe that Data Hub runs, eda writes one `SELECT` over the table of the Resource, by its full name, from the fields it is set on, that returns aggregates only, never rows of the table; a table that requires a filter on its partition column gets one that keeps every partition. eda then turns the answer into the result per subject and Data Hub's reading, so that the numbers in the web app are those kept.

- **The grain holds:** the rows; the grain values; per number of rows a grain value is on, 1, 2, 3 or 4 and more, how many grain values; the rows with an empty grain field; and the 5 grain values on the most rows, above one. Expected when none is on more than one row and none is empty; look at this otherwise.
- **Nulls per Key Field:** the rows, and per field the rows where it is empty. Per field: expected without empty values; for you to judge with some; look at this with some in a field that holds a role of the model type ([DEC-ED-22](../functional/15-eda.md#dec-ed-22)).
- **Volume over time:** per date it is set on, per period of the unit of the date (a day, or the week from a Monday of the period of an aggregate), the rows and, for an aggregate or a fact, the sum of the field that adds up. eda adds up the blocks of 7, 14, 21 and 28 days from a Monday, leaving out a block with a period without rows and the current, incomplete one, and gives per unit the average, the standard deviation, P25, the median, P75, the lowest and the highest. Look at this with a period without rows between the first and the last; expected otherwise ([DEC-ED-23](../functional/15-eda.md#dec-ed-23)).
- **Distribution of numbers:** per field the rows with a value, the lowest, P25, the median, P75, P95, the highest and the mean, by `APPROX_QUANTILES`; a round bin width of 1, 2, 5, 10, 20, 25, 50 or 100 times a power of ten such that about twelve bins reach P95, or the width and tail the User gave; and the rows per bin, the tail in one bin. Always for you to judge ([DEC-ED-24](../functional/15-eda.md#dec-ed-24)).

<a id="tr-ed-04"></a>
### TR-ED-04 · query runs an EDA-Probe as the User

**Status:** Specified · **Realises:** [FR-ED-06](../functional/15-eda.md#fr-ed-06), [DEC-ED-26](../functional/15-eda.md#dec-ed-26), [DEC-SR-32](../functional/04-stacks-and-resources.md#dec-sr-32)

query, the only service that reads data, gets `POST /resources/{id}/eda/runs` with `{ probe, sql, approve }` and the token of the User, from eda. It checks as for a query ([TR-SR-15](04-stacks-and-resources.md#tr-sr-15), [TR-SR-16](04-stacks-and-resources.md#tr-sr-16)) that the User holds `eda.use` and sees the Resource, that the SQL only reads its table, and what it reads in a dry run. Up to what the User's `runs.ranges` lets run freely it runs; up to what they may approve it runs with `approve`; otherwise it answers what the Pre-flight asks, and above the ranges it does not run: a Request for an EDA-Probe comes with [OP-ED-05](../functional/15-eda.md#op-ed-05). It runs as a job with a maximum on the bytes billed and the labels of the User and of an EDA run, keeps the run in the Query Log as a run of kind `eda`, apart from the queries of the panel of the User, as a Preview is, and answers at most 10,000 rows with the bytes read and the ID of the run.

<a id="tr-ed-05"></a>
### TR-ED-05 · catalogue makes a Resource Explored when eda says so

**Status:** Specified · **Realises:** [FR-ED-12](../functional/15-eda.md#fr-ed-12), [FR-MR-22](../functional/06-maturity-and-release.md#fr-mr-22), [DEC-MR-21](../functional/06-maturity-and-release.md#dec-mr-21)

When every needed EDA-Probe of an EDA is complete, eda sets it to `explored` and calls `POST /internal/resources/{id}/eda` of catalogue with `{ explored: true }`, with its Google ID token for catalogue's address, which catalogue checks against `DATAHUB_EDA_SERVICE_ACCOUNT`. catalogue keeps on the Resource that it is explored (a migration), so that a Resource at 3 · Confirmed becomes 4 · Explored and stays so whenever it recomputes the Level, and writes it in its Log (`RES-002`). `{ explored: false }`, when an EDA goes, takes it back to 3 · Confirmed with `MAT-021` and the Message of a Level that drops, cause `eda` ([MSG-RES-05](../functional/message-catalogue.md#msg-res-05)); in the first build no EDA goes.

<a id="tr-ed-06"></a>
### TR-ED-06 · The Permission eda.use, on for Admin only

**Status:** Specified · **Realises:** [FR-ED-01](../functional/15-eda.md#fr-ed-01), [DEC-PL-10](../functional/12-permissions-and-library-cards.md#dec-pl-10), [DEC-ED-25](../functional/15-eda.md#dec-ed-25)

*Built as the other Permissions: in the one catalogue ([TR-PL-03](12-permissions-and-library-cards.md#tr-pl-03)), carried by the Access Token ([TR-PL-05](12-permissions-and-library-cards.md#tr-pl-05)) and checked by every service ([TR-PL-06](12-permissions-and-library-cards.md#tr-pl-06)).*

`@datahub/contracts/permissions` gains `eda.use`, Explore Resources, in a part `eda` of its own after Lenses, without values: on in the starting group Admin, off in Business analyst and Lens user. identity's migration `0012-eda` sets it on in every Permission group that started as Admin and off in every other, as `0010-query-outside` did for `queries.outside` ([TR-SR-27](04-stacks-and-resources.md#tr-sr-27)). eda and query check it on every route; the web app shows the section EDA and Start the EDA only with it, and the Permission groups in Admin show it with its texts in English and Dutch.

<a id="tr-ed-07"></a>
### TR-ED-07 · The web app has the section EDA

**Status:** Specified · **Realises:** [FR-ED-02](../functional/15-eda.md#fr-ed-02), [FR-ED-03](../functional/15-eda.md#fr-ed-03), [FR-ED-04](../functional/15-eda.md#fr-ed-04), [FR-ED-06](../functional/15-eda.md#fr-ed-06), [FR-ED-07](../functional/15-eda.md#fr-ed-07), [FR-ED-08](../functional/15-eda.md#fr-ed-08), [FR-ED-09](../functional/15-eda.md#fr-ed-09), [FR-ED-10](../functional/15-eda.md#fr-ed-10), [FR-ED-11](../functional/15-eda.md#fr-ed-11), [DEC-UX-325](../../design/principles.md#dec-ux-325)

The web app calls eda at its address (`DATAHUB_EDA_URL`) with the Access Token of the User, as it calls the other services. The section EDA, after Charts in the rail with the binoculars icon, its panel, the page of an EDA with its tabs, the tab Steps and the detail of the four EDA-Probes follow the screens [eda](../../design/screens/eda.html), [eda-probe](../../design/screens/eda-probe.html), [eda-probe-nulls](../../design/screens/eda-probe-nulls.html), [eda-probe-volume](../../design/screens/eda-probe-volume.html) and [eda-probe-distribution](../../design/screens/eda-probe-distribution.html); the Maturity of a Resource gets Start the EDA and its progress, as in [resource-overview](../../design/screens/resource-overview.html). The drawings of the EDA-Probes and their charts are Svelte components of their own, not charts of semgraph ([DEC-UX-325](../../design/principles.md#dec-ux-325)); a drawing comes in once, again on Replay, and stands still for whoever asks for reduced motion. Every text is in English and in Dutch.

<a id="tr-ed-08"></a>
### TR-ED-08 · eda runs on Cloud Run, without access to data

**Status:** Specified · **Realises:** [DEC-ED-26](../functional/15-eda.md#dec-ed-26), [DEC-ED-03](../functional/15-eda.md#dec-ed-03)

eda is one of `local.services` in `infra/main.tf`, with its own service account that holds only the Cloud SQL client role, no role on BigQuery, and the addresses of query and catalogue (`DATAHUB_QUERY_URL`, `DATAHUB_CATALOGUE_URL`) and of identity (`DATAHUB_TOKEN_ISSUER`). catalogue gets the service account of eda (`DATAHUB_EDA_SERVICE_ACCOUNT`), and web the address of eda (`DATAHUB_EDA_URL`). A test in `infra/tests/` checks that eda holds no BigQuery role.

## Open points

None yet.
