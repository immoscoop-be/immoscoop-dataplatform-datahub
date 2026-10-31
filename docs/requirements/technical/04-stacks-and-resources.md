# Resources: technical requirements

| | |
| --- | --- |
| Realises | [Resources](../functional/04-stacks-and-resources.md) |
| Status | Registration through exposures, with the fields, Level, Fingerprint and Message of a new Resource, Resources in Collections and their Log, the Changes upstream and Broken queries implemented; Publication and reading the data follow |
| Source of truth | This file |

How the tables under the exposures of the dbt projects become Resources, in the service [catalogue](../../architecture/services/catalogue.md), from what [registry](../../architecture/services/registry.md) hands over ([TR-AR-08](01-artifact-registry.md#tr-ar-08)).

## Requirements

<a id="tr-sr-01"></a>
### TR-SR-01 · catalogue takes the exposed tables from registry only

**Status:** Implemented · **Realises:** [TR-PF-05](00-platform.md#tr-pf-05), [DEC-PF-26](00-platform.md#dec-pf-26), [NFR-SEC-01](../non-functional/security.md#nfr-sec-01)

`POST /internal/resources` takes no Access Token of a User: no User starts it. It takes a Google ID token instead, and accepts it only when Google signed it, it was issued for catalogue's own address, and it belongs to the service account of registry, with a verified address. Any other call is answered `401`, without looking at what it carries.

<a id="tr-sr-02"></a>
### TR-SR-02 · Resources live in the schema of catalogue

**Status:** Implemented · **Realises:** [FR-SR-04](../functional/04-stacks-and-resources.md#fr-sr-04), [FR-SR-05](../functional/04-stacks-and-resources.md#fr-sr-05), [FR-SR-06](../functional/04-stacks-and-resources.md#fr-sr-06), [FR-SR-33](../functional/04-stacks-and-resources.md#fr-sr-33), [FR-CO-07](../functional/03-collections.md#fr-co-07), [DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44)

The table `resources` holds one row per Resource: a UUID as its ID; the Key, unique, as registry writes a `relation`; the full name of the table in its own case, which registry sends with it, or empty for a Resource registered before it did, which then takes its Key ([DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44)); the dbt project, its unique ID and the name and kind of its Node; the Display Name; the description; the names of the exposures that make it a Resource; its Collection, if any; its Level ([TR-SR-07](#tr-sr-07)); and when it was registered, last changed and withdrawn.

- One Collection at most: the Resource holds the ID of its Collection.
- The Display Name is unique, whatever its case, among the Resources that are not withdrawn. When the label or Node name is taken, the name of the dbt project follows in brackets, and if that is taken too, the Key.
- The description is a copy of the Artifacts, refreshed by every call; it is never typed in Data Hub.
- `resource_syncs` keeps per dbt project the run of the last call that was applied. A call for an older run, from a run processed again, changes nothing.

*Note of 2026-10-28: the Resources started afresh for the rebuild ([DEC-DH-76](../../overview/data-hub.md#dec-dh-76)): migration `0004-resources-afresh` dropped those registered before, with their Log, and made these tables anew. The next run of each dbt project, or processing it again ([TR-AR-07](01-artifact-registry.md#tr-ar-07)), registers every exposed table anew, with its fields, Level, Fingerprint and Message. The Collections stayed.*

<a id="tr-sr-03"></a>
### TR-SR-03 · Every call registers, renames, withdraws and brings back

**Status:** Implemented · **Realises:** [FR-SR-32](../functional/04-stacks-and-resources.md#fr-sr-32), [FR-SR-33](../functional/04-stacks-and-resources.md#fr-sr-33), [FR-SR-34](../functional/04-stacks-and-resources.md#fr-sr-34), [FR-SR-14](../functional/04-stacks-and-resources.md#fr-sr-14), [DEC-SR-26](../functional/04-stacks-and-resources.md#dec-sr-26)

A call carries every exposed table of one dbt project. In one transaction, catalogue:

- registers a table it does not know yet, without Collection: with its fields ([TR-SR-06](#tr-sr-06)), its Level ([TR-SR-07](#tr-sr-07)) and its Fingerprint ([TR-SR-08](#tr-sr-08)); writes `RES-001` and `RES-002`; and places the Message for the Data Team on it ([TR-SR-09](#tr-sr-09));
- brings back a withdrawn Resource whose table is exposed again, as it was, with its Collection, and writes `RES-006`;
- renames a Resource whose Display Name changed, and writes `RES-003`;
- refreshes the description, the Node, the exposures and the fields of every other Resource, without a Log Entry;
- withdraws every Resource of that dbt project whose table is no longer in the call, and writes `RES-004`.

The table `resource_log` holds the Log of the Resources, append-only like the Log of the Collections ([TR-CO-04](03-collections.md#tr-co-04)): a trigger refuses every update and delete. The actor of these entries is Data Hub itself.

<a id="tr-sr-04"></a>
### TR-SR-04 · The Data Team adds Resources to Collections and removes them

**Status:** Implemented · **Realises:** [FR-CO-07](../functional/03-collections.md#fr-co-07), [FR-CO-08](../functional/03-collections.md#fr-co-08), [FR-CO-11](../functional/03-collections.md#fr-co-11), [FR-CO-14](../functional/03-collections.md#fr-co-14), [FR-CO-31](../functional/03-collections.md#fr-co-31), [DEC-SR-27](../functional/04-stacks-and-resources.md#dec-sr-27), [DEC-CV-11](../functional/14-conversations.md#dec-cv-11)

`POST /collections/{id}/resources` with a list of 1 to 200 `resources` adds those Resources to the Collection, all of them or none, from its page ([FR-CO-31](../functional/03-collections.md#fr-co-31)), and answers with the Resources of the Collection; `PUT /resources/{id}/collection` with a `collectionId` adds one; `DELETE /resources/{id}/collection` removes it. Only the Data Team may do any of them (`403` for anyone else). A Resource that is in another Collection is refused with `409 in_another_collection`, naming it: it is removed first and added again, never moved; one that does not exist is refused with `404`, naming it, and one already in the Collection stays as it is. Adding writes `COL-006` in the Log of the Collection and `COL-030` in the Log of the Resource, sets the Message that it waits for a Collection to `inCollection` (MSG-RES-01), and places `MSG-RES-08` on the Resource for the Owner of the Collection, with the Collection, who added it and its Level ([DEC-CV-11](../functional/14-conversations.md#dec-cv-11)); removing writes `COL-007` and `COL-031`, and the Resource waits again.

<a id="tr-sr-05"></a>
### TR-SR-05 · Who reads which Resources

**Status:** Implemented · **Realises:** [FR-SR-35](../functional/04-stacks-and-resources.md#fr-sr-35), [DEC-SR-26](../functional/04-stacks-and-resources.md#dec-sr-26), [DEC-SR-27](../functional/04-stacks-and-resources.md#dec-sr-27)

| Route | What | Who |
| --- | --- | --- |
| `GET /resources?collection=none` | The Resources without Collection, withdrawn ones marked, each with its Level | The Data Team |
| `GET /resources/{id}` | A Resource with its fields, and the columns left out of it ([TR-SR-06](#tr-sr-06)) | Whoever sees the Resource |
| `GET /collections/{id}/resources` | The Resources of a Collection, withdrawn ones marked, each with the latest entry of its Log | Whoever sees the Collection; see below |
| `GET /resources/{id}/log` | The Log of a Resource, newest first | Whoever sees the Resource |

The Data Team and the members of the Owner Unit see every Resource of a Collection. Anyone else who sees the Collection sees only its published Resources ([FR-SR-31](../functional/04-stacks-and-resources.md#fr-sr-31)); Publication is not built yet, so for now that list is empty for them. A Resource someone does not see is answered with `404`.

<a id="tr-sr-06"></a>
### TR-SR-06 · A Resource holds its plain fields; the rest is named as left out

**Status:** Implemented · **Realises:** [DEC-SR-33](../functional/04-stacks-and-resources.md#dec-sr-33), [FR-SR-06](../functional/04-stacks-and-resources.md#fr-sr-06)

registry hands over the columns of every exposed table, as the catalog has them, with their descriptions from the manifest ([TR-AR-08](01-artifact-registry.md#tr-ar-08)). catalogue keeps the plain ones as the fields of the Resource, in `resource_fields`: name, position, type and description. A column whose type is an `ARRAY`, a `STRUCT` or `RECORD`, `JSON` or `BYTES` is no field: it goes to `resource_left_out`, with why, and so does every field inside a record, which the catalog lists as a column of its own, such as `address.city`. Both are refreshed by every call of registry, so they follow the table; the step that adds a Resource to a Collection names what was left out ([FR-CO-33](../functional/03-collections.md#fr-co-33)).

<a id="tr-sr-07"></a>
### TR-SR-07 · The Level at Registration

**Status:** Implemented · **Realises:** [FR-SR-07](../functional/04-stacks-and-resources.md#fr-sr-07), [DEC-MR-12](../functional/06-maturity-and-release.md#dec-mr-12), [FR-SR-09](../functional/04-stacks-and-resources.md#fr-sr-09)

A new Resource gets the Level 2 · Described when dbt describes its table and at least one of its fields, and otherwise 1 · Available; never higher. `RES-002` in its Log keeps the Level and why, as a code: `described`, `table-undescribed` or `fields-undescribed`. The Level does not follow the descriptions on later runs yet: rising and dropping come with the page of a Resource.

<a id="tr-sr-08"></a>
### TR-SR-08 · A Fingerprint at Registration

**Status:** Implemented · **Realises:** [FR-SR-08](../functional/04-stacks-and-resources.md#fr-sr-08), [DEC-SR-11](../functional/04-stacks-and-resources.md#dec-sr-11)

`resource_fingerprints` keeps the Fingerprints of a Resource, one per row, with the run it was taken from: a SHA-256 of the names of its fields, one of each field with its type, and one of the description of the table with each field and its description, each over the fields in the order of their names, so that a column that only moves changes nothing; and the checksum of its code from the manifest, which a source does not have. One is taken at Registration; the comparisons with it come with the Changes ([FR-AR-11](../functional/01-artifact-registry.md#fr-ar-11)).

<a id="tr-sr-09"></a>
### TR-SR-09 · Messages are placed on their object

**Status:** Implemented · **Realises:** [FR-SR-10](../functional/04-stacks-and-resources.md#fr-sr-10), [DEC-CV-10](../functional/14-conversations.md#dec-cv-10), [DEC-SR-12](../functional/04-stacks-and-resources.md#dec-sr-12)

The table `messages` in the schema of catalogue holds every Message: its type, a Message ID of the [Message Catalogue](../functional/message-catalogue.md); the kind and ID of the object it is placed on; who wrote it, or none for Data Hub itself; its parameters as JSON, never its text, which is built in the language of whoever reads it; and, while it asks something, its state. A Registration places [MSG-RES-01](../functional/message-catalogue.md#msg-res-01) on the new Resource, with its exposure, its dbt project and the day of the run, in the state `waiting`; adding the Resource to a Collection makes it `inCollection`, and removing it makes it wait again. A unique index keeps it to one per Resource, so a Resource that comes back after being withdrawn gets no second one. Who is told of a Message, and where it shows, comes with the Message Centre.

<a id="tr-sr-10"></a>
### TR-SR-10 · The Resource Card is kept in catalogue and edited in place

**Status:** Implemented · **Realises:** [FR-RC-15](../functional/05-resource-card.md#fr-rc-15), [FR-RC-01](../functional/05-resource-card.md#fr-rc-01), [FR-RC-16](../functional/05-resource-card.md#fr-rc-16), [FR-SR-28](../functional/04-stacks-and-resources.md#fr-sr-28), [DEC-MR-10](../functional/06-maturity-and-release.md#dec-mr-10)

The table `resources` keeps what the Owner and the Data Team write about a Resource, next to what comes from dbt: its Business Description, intended use and pitfalls, its Known Gaps as a list, since when its data is reliable as a day, and its key fields and Parameters as lists of its fields. `field_descriptions` keeps the Business Description of each field by its name, apart from `resource_fields`, which every call of registry rewrites, so a field that comes back finds its text again.

`GET /resources/{id}` gives them with the Resource: the card, and each field with its Business Description next to its description from dbt. `PATCH /resources/{id}` changes any of the card, and `PUT /resources/{id}/fields` the Business Descriptions of fields, an empty one removing it. Both are for the Owner Unit of its Collection and the Data Team, once the Resource is in a Collection (`409 no_collection` before); a key field or Parameter must be a field of the Resource. A Business Description is written from 2 · Described on (`409 not_described`, [DEC-MR-10](../functional/06-maturity-and-release.md#dec-mr-10)). Every change goes into the Log of the Resource by whoever made it: `RES-005` per part of the card that changed, `RES-010` per field.

`PUT /resources/{id}/details`, for the Data Team, records the grain, storage and mappings again as adding does ([TR-CO-05](03-collections.md#tr-co-05)), for Edit relations ([DEC-UX-107](../../design/principles.md#dec-ux-107)), with `RES-009`. `GET /resources/{id}/related` gives each mapping of the Resource with the other Resources the User sees that carry the same identity, and the field that carries it ([FR-RC-09](../functional/05-resource-card.md#fr-rc-09)).

<a id="tr-sr-11"></a>
### TR-SR-11 · The lineage around a Resource, for whoever sees it

**Status:** Implemented · **Realises:** [FR-SR-54](../functional/04-stacks-and-resources.md#fr-sr-54), [DEC-AR-06](../functional/01-artifact-registry.md#dec-ar-06)

`GET /resources/{id}/lineage` answers whoever may see the Resource. catalogue asks registry for the lineage of its Node up- and downstream, as itself with a Google ID token ([TR-AR-11](01-artifact-registry.md#tr-ar-11)), and adds which models are Resources the User sees, with their Display Name and Level. A Node registry does not know gives no lineage either way; a registry that does not answer gives `503`. The web app shows it one step at a time.

<a id="tr-sr-12"></a>
### TR-SR-12 · Publishing keeps the first Confirmation

**Status:** Implemented · **Realises:** [FR-SR-16](../functional/04-stacks-and-resources.md#fr-sr-16), [FR-SR-17](../functional/04-stacks-and-resources.md#fr-sr-17), [FR-SR-49](../functional/04-stacks-and-resources.md#fr-sr-49), [FR-MR-02](../functional/06-maturity-and-release.md#fr-mr-02), [FR-MR-08](../functional/06-maturity-and-release.md#fr-mr-08), [FR-RC-12](../functional/05-resource-card.md#fr-rc-12)

`POST /resources/{id}/publication` is for the Owner only: a member of the Owner Unit of its Collection, not the Data Team as such. It publishes a Resource from 2 · Described (`409 not_described` before, `409 already_published` after: a Publication is not undone, [DEC-SR-28](../functional/04-stacks-and-resources.md#dec-sr-28)). In one transaction, catalogue keeps the Confirmation in `resource_confirmations`, by whom and when, with the Fingerprint of that moment and its fields with their types; sets `published_at` and `published_by`; raises the Level to 3 · Confirmed; and writes `PUB-040` and `MAT-020` into its Log. A Confirmation has no end ([DEC-MR-05](../functional/06-maturity-and-release.md#dec-mr-05)). `GET /resources/{id}` gives who published it and when, and who confirmed it last and when.

<a id="tr-sr-13"></a>
### TR-SR-13 · What a new Current Version means for a Resource

**Status:** Implemented · **Realises:** [FR-MR-15](../functional/06-maturity-and-release.md#fr-mr-15), [FR-MR-09](../functional/06-maturity-and-release.md#fr-mr-09), [FR-MR-12](../functional/06-maturity-and-release.md#fr-mr-12), [FR-RC-17](../functional/05-resource-card.md#fr-rc-17), [FR-SR-19](../functional/04-stacks-and-resources.md#fr-sr-19), [DEC-MR-08](../functional/06-maturity-and-release.md#dec-mr-08)

Every call of registry about a Resource catalogue knows compares its fields and descriptions with those before:

- **A field added, removed or retyped** writes `ART-010` or `ART-012` into its Log, from its own Node. After a Confirmation, the change also goes into `resource_changes`, which is its warning until the Owner Unit or the Data Team marks it seen with `POST /resources/{id}/changes/seen` (`MAT-022`). A rename shows as a field removed and one added. The Owner gets one Message per call, [MSG-RES-03](../functional/message-catalogue.md#msg-res-03).
- **A description from dbt that changed**, of the table or of a field, goes into `description_changes` with the text before, and `ART-013` into its Log. The Owner gets one Message per call with every description that changed, [MSG-RES-02](../functional/message-catalogue.md#msg-res-02). `GET /resources/{id}` gives the latest change of each description in the last 30 days.
- **Its Level follows dbt:** 2 · Described with the table and a field described, else 1 · Available; a Resource confirmed before is 3 · Confirmed again once it is described ([DEC-MR-08](../functional/06-maturity-and-release.md#dec-mr-08)). A rise writes `RES-002`; a drop writes `MAT-021` and gives the Owner [MSG-RES-05](../functional/message-catalogue.md#msg-res-05). The Publication stays.

The Owner is told only once the Resource is in a Collection. A Message keeps a list, such as its changes, as JSON in its parameters, until the Message Centre reads it.

<a id="tr-sr-14"></a>
### TR-SR-14 · A published Resource for everyone who sees its Collection, and deprecated

**Status:** Implemented · **Realises:** [FR-SR-31](../functional/04-stacks-and-resources.md#fr-sr-31), [FR-SR-50](../functional/04-stacks-and-resources.md#fr-sr-50), [DEC-SR-28](../functional/04-stacks-and-resources.md#dec-sr-28)

Once published, a Resource is seen by everyone who sees its Collection: its page, its Log, the lineage around it and what it relates to, and the Collection lists it. A Resource that is not published stays with the Owner Unit and the Data Team; seeing a Resource never lets anyone change it. `PUT /resources/{id}/deprecation` marks a published Resource deprecated, with why and, optionally, another Resource to use instead; `DELETE` takes it away. Both are for the Owner Unit and the Data Team, and write `RES-007` and `RES-008`. A Collection gives each of its Resources with whether it is published and whether it is deprecated.

<a id="tr-sr-15"></a>
### TR-SR-15 · A query reads only its own Resources, and only reads

**Status:** Implemented · **Realises:** [FR-SR-41](../functional/04-stacks-and-resources.md#fr-sr-41), [DEC-SR-32](../functional/04-stacks-and-resources.md#dec-sr-32), [DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44), [DEC-UX-73](../../design/principles.md#dec-ux-73)

The service account of query may read every table of the project of Data Hub ([DEC-SR-32](../functional/04-stacks-and-resources.md#dec-sr-32)), so Data Hub alone decides what a query reads, twice, in its Pre-flight and again before every run:

1. **By its SQL.** query reads the SQL as words, comments and strings skipped, and takes every table named after `from` and `join` and in a list of `from`, leaving out its CTEs, a subquery, `unnest(…)`, an array of a row named through its alias, and the `from` of `extract(…)` and `is distinct from`. Each must be the Key of one of its Resources that the User may see now, as catalogue answers with the token of the User, whatever the case it is written in ([DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44)); written without its project, a Key counts when its project is that of Data Hub. Anything else is a table outside, named with where it stands in the SQL, and the query does not go to BigQuery. A table function, such as `ML.PREDICT` or `EXTERNAL_QUERY`, is never allowed; a wildcard table and `INFORMATION_SCHEMA` are no Resource.
2. **By BigQuery.** A dry run must say `SELECT`: a change, a script or a statement of another kind is refused. The tables the dry run says it reads must be its Resources named in the SQL, or the tables BigQuery reads beneath them, which query learns from a dry run of `select *` of each, named in its own case, kept ten minutes.

A Resource the User may no longer see keeps the query from running.

What goes to BigQuery, in a dry run and in a run, names each of its Resources by the full name of its table in its own case, quoted, wherever the SQL names it, as BigQuery names are case-sensitive; the query keeps its SQL as its author wrote it. A Lens keeps its SQL named so when it is made or updated, as its daily check has no User to ask catalogue with ([DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44)).

A function as the value of a Parameter goes into the SQL in place of its `@name`, in parentheses, before both checks, so a table in it is checked as any other and stands, in the answer, where its `@name` is ([DEC-UX-118](../../design/principles.md#dec-ux-118)).

<a id="tr-sr-16"></a>
### TR-SR-16 · The Pre-flight and a run

**Status:** Implemented · **Realises:** [FR-SR-27](../functional/04-stacks-and-resources.md#fr-sr-27), [FR-SR-36](../functional/04-stacks-and-resources.md#fr-sr-36), [FR-SR-37](../functional/04-stacks-and-resources.md#fr-sr-37), [FR-SR-40](../functional/04-stacks-and-resources.md#fr-sr-40), [FR-SR-51](../functional/04-stacks-and-resources.md#fr-sr-51), [DEC-SR-29](../functional/04-stacks-and-resources.md#dec-sr-29), [DEC-SR-30](../functional/04-stacks-and-resources.md#dec-sr-30), [DEC-SR-35](../functional/04-stacks-and-resources.md#dec-sr-35), [DEC-SR-36](../functional/04-stacks-and-resources.md#dec-sr-36), [DEC-UX-71](../../design/principles.md#dec-ux-71)

`POST /queries/{id}/preflight` with the SQL and the Parameters, while they are written, gives the Pre-flight and keeps both: what the query reads at most, from a dry run of BigQuery, which costs nothing; its range, up to 100 MB, up to 1 GB, or above, from `DATAHUB_QUERY_APPROVE_BYTES` and `DATAHUB_QUERY_REQUEST_BYTES`, in bytes of 1000; the partitions it reads where the dry run says so; what keeps it from running ([TR-SR-15](#tr-sr-15)); and per Resource it reads with a partition column, whether it filters on it. A filter counts when the column is named in a `where`. Without one, a Resource that requires it, in Data Hub or in BigQuery, keeps the query from running, naming the column; BigQuery's own refusal for a missing filter says the same. On another Resource it is a warning, with what the query reads with a filter on its recent partitions, from a dry run of its own. Both come with the SQL that adds the filter, where Data Hub can tell where it goes: into the `where` after the table, or as a new `where` after it, never before a join.

A Parameter has a name, an SQL name; a kind from the standard list, each with its type in BigQuery: Date (`DATE`), Period (two `DATE`s, `@name_from` and `@name_to`), Whole number (`INT64`), Decimal number (`NUMERIC`), Text (`STRING`), Choice (`STRING`, from its typed list), Several choices (`ARRAY<STRING>`) and Yes or no (`BOOL`); and a value. A value of its kind, such as `2026-01-01` for a Date, goes to BigQuery as a named query parameter of its type, apart from the SQL; anything else for a Date, a Period or a number, and a call such as `CONCAT('a', 'b')` for a Text, is a function, which goes into the SQL in place of its `@name` ([TR-SR-15](#tr-sr-15)). An `@name` in the SQL that is not a Parameter keeps the query from running, named where it stands with a kind suggested from the type of the column it is compared with; a Parameter not in the SQL is named as unused and not sent.

`POST /queries/{id}/runs` checks it all again. Between the two thresholds it runs only with `approve`; above the second it does not run (`409 request_needed`), until the Data Team accepts a Request of its author ([TR-SR-18](#tr-sr-18)); then it runs, with `approve` as well. A run is a job of BigQuery with `maximumBytesBilled` at the second threshold, or with an accepted Request at a tenth above what the Pre-flight says, and the labels `datahub-user`, the Google ID of the User, and `datahub-query`, its Query ID. It waits for the job up to four minutes and answers with the run and its first page. `GET /runs/{queryId}/rows?page=n` reads a page of 100 rows from the result of the same job, never a new query, for whoever ran it; once BigQuery no longer keeps the result, about a day, it answers `410 expired`. Values come as BigQuery gives them, as text, a timestamp as BigQuery writes it, a list and a record as JSON, `null` as null; the types of the columns are those of GoogleSQL.

<a id="tr-sr-17"></a>
### TR-SR-17 · Queries and the Query Log

**Status:** Implemented · **Realises:** [FR-SR-43](../functional/04-stacks-and-resources.md#fr-sr-43), [FR-SR-45](../functional/04-stacks-and-resources.md#fr-sr-45), [FR-SR-46](../functional/04-stacks-and-resources.md#fr-sr-46), [DEC-UX-137](../../design/principles.md#dec-ux-137), [DEC-UX-138](../../design/principles.md#dec-ux-138), [DEC-UX-139](../../design/principles.md#dec-ux-139), [FR-LN-05](../functional/07-log-and-notifications.md#fr-ln-05), [DEC-LN-01](../functional/07-log-and-notifications.md#dec-ln-01), [DEC-UX-73](../../design/principles.md#dec-ux-73), [DEC-UX-74](../../design/principles.md#dec-ux-74)

query keeps its data in the schema `query` ([DEC-PF-29](00-platform.md#dec-pf-29)). A row of `queries` is a query: who made it, its name and question, its Resources as they were named when it was made, the SQL and the Parameters being written, and the query it was started from with another set of Resources, after which of its runs. `POST /queries` makes one on Resources the User sees, with SQL that selects their fields and filters each on its partition column, its recent partitions: four weeks of days, three months, a year; with more than one Resource, a CTE each. Started from a query the User may see, it takes the SQL and Parameters it is given instead, and remembers that query and its last run. `PATCH /queries/{id}` changes its name and question, and the SQL and Parameters being written; a name has 1 to 120 characters, a question at most 500 ([DEC-UX-119](../../design/principles.md#dec-ux-119)). `GET /queries` lists the queries of the User, newest run first; with `all=true`, everyone's, for the Data Team only. For the panel it also takes a period, `from` and `to`, on when a query last ran or was made; `show`, which leaves out previews, the queries of Lenses and the queries the User hid, except those it names (`previews`, `lenses`, `hidden`); words to search for, `q`, in the name, its maker and its Resources; and `limit`, at most 200. Each query says whether the User hid it. `GET /queries/days?tz=` counts the queries per day in the time zone of the User, by what the panel shows them as: plain, a preview, of a Lens or hidden. A row of `hidden_queries` hides a query for one User, `PUT /queries/{id}/hidden` adds it and `DELETE` takes it away again, for anyone who sees the query; nobody else's panel changes ([DEC-UX-137](../../design/principles.md#dec-ux-137), [DEC-UX-138](../../design/principles.md#dec-ux-138), [DEC-UX-139](../../design/principles.md#dec-ux-139)). A query is read by who made it, by the Data Team and by the Owner Unit of one of its Resources ([DEC-SR-31](../functional/04-stacks-and-resources.md#dec-sr-31)), as catalogue answers with the token of the User; it is written and run only by who made it. A query is of the kind `query` or `preview` ([TR-SR-19](#tr-sr-19)).

A row of `runs` is a run and a line of the Query Log: its number in its query, its Query ID (`q-` with the day and six random hex digits, such as `q-20261029-4c2e1a`), the SQL and the Parameters with their values, who ran it and when, what the Pre-flight said it reads and whether it was approved, its Resources, the job in BigQuery and its location, what it processed and billed, its partitions, its columns and how many rows, and whether it ran or failed and why. It is kept for as long as Data Hub exists. A run has a purpose: `run`, or `values` for the query that reads the values of the choices of a Preview, numbered apart and left out of the history of its query, the panel and the tab History ([DEC-SR-40](../functional/04-stacks-and-resources.md#dec-sr-40)). `GET /queries/{id}/runs?before=n&limit=m` gives the history of a query, newest first, with the SQL and values of each run, to who made it and to the Data Team.

<a id="tr-sr-18"></a>
### TR-SR-18 · A Request to run a query above 1 GB

**Status:** Implemented · **Realises:** [FR-SR-37](../functional/04-stacks-and-resources.md#fr-sr-37), [DEC-SR-36](../functional/04-stacks-and-resources.md#dec-sr-36), [DEC-UX-116](../../design/principles.md#dec-ux-116), [FR-CV-08](../functional/14-conversations.md#fr-cv-08)

`POST /queries/{id}/requests` with the SQL, the Parameters and an optional word of at most 500 characters sends a query to the Data Team, for who made it: query checks it as for a run, and only above the second threshold (`409 not_needed` below) sends it to catalogue with the token of the User, with the name of the query and what one run reads above which threshold, from its own Pre-flight. catalogue keeps it as the Message [MSG-QRY-01](../functional/message-catalogue.md#msg-qry-01), written by that User, in the state `waiting` (`POST /requests`); while one of the same writer on the same query waits, it gives that one back instead, kept so by a unique index. `GET /requests?subjectKind=query`, and with `subjectId` for one query, gives the User their own, newest first; the Data Team gets everyone's on one query. A query, and every query in the panel, carries the state of the last Request of its author on it: `waiting`, `accepted` or `refused`. The Data Team accepts or refuses it in the Message Centre, in part 7 of the [build order](../../design/build-order.md).

<a id="tr-sr-19"></a>
### TR-SR-19 · The Preview of a Resource

**Status:** Implemented · **Realises:** [FR-SR-38](../functional/04-stacks-and-resources.md#fr-sr-38), [FR-SR-43](../functional/04-stacks-and-resources.md#fr-sr-43), [DEC-SR-37](../functional/04-stacks-and-resources.md#dec-sr-37), [DEC-SR-39](../functional/04-stacks-and-resources.md#dec-sr-39), [DEC-SR-40](../functional/04-stacks-and-resources.md#dec-sr-40), [DEC-UX-120](../../design/principles.md#dec-ux-120)

A Preview reads the Resource as query writes it, never SQL of the User: its fields, filtered on its partition column, then on what the User chose, newest partition first, at most 1000 rows. Its window is the newest 1, 4 or 12 partitions that hold rows, which query reads from `INFORMATION_SCHEMA.PARTITIONS` of the table, without reading the table, and keeps ten minutes; the filter starts at the first moment of the oldest of them, as a literal of the type of the column. Where BigQuery does not tell, or the table is partitioned by the time it was loaded, it goes back as many units from today. Its choices are its first cluster column, then the Parameters of its Card, leaving out the partition column; a column of text is a Choice, a whole number, a decimal number, a date and yes or no each the kind of [TR-SR-16](#tr-sr-16); at most six. A value chosen goes to BigQuery as a named query parameter, after query checked that it is a value of that kind.

`POST /resources/{id}/preview/choices` with the window gives the window, its field, its unit and from when, and the choices with at most 100 values each, read from the partitions of the window in one query: the values query. It runs only when its Pre-flight says it reads up to 100 MB; otherwise a choice comes without values. `POST /resources/{id}/preview/preflight` with the window and the values chosen gives the Pre-flight of the Preview ([TR-SR-16](#tr-sr-16)), and a Request of the User on it that waits or was accepted. `POST /resources/{id}/preview/runs` runs it as `POST /queries/{id}/runs` does, with its thresholds and approval, and `POST /resources/{id}/preview/requests` sends it to the Data Team above 1 GB, as [TR-SR-18](#tr-sr-18) does. Each needs the User to see the Resource, as catalogue answers.

The previews of a Resource by a User are one query of the kind `preview`, named "Preview · " with the Display Name of the Resource, made with its first preview, kept one per User and Resource by a unique index; each preview is a run of it, in the Query Log with its Query ID, and the values query a run with the purpose `values` ([TR-SR-17](#tr-sr-17)). So the panel of Query lists the previews of the User as one query, marked so.

<a id="tr-sr-20"></a>
### TR-SR-20 · The size and partitions of a Resource

**Status:** Implemented · **Realises:** [FR-SR-39](../functional/04-stacks-and-resources.md#fr-sr-39), [DEC-SR-34](../functional/04-stacks-and-resources.md#dec-sr-34), [DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44)

`GET /resources/{id}/storage` gives, for a Resource the User may see, the full name of its table in BigQuery, in its own case, its size in bytes, its rows, its number of partitions and when it last changed, from the metadata of the table (`tables.get`), which reads nothing of it and costs nothing. For a view these are of the table beneath it: the one partitioned on the same column, or the only table beneath it, as a dry run of `select *` says ([TR-SR-15](#tr-sr-15)); `beneath` says so. Without such a table, or where BigQuery refuses, it gives nothing. query keeps the metadata of a table ten minutes.

<a id="tr-sr-21"></a>
### TR-SR-21 · The queries on a Resource

**Status:** Implemented · **Realises:** [FR-SR-44](../functional/04-stacks-and-resources.md#fr-sr-44), [DEC-SR-31](../functional/04-stacks-and-resources.md#dec-sr-31), [DEC-SR-41](../functional/04-stacks-and-resources.md#dec-sr-41)

`GET /resources/{id}/queries` gives every query with a run on the Resource, of every User, newest run first: its name, its kind, who made it and whether that is the User, its runs, its last run, and what that read, or what its Pre-flight said, or that it failed. On top, the queries with a run in the last 30 days, how many of them are Lenses, and how many colleagues made them. Only the Owner Unit of the Resource and the Data Team get it, as catalogue answers whether the User manages its Collection with the token of the User (`GET /collections/{id}`); anyone else gets `403 forbidden`. Each opens as a query, with its SQL and history, for them ([TR-SR-17](#tr-sr-17)); the pages of a result stay with who ran it.

<a id="tr-sr-22"></a>
### TR-SR-22 · The Changes upstream of a Resource, in its Log

**Status:** Implemented · **Realises:** [FR-AR-12](../functional/01-artifact-registry.md#fr-ar-12), [EC-AR-04](../functional/01-artifact-registry.md#ec-ar-04), [MSG-RES-04](../functional/message-catalogue.md#msg-res-04)

The `changes` that registry sends with the tables of a dbt project ([TR-AR-14](01-artifact-registry.md#tr-ar-14)) go, in the same transaction, into the Log of every Resource on a table they reach that is not withdrawn, whatever its dbt project, each with the name of the model it happened in and its distance, nothing filtered out: `ART-010` for a field added or removed, `ART-011` for new code, `ART-012` for a field retyped, `ART-013` for a description, `ART-014` for a model upstream that was removed and `ART-015` for one added. The text of `ART-010` and `ART-012` names the model when it is upstream. A Resource in a Collection whose own code or code upstream changed gets one Message per call, [MSG-RES-04](../functional/message-catalogue.md#msg-res-04), with the nearest such model and its distance.

<a id="tr-sr-23"></a>
### TR-SR-23 · Broken queries, and what reads a Resource checked at three moments

**Status:** Implemented · **Realises:** [FR-SR-52](../functional/04-stacks-and-resources.md#fr-sr-52), [FR-SR-53](../functional/04-stacks-and-resources.md#fr-sr-53), [DEC-UX-160](../../design/principles.md#dec-ux-160), [MSG-QRY-02](../functional/message-catalogue.md#msg-qry-02), [MSG-LEN-05](../functional/message-catalogue.md#msg-len-05)

Each Pre-flight or run of a query that can run keeps its SQL as BigQuery reads it, with the full names of its Resources in their own case ([DEC-SR-44](../functional/04-stacks-and-resources.md#dec-sr-44)), and its Parameters (`queries.check_sql`, `queries.check_parameters`), so that Data Hub can dry-run it without its User. A query is Broken when a dry run of that kept SQL fails because a table, view or dataset is not found, or a column is not recognised: query keeps what it misses and since when (`queries.broken`) and writes `BRK-001` in its Log (`query_log`); a typo in SQL being written is not Broken, as the kept SQL still runs. A Pre-flight that can run, of a changed SQL or of the same, or a dry run of the kept SQL that succeeds again, makes it work again, with `BRK-002`. Every change of state is written once. A Broken query answers its Pre-flight, a refused run and a failed run with what it misses (`broken`); the panel of Query and the queries on a Resource ([TR-SR-21](#tr-sr-21)) list it with what it misses, a Lens there with what the Lens misses. A Preview is made afresh from its Resource each time and the runs of a Lens follow their Lens, so neither is Broken itself.

What reads a Resource is checked at three moments, each a dry run of every Lens that runs, with its defaults ([TR-LE-06](09-lenses.md#tr-le-06)), and of every query with kept SQL, eight at a time:

1. After a new Current Version, catalogue sends the Resources it withdrew, brought back, or whose fields were removed, renamed or added, to `POST /internal/checks` of query, with a Google ID token of its own service account for the address of query (`DATAHUB_QUERY_URL`, `DATAHUB_CATALOGUE_SERVICE_ACCOUNT`). It waits at most 20 seconds and answers registry either way.
2. Once a day the scheduler's `POST /internal/lenses/check` also dry-runs every query with kept SQL, which finds a table dropped outside dbt too.
3. When a Pre-flight, a run or a Preview of a User does not find the table of one of its Resources, query checks what reads that Resource, at most once in ten minutes per Resource.

Each time one becomes Broken, query asks catalogue, as itself, to tell who made the query ([MSG-QRY-02](../functional/message-catalogue.md#msg-qry-02)) or the Owner Unit of the Lens ([MSG-LEN-05](../functional/message-catalogue.md#msg-len-05)): `POST /internal/queries/{id}/broken` with its name and who made it, or `POST /internal/lenses/{id}/broken`, with the day it was found and what is missing, a table by the Display Name of its Resource, a column with the Resources the query reads, as BigQuery does not say of which. The Message starts in the state `broken`, is seen by who made the query (`params.owner`) or by who sees the Lens, and is For you for them. When it works again, `POST /internal/{queries|lenses}/{id}/works` puts that Message in the state `worksAgain` and makes it unread again. A Message that could not be sent is logged, not sent again.

## Open points

None yet; reading the data of Resources is [OP-SR-10](../functional/04-stacks-and-resources.md#op-sr-10).
