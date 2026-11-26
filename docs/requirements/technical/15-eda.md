<!--
IDs: TR-ED-NN. Every TR links what it realises.
-->

# EDA: technical requirements

| | |
| --- | --- |
| Realises | [EDA](../functional/15-eda.md) |
| Status | First build implemented ([DEC-ED-26](../functional/15-eda.md#dec-ed-26)) |
| Source of truth | This file |

## Requirements

<a id="tr-ed-01"></a>
### TR-ED-01 · A service eda keeps the EDAs in its own schema

**Status:** Implemented · **Realises:** [DEC-ED-26](../functional/15-eda.md#dec-ed-26), [FR-ED-02](../functional/15-eda.md#fr-ed-02), [FR-ED-06](../functional/15-eda.md#fr-ed-06), [FR-ED-11](../functional/15-eda.md#fr-ed-11)

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
| `POST /resources/{id}/eda/probes/{probe}/runs` | Adds an EDA-Probe if it is not yet, with its fields and parameters, and runs it through query ([TR-ED-04](#tr-ed-04)); without fields or parameters, an EDA-Probe added runs again as it is set; answers the EDA as `GET`, or what the Pre-flight asks: to approve, or that it cannot run |
| `PUT /resources/{id}/eda/probes/{probe}/readings` | The reading of a subject: `{ subject, reading }` ([FR-ED-11](../functional/15-eda.md#fr-ed-11)) |

For a Resource, eda asks catalogue with the token of the User whether the User sees it, and its Level, model type, fields with their types, Key Fields, the roles of its model type, its Grain fields, and the partition column of its table.

<a id="tr-ed-02"></a>
### TR-ED-02 · One catalogue of EDA-Probes, shared

**Status:** Implemented · **Realises:** [FR-ED-05](../functional/15-eda.md#fr-ed-05), [DEC-ED-11](../functional/15-eda.md#dec-ed-11), [DEC-ED-12](../functional/15-eda.md#dec-ed-12), [DEC-ED-17](../functional/15-eda.md#dec-ed-17)

`@datahub/contracts/eda` holds the EDA-Probes of [the table](../functional/15-eda.md#eda-steps-and-eda-probes) for eda and the web app alike: per EDA-Probe its key, name, EDA-Step, place on the table (the rows, one column, two columns together, another Resource), its level per model type (`must`, `should`, `could`, or not offered) and whether Data Hub runs it yet. It also holds what an EDA-Probe applies to on a Resource, the fields a needed one must be set on to be complete, and the shapes of the answers of eda. In the first build Data Hub runs `grainHolds`, `nullsPerKeyField`, `volumeOverTime` and `distributionOfNumbers`; every other EDA-Probe is listed as coming and, needed, still counts ([OP-ED-09](../functional/15-eda.md#op-ed-09)).

A needed EDA-Probe is complete once a run of it covers what it applies to ([DEC-ED-21](../functional/15-eda.md#dec-ed-21)):

| EDA-Probe | Applies to |
| --- | --- |
| The Grain holds | The table, through its Grain fields; without recorded Grain fields it cannot run |
| Nulls per Key Field | Every Key Field |
| Volume over time, with empty periods | The date its role names: when it happened, when it occurred, created at or as of when, the period of an aggregate |
| Distribution of numbers | The numbers among the Key Fields |

<a id="tr-ed-03"></a>
### TR-ED-03 · eda writes the SQL of an EDA-Probe, which returns aggregates only

**Status:** Implemented · **Realises:** [FR-ED-07](../functional/15-eda.md#fr-ed-07), [FR-ED-08](../functional/15-eda.md#fr-ed-08), [FR-ED-09](../functional/15-eda.md#fr-ed-09), [FR-ED-10](../functional/15-eda.md#fr-ed-10)

Per EDA-Probe that Data Hub runs, eda writes one `SELECT` over the table of the Resource, by its full name, from the fields it is set on, that returns aggregates only, never rows of the table; a table that requires a filter on its partition column gets one that keeps every partition. eda then turns the answer into the result per subject and Data Hub's reading, so that the numbers in the web app are those kept.

- **The Grain holds:** the rows; the Grain values; per number of rows a Grain value is on, 1, 2, 3 or 4 and more, how many Grain values; the rows with an empty Grain field; and the 5 Grain values on the most rows, above one. Expected when none is on more than one row and none is empty; look at this otherwise.
- **Nulls per Key Field:** the rows, and per field the rows where it is empty. Per field: expected without empty values; for you to judge with some; look at this with some in a field that holds a role of the model type ([DEC-ED-22](../functional/15-eda.md#dec-ed-22)).
- **Volume over time:** per date it is set on, per period of the unit of the date (a day, or the week from a Monday of the period of an aggregate), the rows and, for an aggregate or a fact, the sum of the field that adds up. eda adds up the blocks of 7, 14, 21 and 28 days from a Monday, leaving out a block with a period without rows and the current, incomplete one, and gives per unit the average, the standard deviation, P25, the median, P75, the lowest and the highest. Look at this with a period without rows between the first and the last; expected otherwise ([DEC-ED-23](../functional/15-eda.md#dec-ed-23)).
- **Distribution of numbers:** per field the rows with a value, the lowest, P25, the median, P75, P95, the highest and the mean, by `APPROX_QUANTILES`; a round bin width of 1, 2, 5, 10, 20, 25, 50 or 100 times a power of ten such that about twelve bins reach P95, or the width and tail the User gave; and the rows per bin, the tail in one bin. Always for you to judge ([DEC-ED-24](../functional/15-eda.md#dec-ed-24)).
- **Distribution of categories:** per field, the weight of each value, the sum of the number it weighs by or the rows, its 10 heaviest values, the number of values, the weight and number of the rest, the weight of the empty values, and how many values weigh less than 0.1% each; values of a field reach Claude only as results do ([TR-ED-10](#tr-ed-10)). Always for you to judge ([DEC-ED-33](../functional/15-eda.md#dec-ed-33)).
- **Date range:** per date, its first and last value; eda adds, in the time zone of Immoscoop, the periods between, the current period, how many periods the last is behind it, and, from the Resource Card, how many lie before its Reliable Since. Expected when the last is the current period or the one before; look at this otherwise ([DEC-ED-34](../functional/15-eda.md#dec-ed-34)).

<a id="tr-ed-04"></a>
### TR-ED-04 · query runs an EDA-Probe as the User

**Status:** Implemented · **Realises:** [FR-ED-06](../functional/15-eda.md#fr-ed-06), [DEC-ED-26](../functional/15-eda.md#dec-ed-26), [DEC-SR-32](../functional/04-stacks-and-resources.md#dec-sr-32)

query, the only service that reads data, gets `POST /resources/{id}/eda/runs` with `{ probe, sql, approve }` and the token of the User, from eda. It checks as for a query ([TR-SR-15](04-stacks-and-resources.md#tr-sr-15), [TR-SR-16](04-stacks-and-resources.md#tr-sr-16)) that the User holds `eda.use` and sees the Resource, that the SQL only reads its table, and what it reads in a dry run. Up to what the User's `runs.ranges` lets run freely it runs; up to what they may approve it runs with `approve`; otherwise it answers what the Pre-flight asks, and above the ranges it does not run, unless the User approves any run themselves ([DEC-PL-12](../functional/12-permissions-and-library-cards.md#dec-pl-12)): then it runs with `approve`, billed at most a tenth above what it reads; a Request for an EDA-Probe comes with [OP-ED-05](../functional/15-eda.md#op-ed-05). It runs as a job with a maximum on the bytes billed and the labels of the User and of an EDA run, keeps the run in the Query Log as a run of kind `eda`, one such query per User and Resource, apart from the queries of the panel of the User and of the History of the Resource, and never run as a query itself, and answers at most 10,000 rows with the bytes read and the ID of the run.

<a id="tr-ed-05"></a>
### TR-ED-05 · catalogue makes a Resource Explored when eda says so

**Status:** Implemented · **Realises:** [FR-ED-12](../functional/15-eda.md#fr-ed-12), [FR-MR-22](../functional/06-maturity-and-release.md#fr-mr-22), [DEC-MR-21](../functional/06-maturity-and-release.md#dec-mr-21)

When every needed EDA-Probe of an EDA is complete, eda sets it to `explored` and calls `POST /internal/resources/{id}/eda` of catalogue with `{ explored: true }`, with its Google ID token for catalogue's address, which catalogue checks against `DATAHUB_EDA_SERVICE_ACCOUNT`. catalogue keeps on the Resource that it is explored (a migration), so that a Resource at 3 · Confirmed becomes 4 · Explored and stays so whenever it recomputes the Level, and writes it in its Log (`RES-002`). `{ explored: false }`, when an EDA goes, takes it back to 3 · Confirmed with `MAT-021` and the Message of a Level that drops, cause `eda` ([MSG-RES-05](../functional/message-catalogue.md#msg-res-05)); in the first build no EDA goes.

<a id="tr-ed-06"></a>
### TR-ED-06 · The Permission eda.use, on for Admin only

**Status:** Implemented · **Realises:** [FR-ED-01](../functional/15-eda.md#fr-ed-01), [DEC-PL-10](../functional/12-permissions-and-library-cards.md#dec-pl-10), [DEC-ED-25](../functional/15-eda.md#dec-ed-25)

*Built as the other Permissions: in the one catalogue ([TR-PL-03](12-permissions-and-library-cards.md#tr-pl-03)), carried by the Access Token ([TR-PL-05](12-permissions-and-library-cards.md#tr-pl-05)) and checked by every service ([TR-PL-06](12-permissions-and-library-cards.md#tr-pl-06)).*

`@datahub/contracts/permissions` gains `eda.use`, Explore Resources, in a part `eda` of its own after Lenses, without values: on in the starting group Admin, off in Business analyst and Lens user. identity's migration `0012-eda` sets it on in every Permission group that started as Admin and off in every other, as `0010-query-outside` did for `queries.outside` ([TR-SR-27](04-stacks-and-resources.md#tr-sr-27)). eda and query check it on every route; the web app shows the section EDA and Start the EDA only with it, and the Permission groups in Admin show it with its texts in English and Dutch.

<a id="tr-ed-07"></a>
### TR-ED-07 · The web app has the section EDA

**Status:** Implemented · **Realises:** [FR-ED-02](../functional/15-eda.md#fr-ed-02), [FR-ED-03](../functional/15-eda.md#fr-ed-03), [FR-ED-04](../functional/15-eda.md#fr-ed-04), [FR-ED-06](../functional/15-eda.md#fr-ed-06), [FR-ED-07](../functional/15-eda.md#fr-ed-07), [FR-ED-08](../functional/15-eda.md#fr-ed-08), [FR-ED-09](../functional/15-eda.md#fr-ed-09), [FR-ED-10](../functional/15-eda.md#fr-ed-10), [FR-ED-11](../functional/15-eda.md#fr-ed-11), [DEC-UX-325](../../design/principles.md#dec-ux-325)

The web app calls eda at its address (`DATAHUB_EDA_URL`) with the Access Token of the User, as it calls the other services. The section EDA, after Charts in the rail with the binoculars icon, its panel, the page of an EDA with its tabs, the tab Steps and the detail of the four EDA-Probes follow the screens [eda](../../design/screens/eda.html), [eda-probe](../../design/screens/eda-probe.html), [eda-probe-nulls](../../design/screens/eda-probe-nulls.html), [eda-probe-volume](../../design/screens/eda-probe-volume.html) and [eda-probe-distribution](../../design/screens/eda-probe-distribution.html); the Maturity of a Resource gets Start the EDA and its progress, as in [resource-overview](../../design/screens/resource-overview.html). The drawings of the EDA-Probes and their charts are Svelte components of their own, not charts of semgraph ([DEC-UX-325](../../design/principles.md#dec-ux-325)); a drawing comes in once, again on Replay, and stands still for whoever asks for reduced motion. Every text is in English and in Dutch.

<a id="tr-ed-08"></a>
### TR-ED-08 · eda runs on Cloud Run, without access to data

**Status:** Implemented · **Realises:** [DEC-ED-26](../functional/15-eda.md#dec-ed-26), [DEC-ED-03](../functional/15-eda.md#dec-ed-03)

eda is one of `local.services` in `infra/main.tf`, with its own service account that holds only what every service with a database holds, the Cloud SQL client role and its login to Postgres, and no role on BigQuery, and the addresses of query and catalogue (`DATAHUB_QUERY_URL`, `DATAHUB_CATALOGUE_URL`) and of identity (`DATAHUB_TOKEN_ISSUER`). catalogue gets the service account of eda (`DATAHUB_EDA_SERVICE_ACCOUNT`), and web the address of eda (`DATAHUB_EDA_URL`). A test in `infra/tests/` checks that eda holds no BigQuery role.

<a id="tr-ed-09"></a>
### TR-ED-09 · The web app has the list to add an EDA-Probe and the guide of an EDA

**Status:** Implemented · **Realises:** [FR-ED-04](../functional/15-eda.md#fr-ed-04), [FR-ED-13](../functional/15-eda.md#fr-ed-13), [FR-ED-14](../functional/15-eda.md#fr-ed-14), [DEC-UX-327](../../design/principles.md#dec-ux-327), [DEC-UX-328](../../design/principles.md#dec-ux-328)

The list to add an EDA-Probe is a sheet of the web app, as [eda](../../design/screens/eda.html) with `?list=open` draws it, read from `GET /resources/{id}/eda` and the catalogue of EDA-Probes in `@datahub/contracts/eda` ([TR-ED-02](#tr-ed-02)): what an EDA-Probe asks of a Resource is a text of the app per EDA-Probe, with the names of its fields filled in. The guide is a second flow of the one Flow Box component (`packages/ui`, `FlowBox.svelte`), beside the flow of publishing: the app keeps which flow is open, of which object, and whether it is minimized, nothing of it stored ([DEC-UX-306](../../design/principles.md#dec-ux-306)); one Flow Box at a time. Its steps are read from the EDA each time it changes; the step to do now is `next` of the EDA. On the tab Steps of its EDA the app shows it folded, as long as the User has not opened it there; elsewhere it shows it as the User left it. Every text is in English and in Dutch.

<a id="tr-ed-10"></a>
### TR-ED-10 · The MCP server reads and runs the EDA

**Status:** Implemented · **Realises:** [FR-ED-15](../functional/15-eda.md#fr-ed-15), [FR-ED-16](../functional/15-eda.md#fr-ed-16), [DEC-ED-29](../functional/15-eda.md#dec-ed-29), [DEC-UX-329](../../design/principles.md#dec-ux-329)

mcp calls eda at its address (`DATAHUB_EDA_URL`) with the token of the User, as it calls the other services, and lists the EDA tools only for a User with `eda.use`. `get_eda` answers the EDA of a Resource in words for Claude; `show_eda` shows it in the MCP App, a kind of its own in its one page, or, with `probe`, the last result of one EDA-Probe with the buttons of the User's reading, without running it; `run_eda_probe` runs an EDA-Probe through `POST /resources/{id}/eda/probes/{probe}/runs`, on its own fields and parameters unless others are given, and shows its result, or, when the Pre-flight asks for approval, a frame in which the User approves it, which runs it with `approve` through `run_eda_probe_approved`, a tool only the frame calls, as `run_query_approved` is. The reading of the User is given from the frame, through `PUT …/readings`, by `give_eda_reading`, a tool only the frame calls. The sentences of a result are made once by mcp, for Claude and the frame alike; examples of Grain values, which are values of the data, reach Claude only when the Permission group of the User lets results reach Claude. Infrastructure gives mcp `DATAHUB_EDA_URL`.

<a id="tr-ed-11"></a>
### TR-ED-11 · Every EDA-Probe runs on a selection of rows

**Status:** Implemented · **Realises:** [TR-ED-03](#tr-ed-03) · **Refs:** [OP-ED-12](../functional/15-eda.md#op-ed-12), [DEC-ED-35](../functional/15-eda.md#dec-ed-35)

A run takes a `selection`, `{ where: [conditions] }`: the whole table when it holds none, else the rows where every condition holds. A condition is `saysNothing` (no value, or a value of the lists of Disguised nulls of the EDA), `equals` or `range` (`from` inclusive, `before` exclusive). eda checks the conditions against the Resource before it writes any SQL (at most 10, each on a field of it, with values of the kind of that field; 400 otherwise), and writes every value through a literal of its kind that refuses anything else. One place writes the conditions, beside the filter that keeps every partition, so that each EDA-Probe writes the same SQL on fewer rows, and on the whole table exactly the SQL it wrote before. A run on a selection is kept with its selection, comes back as `run` beside the unchanged EDA, and neither adds its EDA-Probe, changes its setting, becomes its last run nor counts for complete. Every `RunView` says what it ran on. The web app shows a result through one component that takes the run and its selection, so that a result on a selection is shown as a result on the whole table is, with the selection named above it.

<a id="tr-ed-12"></a>
### TR-ED-12 · eda digs into a selection against the rest

**Status:** Implemented · **Realises:** [FR-ED-20](../functional/15-eda.md#fr-ed-20), [DEC-ED-36](../functional/15-eda.md#dec-ed-36) · **Refs:** [TR-ED-11](#tr-ed-11)

`POST /resources/{id}/eda/dig` takes a `selection` of at least one condition, checked as in [TR-ED-11](#tr-ed-11), and `approve`, and answers a `DigAnswer`: what it found, or what the Pre-flight asks, as a run of an EDA-Probe does. A condition can also be `empty`: the field holds no value. eda writes one `SELECT` of aggregates only: the rows selected and all rows; per period of the date the role of the model type names, in the unit Volume over time takes for it, the rows selected and all rows; per other Key Field that is a text, per value the rows selected and the rest, of which it keeps the values that differ most; per other Key Field that is a number, its median and mean among the selected rows and the rest. query runs it as the User as an EDA-Probe (`digInto`, TR-ED-04), so it reaches the Query Log as kind `eda`. Whether a difference could be chance is a test of two shares at a margin of 95%. The break over time is the period that splits the shares into a before and an after that differ the most, when one is at least twice the other and the difference is beyond chance at that margin, as in the drawn example of 36% of the rows before and 2% after. A dig is not kept: it changes nothing of the EDA, and the page runs it again when it opens.

## Open points

None yet.
