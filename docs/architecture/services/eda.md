# eda

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/eda` |
| Schema | `eda` |
| Domains | [EDA](../../requirements/functional/15-eda.md) |

**In one sentence:** eda keeps the EDA of each Resource, its EDA-Probes, their runs, results and readings, writes the SQL of each EDA-Probe and of a dig into a selection and has query run it as the User, and tells catalogue when an EDA-Setup is complete; it reads no data itself ([DEC-ED-26](../../requirements/functional/15-eda.md#dec-ed-26)).

## Responsibilities

- The EDA of a Resource, started by a User with `eda.use`, In progress until its EDA-Setup is complete, then Explored: [FR-ED-01](../../requirements/functional/15-eda.md#fr-ed-01), [FR-ED-02](../../requirements/functional/15-eda.md#fr-ed-02), built as [TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01) and [TR-ED-06](../../requirements/technical/15-eda.md#tr-ed-06)
- The EDA-Probes per model type, which are needed, and when one is complete, from one catalogue in contracts: [FR-ED-05](../../requirements/functional/15-eda.md#fr-ed-05), built as [TR-ED-02](../../requirements/technical/15-eda.md#tr-ed-02)
- The SQL of an EDA-Probe, returning aggregates only, and its result with Data Hub's reading: [FR-ED-07](../../requirements/functional/15-eda.md#fr-ed-07) to [FR-ED-10](../../requirements/functional/15-eda.md#fr-ed-10), [FR-ED-17](../../requirements/functional/15-eda.md#fr-ed-17) and [FR-ED-18](../../requirements/functional/15-eda.md#fr-ed-18), built as [TR-ED-03](../../requirements/technical/15-eda.md#tr-ed-03)
- Running an EDA-Probe through query, as the User: [FR-ED-06](../../requirements/functional/15-eda.md#fr-ed-06), built as [TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)
- Digging into a selection of rows against the rest of the table, through query as the User, without keeping it: [FR-ED-20](../../requirements/functional/15-eda.md#fr-ed-20), built as [TR-ED-12](../../requirements/technical/15-eda.md#tr-ed-12)
- The readings of who works on the EDA: [FR-ED-11](../../requirements/functional/15-eda.md#fr-ed-11)
- Telling catalogue that an EDA-Setup is complete, which makes the Resource 4 · Explored: [FR-ED-12](../../requirements/functional/15-eda.md#fr-ed-12), built as [TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)

## How an EDA-Probe runs

1. eda asks catalogue, with the token of the User, for the Resource: whether the User sees it, its Level, model type, fields in the order of the Resource Card with their types, its Key Fields, the roles of its model type, its Grain, its mappings, the day of its Reliable Since when it has one, the full name of its table in its own case, its partition column and whether a filter on it is required ([TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01)).
2. It sets the EDA-Probe on the fields asked, or on those it applies to by default ([TR-ED-02](../../requirements/technical/15-eda.md#tr-ed-02)), in the order of the Resource Card, and checks its parameters. An EDA-Probe Data Hub does not run yet, one not offered for the model type, The Grain holds without recorded Grain fields, and Date range and Volume over time without the date of its role cannot run (422).
3. It writes one `SELECT` over the table, by its full name, that returns aggregates only ([TR-ED-03](../../requirements/technical/15-eda.md#tr-ed-03)). A table that requires a filter on its partition column gets one that keeps every partition, the one without a value among them, and names the column, so that the Pre-flight of query finds it: `(col is null or col >= <the lowest value of its type>)`.
4. query runs it as the User ([TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)). What its Pre-flight asks is passed on unchanged: to approve, or that it cannot run; nothing is added or kept then.
5. Once it ran, eda turns the answer into a result per subject, the table as a whole (`''`) or a field, with Data Hub's reading, adds the EDA-Probe if it is not yet, sets it on what it ran with, and keeps the run with who ran it, when, the bytes it read and its Query ID, in one transaction.
6. It computes the EDA again from the contracts, with the fields each EDA-Probe last ran on. When every needed EDA-Probe is complete, an EDA in progress becomes Explored and catalogue is told, until it heard it ([TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)). An EDA-Probe Data Hub cannot run yet still counts as needed, so in the first build no EDA becomes Explored ([OP-ED-09](../../requirements/functional/15-eda.md#op-ed-09)).

## On a selection of rows

Every EDA-Probe runs on a selection of rows ([OP-ED-12](../../requirements/functional/15-eda.md#op-ed-12)): the whole table, or the rows where every condition holds, so that what a result found can be looked into further. A condition is `empty`, `saysNothing`, `equals` or `range`. `empty` holds where the field has no value, whatever its kind: `` `field` is null ``. `saysNothing` holds where the field has no value or, by its kind, a value of the lists of the Disguised nulls of the EDA, Data Hub's proposal until it is added with its own ([DEC-ED-35](../../requirements/functional/15-eda.md#dec-ed-35)): a text trimmed and in lower case, the empty text always among them; a date on its day in Brussels; a number of the list or of nines only; never zero. `equals` takes a text, a number, a day or true or false, of the kind of its field; `range` takes numbers or days, `from` inclusive and `before` exclusive. One place in `src/probes/sql.ts` writes the conditions, and `whereOf` puts them beside the filter that keeps every partition, so that each EDA-Probe writes the same SQL as on the whole table, on fewer rows. The conditions come from the User: eda checks them against the Resource first, at most 10, each on a field of it with values of its kind, `empty` and `saysNothing` on a field of any kind (400 otherwise), and writes every value through a literal of its kind that refuses anything else, a text escaped as a quoted string of BigQuery. A run on a selection is kept with it, but it neither adds its EDA-Probe nor changes what it is set on, is never its last run and does not count for complete. Every `RunView` says what it ran on, `{ where: [] }` for the whole table.

## Dig into a selection

A dig sets a selection of rows against the other rows of the table, to find what the selected rows have in common ([FR-ED-20](../../requirements/functional/15-eda.md#fr-ed-20), [DEC-ED-36](../../requirements/functional/15-eda.md#dec-ed-36), [TR-ED-12](../../requirements/technical/15-eda.md#tr-ed-12)); its code is `src/dig.ts`. It is reached as a run is: `eda.use`, the Resource as the User sees it and an EDA on it (404 otherwise). Its selection is parsed and checked as for a run, and must hold at least one condition, as the whole table has no rest (400 otherwise); `saysNothing` takes the lists of the Disguised nulls of the EDA.

eda writes one `SELECT` of aggregates only, which query runs as the User as any EDA-Probe, with `probe: 'digInto'` ([TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04)): the same Pre-flight, a run of the kind `eda` in the Query Log in the one query of the User and Resource, labelled `datahub-eda-probe: diginto`. Unlike an EDA-Probe on a selection, the selection is no filter here. One scan keeps every partition with the same filter as the EDA-Probes (`whereOf`), flags each row once as selected, `coalesce(<the conditions joined by and>, false)`, so that a row where a condition has no value falls in the rest, and counts each row once in each part, through an array of structs it unnests. The answer is a row per part and field:

| Part | What the SQL counts | What eda reads from it |
| --- | --- | --- |
| `rows` | The rows selected and the rest | The rows selected, and all rows |
| `period` | Per period of the date the role of the model type names, in the unit Volume over time takes for it (a day in Brussels, or the week from a Monday for the `period` of an aggregate), its rows selected and the rest, as JSON | The share of the selection per period with rows, and the break: of every split with at least 2 periods on each side, the one where the mean shares before and after differ most; its first period after is the break when one is at least twice the other and the difference is beyond chance at a margin of 95%, with whether the selection was more or less of the rows before it. None without such a date |
| `text` | Per other Key Field that is a text, per value, no value among them, its rows selected and the rest; the 50 values with the most selected rows, as JSON | Per field at most 5 values with a selected row: how many times more often each is among the selected rows than among the rest, by share (none when the rest holds none of it), and whether that is beyond chance, a test of two shares with the pooled share at a margin of 95% (\|z\| ≥ 1.96, [DEC-ED-14](../../requirements/functional/15-eda.md#dec-ed-14)); the real ones first, then by ratio, highest first, a value only in the selection before all |
| `number` | Per other Key Field that is a number, the median (`approx_quantiles(…, 2)`) and the mean among the selected rows and among the rest | Its middle in both |

The other Key Fields are those of the Resource that no condition of the selection is on, in the order of the Resource Card; a Key Field of another kind is left out. What the Pre-flight asks is passed on as a `DigAnswer`, as for a run. A dig is not kept: eda writes nothing to its schema and changes nothing of the EDA, and logs only that it ran, with the Query ID of its run in the Query Log. The page runs it again when it opens.

## The SQL of each EDA-Probe

Each EDA-Probe is a module of its own in `src/probes`, with the SQL it writes and how it reads the answer. Every value of the answer is read as BigQuery writes it, as text.

| EDA-Probe | SQL | Result and Data Hub's reading |
| --- | --- | --- |
| The Grain holds ([FR-ED-07](../../requirements/functional/15-eda.md#fr-ed-07)) | One scan, grouped by the Grain fields: the rows, the rows with an empty Grain field, how many Grain values are on 1, 2, 3, or 4 rows and more, the rows they cover, and the 5 on the most rows above one, as JSON | For the table as a whole: expected when no Grain value is on more than one row and none is empty, look at this otherwise |
| Date range ([FR-ED-18](../../requirements/functional/15-eda.md#fr-ed-18)) | One scan, one row: per date its first and last day, `format_date('%F', min(…))` and `max(…)`; a moment falls on its day in Brussels | Per date, in eda, with today in Brussels: its unit as Volume over time decides it, the periods from the first to the last, both counted, the current period, how many periods the last is behind it (0 for the current one or a later one), and how many lie wholly before the day of the Reliable Since of the Resource Card (none from its first row). Expected when the last is the current period or the one before, look at this further behind or without any value ([DEC-ED-34](../../requirements/functional/15-eda.md#dec-ed-34)) |
| Nulls per Key Field ([FR-ED-08](../../requirements/functional/15-eda.md#fr-ed-08)) | One scan: the rows, and per field the rows where it is empty | Per field: expected without empty values, for you to judge with some, look at this with some in a field that holds a role ([DEC-ED-22](../../requirements/functional/15-eda.md#dec-ed-22)) |
| Volume over time ([FR-ED-09](../../requirements/functional/15-eda.md#fr-ed-09)) | One scan, each date beside the others: per date and period the rows and, for an aggregate or a fact, the sum of the field that adds up (`addsUp`, or `measure` for a fact). A period is a day, or the week from a Monday for the `period` of an aggregate; a moment falls on its day in Brussels | Per date, in eda: every period from the first to the last, the empty ones, the current one, and per unit, 7, 14, 21 and 28 days from a Monday and a day for a daily unit, the average, the standard deviation of a sample, P25, the median, P75, the lowest and the highest, leaving out a block with an empty period and the current, incomplete one. Look at this with an empty period, expected otherwise ([DEC-ED-23](../../requirements/functional/15-eda.md#dec-ed-23)) |
| Distribution of numbers ([FR-ED-10](../../requirements/functional/15-eda.md#fr-ed-10)) | Two passes, each field beside the others: the quantiles by `APPROX_QUANTILES`, a round width of 1, 2, 2.5 or 5 times a power of ten for about twelve bins up to P95 and the tail from there, or the width and tail the User gave; then the rows per bin and in the tail | Per field, always for you to judge ([DEC-ED-24](../../requirements/functional/15-eda.md#dec-ed-24)) |
| Distribution of categories ([FR-ED-17](../../requirements/functional/15-eda.md#fr-ed-17)) | One scan, each field beside the others: the weight of each value, an empty one among them, the sum of the number it is weighed by or its rows; then per field, its values ranked by weight: the total, the number of values, the weight of the empty values, the number and weight of the values after the 10 heaviest, how many weigh less than 0.1% of the total, and the 10 heaviest with their weight, as JSON | Per field, each value with its share of the total, empty values included; always for you to judge ([DEC-ED-33](../../requirements/functional/15-eda.md#dec-ed-33)). The values are values of the data, as the examples of The Grain holds |

Parameters: The Grain holds, Date range and Nulls per Key Field have none. Volume over time takes `measure`, the field that adds up, or `null` for rows only, and `mayBeEmpty: 'weekends'` for a count per day. Distribution of numbers takes `width` and `tailFrom`, a number for every field or one per field. Distribution of categories takes `weighedBy`, the number that adds up (`addsUp`, or `measure` for a fact; never a unique count), or `null` for rows; without it, an aggregate or a fact is weighed by the field that adds up as Volume over time takes it, any other model type by rows.

## API

Every route needs the Access Token of a User with `eda.use` and answers 403 without it ([TR-ED-06](../../requirements/technical/15-eda.md#tr-ed-06)); a Resource the User does not see is not found. When catalogue or query does not answer, eda answers 503.

| Endpoint | Purpose |
| --- | --- |
| `GET /edas` | The EDAs of the Resources the User sees, each with its Resource, Collection, status and needed EDA-Probes complete, as last computed; and, as `ready`, the Resources at 3 · Confirmed or above without one, from the Collections catalogue lists for the User ([FR-ED-03](../../requirements/functional/15-eda.md#fr-ed-03)) |
| `POST /resources/{id}/eda` | Starts the EDA of a Resource at 3 · Confirmed or above: 201 with the EDA, 409 when it has one, 422 below 3 ([FR-ED-02](../../requirements/functional/15-eda.md#fr-ed-02)) |
| `GET /resources/{id}/eda` | The EDA as the tab Steps and the Maturity of the Resource show it, `EdaView` of the contracts; 404 without an EDA ([FR-ED-04](../../requirements/functional/15-eda.md#fr-ed-04)) |
| `POST /resources/{id}/eda/probes/{probe}/runs` | With `{ fields?, params?, selection?, approve? }`: adds the EDA-Probe if it is not yet and runs it through query; `{ state: 'ran', eda }`, or what the Pre-flight asks, `{ state: 'approve', bytes }` or `{ state: 'refused', bytes, reason }` ([FR-ED-06](../../requirements/functional/15-eda.md#fr-ed-06)). With a `selection`, `{ where: [...] }` of at most 10 conditions, it runs on those rows only and adds nothing: `{ state: 'ran', eda, run }`, the EDA as it was and the run with its `selection` ([OP-ED-12](../../requirements/functional/15-eda.md#op-ed-12)) |
| `POST /resources/{id}/eda/dig` | With `{ selection, approve? }`, a selection of at least one condition: digs into it against the rest of the table through query, `{ state: 'ran', selection, result, ranAt, bytes }`, or what the Pre-flight asks, `DigAnswer` of the contracts; 400 for a selection that does not fit or holds no condition, 404 without an EDA. Nothing is kept ([TR-ED-12](../../requirements/technical/15-eda.md#tr-ed-12)) |
| `PUT /resources/{id}/eda/probes/{probe}/readings` | With `{ subject, reading }`, `expected`, `known` or `problem`: the reading of a result of its last run, in place of an earlier one; the EDA as it is after ([FR-ED-11](../../requirements/functional/15-eda.md#fr-ed-11)) |

## Data

The schema `eda` ([TR-ED-01](../../requirements/technical/15-eda.md#tr-ed-01)), migrations `0001-edas` and `0002-selection`:

- `edas`: one per Resource; its status, who started it and when, when it became Explored, when catalogue heard it (`told_at`), and the needed EDA-Probes and how many are complete as last computed, for the panel.
- `eda_probes`: per EDA and EDA-Probe, the fields and parameters it is set on, who added it and when.
- `eda_runs`: per run, the fields and parameters it ran with, the selection of rows it ran on (`{"where":[]}` for the whole table, the default), who ran it and when, the bytes it read and its Query ID in the Query Log of query. The last run of an EDA-Probe is its last on the whole table ([OP-ED-12](../../requirements/functional/15-eda.md#op-ed-12)).
- `eda_results`: per run and subject, its numbers as JSON and Data Hub's reading.
- `eda_readings`: per EDA, EDA-Probe and subject, the reading of who works on the EDA, with who gave it and when.

Results hold aggregates only, never rows of a table. A dig is kept nowhere in it ([TR-ED-12](../../requirements/technical/15-eda.md#tr-ed-12)).

## Talks to

catalogue (`DATAHUB_CATALOGUE_URL`), with the token of the User, for a Resource as the User sees it (`GET /resources/{id}`), the name of its Collection (`GET /collections/{id}`) and the Collections they see (`GET /collections`); and with its Google ID token for catalogue's address when an EDA-Setup is complete (`POST /internal/resources/{id}/eda` with `{ explored: true }`), again until catalogue heard it and whenever catalogue says the Resource is not explored ([TR-ED-05](../../requirements/technical/15-eda.md#tr-ed-05)); query (`DATAHUB_QUERY_URL`), with the token of the User, to run an EDA-Probe or a dig (`POST /resources/{id}/eda/runs`, with `probe: 'digInto'` for a dig, [TR-ED-04](../../requirements/technical/15-eda.md#tr-ed-04), [TR-ED-12](../../requirements/technical/15-eda.md#tr-ed-12)); identity (`DATAHUB_TOKEN_ISSUER`) for the public keys of the tokens.

## Permissions

The Cloud SQL client role and its login to Postgres, as every service with a database. No role on BigQuery: query reads the data ([TR-ED-08](../../requirements/technical/15-eda.md#tr-ed-08)).
