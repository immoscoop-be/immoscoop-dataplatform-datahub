# Lenses: technical requirements

| | |
| --- | --- |
| Realises | [Lenses](../functional/09-lenses.md) |
| Status | Making a Lens from a query, who sees it, its page and its runs, updating and editing it, its growth and Broken, finding it from a new query and on the start screen of Collections, also by its search, and the decision of the Data Team on it ([TR-CV-02](14-conversations.md#tr-cv-02)) implemented |
| Source of truth | This file |

How a query becomes a Lens and how a Lens runs, in the service [query](../../architecture/services/query.md), which keeps the Lenses next to the queries ([DEC-PF-30](00-platform.md#dec-pf-30)).

## Requirements

<a id="tr-le-01"></a>
### TR-LE-01 · A Lens is made from a query, measured in three ranges

**Status:** Implemented · **Realises:** [FR-LE-03](../functional/09-lenses.md#fr-le-03), [FR-LE-05](../functional/09-lenses.md#fr-le-05), [FR-LE-06](../functional/09-lenses.md#fr-le-06), [FR-LE-07](../functional/09-lenses.md#fr-le-07), [FR-LE-08](../functional/09-lenses.md#fr-le-08), [FR-LE-09](../functional/09-lenses.md#fr-le-09), [DEC-LE-03](../functional/09-lenses.md#dec-le-03), [DEC-LE-05](../functional/09-lenses.md#dec-le-05), [DEC-LE-16](../functional/09-lenses.md#dec-le-16), [DEC-CO-20](../functional/03-collections.md#dec-co-20), [DEC-CO-24](../functional/03-collections.md#dec-co-24)

query keeps a Lens in `lenses` of its schema: its Collection in catalogue, the query it was made from, which is used as it, one Lens per query; its author; its name, question, what it shows, its steps as its author wrote them, a line each, and its tags, words of letters and digits without the `#`; its SQL, its Parameters, each with the name Users see, and its Resources as the query named them; its version; its state, `published` or `waiting`; and the range one run was measured in and what it read. `lens_versions` keeps every version, the first one too, with who made it from which query ([FR-LE-16](../functional/09-lenses.md#fr-le-16)).

`POST /lenses` makes a Lens of a query of the kind `query`, for who made it only, into a Collection they manage as its Owner Unit or the Data Team, as catalogue answers with their token. Its SQL and Parameters are those the query keeps; its Parameters are those the SQL uses. The Pre-flight of the query, as for a run ([TR-SR-16](04-stacks-and-resources.md#tr-sr-16)), measures one run: within 100 MB the Lens is published; above it, only when its author says so (`approve`), otherwise `409 approval_needed`; above 1 GB it is kept as `waiting`, frozen, and query sends the Request on it to the Data Team for its author ([MSG-LEN-01](../functional/message-catalogue.md#msg-len-01)), which catalogue keeps as it keeps those on queries ([TR-SR-18](04-stacks-and-resources.md#tr-sr-18)), with its word and the partitions it reads. When the Request does not reach catalogue, the Lens stays waiting, and `POST /lenses/{id}/requests` sends it again for its author. A query that cannot run makes no Lens. An author who owns no Collection makes a private one first in catalogue, with the name, group and icon they chose ([DEC-CO-24](../functional/03-collections.md#dec-co-24)); its description names the Lens.

<a id="tr-le-02"></a>
### TR-LE-02 · Who sees a Lens, never with its SQL

**Status:** Implemented · **Realises:** [FR-LE-11](../functional/09-lenses.md#fr-le-11), [FR-LE-14](../functional/09-lenses.md#fr-le-14), [FR-CO-28](../functional/03-collections.md#fr-co-28), [FR-CO-36](../functional/03-collections.md#fr-co-36), [DEC-LE-09](../functional/09-lenses.md#dec-le-09), [DEC-CO-16](../functional/03-collections.md#dec-co-16), [DEC-DH-10](../../overview/data-hub.md#dec-dh-10)

`GET /lenses` and `GET /lenses/{id}` give the Lenses a User sees, as catalogue answers once with their token which Collections they see and which Resources in them they may use (`GET /collections`): a Lens in a Collection they see, built on Resources they may all use; the Data Team uses every Resource. While a Lens waits for the Data Team, only its author and the Data Team see it. A Lens comes with its Level, the lowest of those of its Resources, and never with its SQL, for nobody: who may change it reads the SQL in its query. Its page has what it shows, its steps, its tags, its Parameters with their defaults, its Resources with their Collection and Level, who made it from which query, and for a waiting Lens its Request.

<a id="tr-le-03"></a>
### TR-LE-03 · A run of a Lens is a query in the Query Log

**Status:** Implemented · **Realises:** [FR-LE-04](../functional/09-lenses.md#fr-le-04), [FR-LE-12](../functional/09-lenses.md#fr-le-12), [FR-LE-13](../functional/09-lenses.md#fr-le-13), [DEC-LE-01](../functional/09-lenses.md#dec-le-01), [DEC-LE-12](../functional/09-lenses.md#dec-le-12), [FR-SR-44](../functional/04-stacks-and-resources.md#fr-sr-44)

`POST /lenses/{id}/preflight` and `POST /lenses/{id}/runs` take the values a User chose per Parameter: only its value changes, a date, a number or a text as a value or a function, a value of its list, several of them, yes or no, a Period as its start and end; never its kind or its list. The SQL is that of the Lens; the checks and the run are those of a query ([TR-SR-15](04-stacks-and-resources.md#tr-sr-15), [TR-SR-16](04-stacks-and-resources.md#tr-sr-16)), over the Resources of the Lens as the User may see them now. A run above 1 GB does not run. A waiting Lens does not run (`409 waiting`).

The runs of a Lens by one User are one query of the kind `lens`, made with their first run, named as the Lens and kept to its current version, one per User and Lens by a unique index. Each run is in the Query Log with its Query ID, and its pages are read as those of any run, by who ran it. Only the Data Team reads such a query and its runs as a query, with their SQL; nobody runs it but through the Lens. The panel of Query lists it as a run on a Lens and opens the Lens, and the tab History of a Resource lists a Lens as one row, made by its author, with the runs of every User ([TR-SR-21](04-stacks-and-resources.md#tr-sr-21)).

<a id="tr-le-04"></a>
### TR-LE-04 · A Lens is updated from a query used as it, and edited without its SQL

**Status:** Implemented · **Realises:** [FR-LE-06](../functional/09-lenses.md#fr-le-06), [FR-LE-16](../functional/09-lenses.md#fr-le-16), [FR-CO-29](../functional/03-collections.md#fr-co-29), [DEC-LE-04](../functional/09-lenses.md#dec-le-04), [DEC-LE-18](../functional/09-lenses.md#dec-le-18), [DEC-UX-27](../../design/principles.md#dec-ux-27), [DEC-UX-77](../../design/principles.md#dec-ux-77), [DEC-UX-123](../../design/principles.md#dec-ux-123)

`PUT /lenses/{id}/version` makes the next version of a Lens from a query of the User that is used as it: the query it was made from, or one "Open in Query" made. Its SQL and Parameters replace those of the Lens; a Parameter keeps the name Users see, and a new one is named as in the query. The Pre-flight of the query measures it again, as when it was made ([TR-LE-01](#tr-le-01)): within range or approved it is published at once; above 1 GB it waits for the Data Team with its new version, and query sends the Request for it ([MSG-LEN-01](../functional/message-catalogue.md#msg-len-01)). `lens_versions` keeps every version with who made it from which query, and the page of the Lens shows them. Its Owner Unit and the Data Team update it, as catalogue says who manages its Collection; nobody does while it waits.

`POST /lenses/{id}/query` is "Open in Query": for its author, the query it was made from; for anyone else of its Owner Unit or the Data Team, a query of their own with the SQL, Parameters and Resources of the Lens, made once and used as the Lens from then on (`queries.for_lens`, one per User and Lens). Such a query makes no other Lens. `PATCH /lenses/{id}` changes what a Lens tells: its name, question, what it shows, its steps, its tags and the names Users see of its Parameters; never its SQL, its Parameters or its Collection.

A query started with "New Lens" on the page of a Collection keeps that Collection (`queries.for_collection`), and "Make it a lens" offers it first when its author owns it.

<a id="tr-le-05"></a>
### TR-LE-05 · Only a run with its defaults measures a Lens, and past 1 GB it stops

**Status:** Implemented · **Realises:** [FR-LE-10](../functional/09-lenses.md#fr-le-10), [DEC-LE-11](../functional/09-lenses.md#dec-le-11), [DEC-LE-19](../functional/09-lenses.md#dec-le-19), [DEC-UX-125](../../design/principles.md#dec-ux-125)

When the Pre-flight or a run of a Lens with its default values, and the daily check ([TR-LE-06](#tr-le-06)), reads more than its range, query moves the Lens on: grown into large, its range follows, it keeps running and Data Hub tells its author ([MSG-LEN-02](../functional/message-catalogue.md#msg-len-02)); grown past 1 GB, its state becomes `stopped`, with since when and what one run read, and the Pre-flight and the run answer `409 stopped`. A stopped Lens stays where it is listed, for everyone who sees it, and runs for nobody. A run with values a User chose is that run alone. A new version that reads less publishes it again ([TR-LE-04](#tr-le-04)).

<a id="tr-le-06"></a>
### TR-LE-06 · A Broken Lens is found on a failed Pre-flight and by a daily check

**Status:** Implemented · **Realises:** [FR-LE-17](../functional/09-lenses.md#fr-le-17), [FR-SR-52](../functional/04-stacks-and-resources.md#fr-sr-52), [DEC-LE-20](../functional/09-lenses.md#dec-le-20), [DEC-UX-81](../../design/principles.md#dec-ux-81)

When BigQuery refuses the dry run of a Lens because a table, view or dataset is not found, or a column is not recognised, query keeps what it misses and since when (`lenses.broken`), writes `BRK-001` in its Log (`lens_log`), and answers the Pre-flight and the run with `409 broken`. Any other refusal is no reason to call it Broken. When a dry run succeeds again, or a new version replaces it, the Lens works again and its Log gets `BRK-002`. Every change of state is written once. Wherever a Lens is listed, it comes with what it misses, for the red dot.

Once a day, at 05:17 in Brussels, Cloud Scheduler calls `POST /internal/lenses/check` with a Google ID token of its own service account `datahub-scheduler`, for the address of query, which query checks itself (`DATAHUB_SCHEDULER_SERVICE_ACCOUNT`, `DATAHUB_QUERY_URL`), as Cloud Run does not check callers. query dry-runs every Lens that does not wait for the Data Team with its defaults: what it misses, what works again, and what grew ([TR-LE-05](#tr-le-05)). A dry run reads nothing and costs nothing. The check right after a new Current Version of a dbt project comes later.

<a id="tr-le-07"></a>
### TR-LE-07 · A new query finds the Lenses on its Resources by the words of its question

**Status:** Implemented · **Realises:** [FR-SR-47](../functional/04-stacks-and-resources.md#fr-sr-47), [FR-SR-48](../functional/04-stacks-and-resources.md#fr-sr-48), [DEC-SR-42](../functional/04-stacks-and-resources.md#dec-sr-42), [DEC-SR-43](../functional/04-stacks-and-resources.md#dec-sr-43), [DEC-UX-22](../../design/principles.md#dec-ux-22), [DEC-UX-23](../../design/principles.md#dec-ux-23), [FR-CO-37](../functional/03-collections.md#fr-co-37), [DEC-UX-126](../../design/principles.md#dec-ux-126)

`GET /lenses/suggestions?resources=…&question=…` gives the Lenses a new query may reuse, for 1 to 10 Resources and a question: those on exactly these Resources, then those on these and more. Only Lenses the User sees and that run now are given: published, not stopped and not Broken. In each group, the Lenses that share most words with the question come first, then the newest. The words are those of the full-text search of Postgres in the configuration `lens_words`: English, with `unaccent` before the stemmer, so that common words are left out, every word counts by its stem and accents do not count. They are matched against the name of a Lens, its question, what it shows and its tags; each Lens comes with how many words it shares, those texts in pieces with the shared words marked, from `ts_headline`, and its tags that share one. The same call gives the count of "Lenses on these Resources" on a query and the Lenses on the new set of a new query.

`GET /lenses` gives with each Lens when the User last ran it, from their query of the kind `lens`, for "Yours" on the start screen of Collections. Which Lenses are new there, published in the last 30 days in a public Collection outside the User's own Owner Units, the web app works out from the Lenses and Collections it has.

<a id="tr-le-08"></a>
### TR-LE-08 · Excel gets the result of a Lens as CSV, with an Excel key

**Status:** Implemented · **Realises:** [DEC-CH-06](../functional/13-channels.md#dec-ch-06), [FR-CH-01](../functional/13-channels.md#fr-ch-01), [DEC-UX-159](../../design/principles.md#dec-ux-159), [TR-PF-07](00-platform.md#tr-pf-07)

`GET /excel/lenses/{id}` of query is the address Power Query asks, which "Open in Excel" on the page of a Lens shows. It is reachable without an Access Token: without an Excel key in `Authorization`, Basic with the key as password, it answers 401 with `WWW-Authenticate: Basic realm="Data Hub"`, so that Excel asks how to sign in. The key is exchanged at identity for an Access Token of its User ([TR-PF-07](00-platform.md#tr-pf-07)); from then on the request is checked as theirs, as on the page of the Lens ([TR-LE-02](#tr-le-02)).

Only a published Lens answers: a waiting, refused or stopped Lens answers 409 with why, and a Broken one as on its page ([TR-LE-06](#tr-le-06)). It runs with the defaults of its Parameters, as a run of the User in the Query Log ([TR-LE-03](#tr-le-03)), only within 100 MB: Excel cannot approve a run ([OP-CH-04](../functional/13-channels.md#op-ch-04)). Its result is CSV in UTF-8 with a BOM and CRLF, at most 10,000 rows, read from the same job page after page; the Query ID of the run is in the header `X-Datahub-Query-Id`.

## Open points

None yet.
