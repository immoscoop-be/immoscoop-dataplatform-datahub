# Lenses: technical requirements

| | |
| --- | --- |
| Realises | [Lenses](../functional/09-lenses.md) |
| Status | Making a Lens from a query, who sees it, its page and its runs implemented; updating it from its query, growth and Broken follow |
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

## Open points

None yet; what "New Lens" on the page of a Collection opens is [OP-UX-43](../../design/principles.md#op-ux-43).
