# Data Hub

| | |
| --- | --- |
| Type | Working document |
| Tags | strategy, context, decision |
| Area | Tooling, Technical |
| Status | Idea |
| Repository | [immoscoop-dataplatform-datahub](https://github.com/maximethenextimmoscoopbe/immoscoop-dataplatform-datahub) |
| Source of truth | This file. On Confluence the source of truth was "this page, until there is a functional and technical analysis"; that analysis is now built up under [requirements](../requirements/README.md). |
| Migrated from | [ptditt - Tooling - Data Hub](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1362428000) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17 |

**In one sentence:** Data Hub is the library of our data: the one entry point for business colleagues and their Claude, next to and together with the chart server. All data in the company runs through Data Hub.

*Built up from conversations with Max, on 2026-10-07 and later, about documentation in ptditt. This is a direction, not a design. Earlier we spoke of "the data server", "the data tool" and "Data-Desk"; since 2026-10-12 it has been called Data Hub, next to Domain Hub. Whether Data Hub stays a separate application or merges with Domain Hub is still open. The functional elaboration per domain is in [Functional domains](../requirements/functional/README.md).*

- <a id="dec-dh-01"></a>**DEC-DH-01** · The name is Data Hub, next to Domain Hub: Domain Hub for the meaning, Data Hub for the data. The image behind it is a library, with the data team as librarian and the stacks as shelves.
- <a id="dec-dh-02"></a>**DEC-DH-02** · The app is entirely in English: the interface, the names and the texts of the log. The documentation on Confluence stays in Dutch.

*Migration note: the documentation has since moved to this repository, in English. The Confluence pages remain in Dutch.*

## Data Hub as a library

Whoever explains Data Hub can best start from a library. Most terms on this page have a counterpart there. The full list of terms is in the [glossary](../glossary.md).

| In the library | In Data Hub |
| --- | --- |
| The librarian | The data team: takes data in, describes it and puts it on the shelves |
| The stacks | The dataset `dbt_prod_stacks`: the shelves holding only what may be released |
| Registering a book | The registration of a resource by a data admin: only then does it exist for Data Hub |
| A book on the shelves | A resource |
| General circulation | A published resource: the curator has released it for the whole company |
| A collection | A functional domain of Immoscoop in which resources sit together, such as leads or agencies |
| The catalogue card | The resource card: everything we know about one book |
| The catalogue | Searching and browsing in Data Hub, via table, catalogue or domain model |
| The accession register | The dbt artifacts: what changed in the collection, at every prod run |
| The curator of a collection | The owner, who vouches for a collection and confirms its resources |
| The library card | The personal key, for example for Excel |
| The reading room | Where business makes lenses and reports |
| The magnifying glass | A lens: a way of looking at one resource |
| The dossier | A report: lenses bundled around one question |
| Margin notes | The conversation between colleagues, attached to the object it is about |
| Collection management and weeding | Registering and deregistering resources, and adding them to or removing them from collections |

## Why

The first readers of our documentation are business colleagues and Claude. They largely ask the same things (what does this mean, may I use it this way, what is not in it), the one by reading, the other by querying.

Part of that knowledge already exists, in Colleciónes and the dbt manifests, but it sits behind the wrong door. Claude only gets to know the domain model through the dbt plugin, and that is available to three people today. The rest of the business, and their Claude, have to rely on names and descriptions in BigQuery. That breeds misunderstandings, such as a mart built for one BI application being used for another analysis, or an event table being read as a state.

- <a id="dec-dh-03"></a>**DEC-DH-03** · Descriptions in BigQuery are not sufficient as a carrier for documentation.
- <a id="dec-dh-04"></a>**DEC-DH-04** · Handing out dbt licences to everyone who wants to work with data is not feasible within the budget.
- <a id="dec-dh-05"></a>**DEC-DH-05** · We choose our own application, Data Hub, as the one entry point, next to and together with the chart server.

## What Data Hub does

| Function | What |
| --- | --- |
| Connectivity | Access to the stacks, for people and for Claude. |
| Documentation | What is on the shelves and how you may use it: the resource card of every resource, with field descriptions, EDA results and questions with their data answer. We determine the exact scope in the analysis. |
| Keeping | Storing lenses and reports, together with the chart server. |
| Communication | Colleagues talk to each other about data, and that conversation stays attached as a margin note to the object it is about. |

## Three forms of documentation

| Form | What it tells | Where it comes from | Who writes it |
| --- | --- | --- | --- |
| Structural | Model type (event, state, dimension, mart), grain, lineage, fields | Derivable from Colleciónes and the dbt manifests | Generated, supplemented by the data team |
| Descriptive | How the data actually behaves: distributions, quality, patterns | The EDAs, with Data Hub as the source | The owner, guided by data |
| Question and data answer | How you answer a business question with data, and what the answer is | A derivative of the data and its maturity; still to be worked out | Still to be worked out |

Data Hub carries the maturity levels according to [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch), from Beta (level 0) to Monitored (level 5), and the chart server shows the level on every chart. A lens and a report carry the lowest level of what lies beneath them. The level names are in the [glossary](../glossary.md#maturity-levels).

## From stacks to report

Data Hub offers three kinds of assets, which build on each other: the resource from the shelves, the lens you look at it through, and the report that bundles lenses around a question.

| Asset | What it is | Who makes it | Level |
| --- | --- | --- | --- |
| Resource | A registered mart view from the stacks, offered by data | Data team | 1 to 5, per resource |
| Lens | A rendering of a resource, of a fixed type, with parameters | Business | The lowest level of the resources beneath it |
| Report | One or more lenses around a question, with text and explanation | Business | The lowest level of the lenses in it |

### The stacks

- <a id="dec-dh-06"></a>**DEC-DH-06** · In `immoscoop-dataplatform-398214` there will be a dataset with the working name `dbt_prod_stacks`: the stacks. It consists only of mart views that release data to Data Hub, managed in dbt-prod. Today there is one stack; because resources are registered with their full name, more can be added later.
- <a id="dec-dh-07"></a>**DEC-DH-07** · The registration in Data Hub is the index. Putting a view in the stacks is necessary, but not sufficient: only when a data admin registers it, with a display name and a collection, is it a resource. This replaces the earlier decision "the stacks are the index". Worked out in [Stacks and resources](../requirements/functional/04-stacks-and-resources.md).
- <a id="dec-dh-08"></a>**DEC-DH-08** · The service account of Data Hub only has access to the stacks. The views in the stacks are authorized views onto the other datasets, so that the account cannot reach anything else.

### Lenses

- <a id="dec-dh-09"></a>**DEC-DH-09** · A lens is a composition by and for business: a particular rendering of an underlying resource. We deliberately do not call it a view, to avoid confusion with the views of data.
- <a id="dec-dh-10"></a>**DEC-DH-10** · A lens reflects the maturity of what lies beneath it: the lowest level of the underlying resources determines the level of the lens.
- <a id="dec-dh-11"></a>**DEC-DH-11** · A lens has parameters with which you adjust it, such as the name of a client or a start date. Parameters are named functionally and by data type, for example `dateFrom`, so that they can be combined across several lenses.
- <a id="dec-dh-12"></a>**DEC-DH-12** · From a lens you can fetch the data, or you can view it in the interface.
- <a id="dec-dh-13"></a>**DEC-DH-13** · A lens is always of a particular type, so that the visualisation in the interface complies with the chart language. An example is the funnel: from one table, a drill-down with filters, where at each step what remains stays visible.

### Reports

- <a id="dec-dh-14"></a>**DEC-DH-14** · A report bundles one or more lenses in a particular visualisation around a question, such as "how many leads have there been since …", with text and explanation. A report shares its parameters with the lenses in it.

### Visible in Data Hub and in Claude

- <a id="dec-dh-15"></a>**DEC-DH-15** · Lenses and reports look exactly the same in Claude as in Data Hub. In Claude they appear as an MCP App, an interactive window in the conversation. For that, both use the same component, so that only one version exists.

## The resource card

Just as every book in a library has a catalogue card, every resource in Data Hub gets a resource card. Part of it is derived from the manifests, the catalog and BigQuery; the rest Data Hub keeps itself.

- <a id="dec-dh-16"></a>**DEC-DH-16** · A resource gets an internal ID in Data Hub. The full name, `project.dataset.view`, is the findable key, and in addition it gets a display name, readable and unique. Renames are tracked, so that confirmations, EDAs and questions are not lost on a rename.
- <a id="dec-dh-17"></a>**DEC-DH-17** · What can be derived is not stored again as a source: descriptions, columns, lineage and usage come from their origin. Data Hub only stores what is nowhere else.
- <a id="dec-dh-18"></a>**DEC-DH-18** · Every resource card has a "known behaviour" block: intended use, pitfalls and a log of anomalies. An anomaly has a period, a description of what happened, the impact on the figures and who recorded it, so that everyone can take it into account.

| Part | What | Source |
| --- | --- | --- |
| Description and columns | Description of the table and fields, `model_type` and `grain` | Derived from manifest and catalog |
| Lineage | Where the resource comes from, also via tables that are not in Data Hub | Derived from the manifests |
| Relationships | Which fields create which relationships to other tables | Partly derived from the relationships tests in dbt, supplemented in Data Hub |
| Usage | Which lenses, reports and feeds use the resource | Derived from the job log |
| Freshness | When the data was last refreshed | Derived from BigQuery |
| Owner and collection | Which collection the resource is in, and therefore who the owner is | Data Hub |
| Publication | Whether the resource is published to the company, by whom and when | Data Hub |
| Confirmations | Who from business confirmed it and when, with the schema fingerprint of that moment | Data Hub |
| Level history | When and why the resource rose or dropped on the ladder | Data Hub |
| Log | Everything that happened to the resource, including changes deeper in the lineage, with fixed log IDs | Data Hub |
| Key fields | The fields that matter, as input for the EDA | Data Hub |
| Parameter fields | Which fields can serve as a parameter, such as `dateFrom` or `agency` | Data Hub |
| Link to the domain model | Which entity the resource represents | Data Hub |
| Known behaviour | Intended use, pitfalls and anomalies with their period | Data Hub |
| Time range | Since when the data is reliable | Data Hub |
| Questions and remarks | The conversation about the resource | Data Hub |
| EDA documentation | The exploration by the owner | Data Hub |
| Monitors | What is monitored, with which thresholds, and who gets a notification | Data Hub |
| Access classification | For example personal data, for the access axis | Data Hub |

## The dbt artifacts

What Data Hub derives comes from the artifacts of dbt: `manifest.json` and `catalog.json`. Those files are large and slow to query directly. Data Hub therefore fetches them, stores them unchanged, and processes them into searchable tables. That way the library keeps an accession register: at every prod run, it knows what changed in the collection. Worked out functionally in [Artifact registry](../requirements/functional/01-artifact-registry.md).

### Fetching

- <a id="dec-dh-19"></a>**DEC-DH-19** · Data Hub fetches the artifacts from dbt Cloud (pull), instead of the repositories delivering them (push). The production artifacts are created in the dbt Cloud jobs; the GitHub pipelines only trigger those jobs, and scheduled prod builds run independently of git.
- <a id="dec-dh-20"></a>**DEC-DH-20** · There are two dbt projects: dbt-prod and Colleciónes. Per project, one prod job is the source of the artifacts: a full build that also runs `dbt docs generate`, so that there is a `catalog.json`.
- <a id="dec-dh-21"></a>**DEC-DH-21** · We start with `manifest.json` and `catalog.json`. Other artifacts, such as `run_results.json` and `sources.json`, may follow later.
- <a id="dec-dh-22"></a>**DEC-DH-22** · After a successful run, Data Hub fetches the artifacts via the dbt Cloud Admin API and stores them unchanged in a GCS bucket, per project and per run. Old versions stay in the bucket.

### Processing

- <a id="dec-dh-23"></a>**DEC-DH-23** · Processing happens asynchronously: the artifacts are read and normalised into tables in Postgres (nodes, columns, lineage, tests), with indexes for searching by name, by free text and along the lineage in both directions.
- <a id="dec-dh-24"></a>**DEC-DH-24** · Every processing run is a version. Only when it has fully succeeded does it become the current version of that project, so that no one ever sees a half-loaded manifest.
- <a id="dec-dh-25"></a>**DEC-DH-25** · Lineage crosses the boundary between the dbt projects: processing links nodes from dbt-prod and Colleciónes to each other.

### Changes

By comparing every new version with the previous one, Data Hub sees what has changed, and follows that change through the lineage to the resources, lenses and reports that depend on it.

| Kind of change | Example | Consequence |
| --- | --- | --- |
| Description | A text on a table or field changes | In the log |
| Logic | A filter or join changes; the schema stays the same | In the log, notification to the owner |
| Type | A field gets a different data type, with the same name | In the log, notification to the owner |
| Structural | A field is added or removed, including a rename | In the log; the resource drops to Described |

- <a id="dec-dh-26"></a>**DEC-DH-26** · Only a structural change makes a resource drop: a field added or removed. As long as the field name stays the same, a changed type is not a structural change; the owner does get a notification.
- <a id="dec-dh-27"></a>**DEC-DH-27** · On a logic change, the owner gets a notification, without the level dropping.
- <a id="dec-dh-28"></a>**DEC-DH-28** · Everything goes into the log of the resource, including changes deeper in the lineage. Everyone with access to the resource can read the log.
- <a id="dec-dh-29"></a>**DEC-DH-29** · For a resource that is Monitored, Data Hub runs automatic checks after every change, following from the EDA and the monitors, to check that everything still holds after the migration.
- <a id="dec-dh-30"></a>**DEC-DH-30** · The owner gets no notification before the merge, in the pull request of the data team: today they cannot contribute anything there. We may evolve towards that, but only with a very mature business.

## How it works in practice

### How the level is determined

- <a id="dec-dh-31"></a>**DEC-DH-31** · Levels are derived from the traces that exist, not stored as a label. That way they can never get out of step with reality.
- <a id="dec-dh-32"></a>**DEC-DH-32** · The level is determined entirely in Data Hub, from level 2 upwards. Git and dbt are input, not authority.
- <a id="dec-dh-33"></a>**DEC-DH-33** · Data Hub reads the dbt manifest (descriptions and meta) and the dbt catalog (the actual columns in BigQuery). A column in the catalog without a description in the manifest means: not Described.
- <a id="dec-dh-34"></a>**DEC-DH-34** · Described requires, at a minimum: a description on the table and on every column, plus `model_type` and `grain` in `meta`. The test is automatic.
- <a id="dec-dh-35"></a>**DEC-DH-35** · At every confirmation, Data Hub stores a fingerprint of the schema from the catalog. If the schema deviates from it, the table drops to Described.
- <a id="dec-dh-36"></a>**DEC-DH-36** · Business manages everything from level 3 upwards in Data Hub, not via git: confirmations, EDAs and monitors have Data Hub as their source.
- <a id="dec-dh-37"></a>**DEC-DH-37** · Static artefacts (a rendered chart, an export) carry the level at the moment of the build, with a date and a link to the current level, one click away.

*Migration note: [DEC-DH-34](#dec-dh-34) and the Maturity and release domain differ on whether Described requires `model_type` and `grain`; see [OP-MR-03](../requirements/functional/06-maturity-and-release.md#op-mr-03).*

### Release in two steps

Release happens in two steps, and Data Hub enforces that order. The librarian registers a resource, in a collection, for the curator of that collection; the curator decides when it goes into general circulation for the rest of the company. The first two levels are a responsibility of data, the third of the owner.

- <a id="dec-dh-38"></a>**DEC-DH-38** · Step one, data to owner: the data team puts a view in the stacks, and a data admin registers it in Data Hub and adds it to a collection. With that, data makes it available to the owner of that collection. Levels 1 and 2, Available and Described, are thereby a responsibility of data.
- <a id="dec-dh-39"></a>**DEC-DH-39** · Step two, owner to company: the owner publishes the resource to the rest of the company. The first publication is only possible from Described, and is at once the first confirmation: by publishing, the owner declares that the data is correct, and the resource rises to level 3, Confirmed.
- <a id="dec-dh-40"></a>**DEC-DH-40** · Visibility follows the publication, not the level. Not published means visible to data and to the owner; published means visible to the whole company. A published resource stays published when its level later drops: the owner gets an alert, the lower level is visible everywhere, and the owner confirms again without touching the publication. That way a resource does not disappear for those who use it. This replaces the earlier decision that visibility follows the level; worked out in [Stacks and resources](../requirements/functional/04-stacks-and-resources.md).

### Collections and ownership

- <a id="dec-dh-41"></a>**DEC-DH-41** · Ownership, meaning owner units and their assignments, lives in Data Hub and never in the domain model. Owner units are Google groups following a convention; see [User management](../requirements/functional/02-user-management.md).
- <a id="dec-dh-42"></a>**DEC-DH-42** · A collection is a functional domain of Immoscoop and a concept of Data Hub, not of the domain model. We speak of a collection and not of a dataset, to avoid confusion with the datasets of BigQuery. Every collection has one owner unit and is managed by the data team; see [Collections](../requirements/functional/03-collections.md).
- <a id="dec-dh-43"></a>**DEC-DH-43** · Business can only work with what a data admin registers in Data Hub. That way data releases in a structured way. Within that offer, business chooses for itself what it takes into use, and it stays available only within Data Hub.
- <a id="dec-dh-44"></a>**DEC-DH-44** · Everything that goes outside, for example to KBC or another tool, is taken on by the data team: the lens or query from Data Hub is the specification, and it lands in dbt or the domain model.
- <a id="dec-dh-45"></a>**DEC-DH-45** · Making available and the level are independent of each other. A resource that is registered but not yet fully described is at Available, is not yet published and therefore only visible to data and the owner, and can only be published after it has been described.

### Excel

- <a id="dec-dh-46"></a>**DEC-DH-46** · Excel remains possible as a window onto Data Hub: the data of lenses is fetched as a feed via Power Query, without direct BigQuery access.
- <a id="dec-dh-47"></a>**DEC-DH-47** · In the pilot, Power Query signs in with a personal key per user, the library card, which can be revoked and renewed. Signing in with a Microsoft work account (Entra) is a possible later step.

### Infrastructure

- <a id="dec-dh-48"></a>**DEC-DH-48** · No separate GCP project and no separate dbt project for Data Hub. The stacks are a dataset in the existing project, managed in dbt-prod.
- <a id="dec-dh-49"></a>**DEC-DH-49** · The registration in Data Hub is the only list of what is released. Data Hub queries only the stacks, with its own account that has no access to other datasets; the authorized views make the connection to upstream. Costs are tracked via that account. This replaces the earlier choice to query upstream models directly.
- <a id="dec-dh-50"></a>**DEC-DH-50** · The mart views in the stacks are the only stable layer between upstream and business; no extra intermediate names come behind them. This adjusts the earlier choice to let business work on the upstream names. What the data team needs besides that is insight into where a resource is used, and Data Hub makes that visible.
- <a id="dec-dh-51"></a>**DEC-DH-51** · The data team requests that usage on demand, via the API or MCP of Data Hub. No automatic notification in the pull request.
- <a id="dec-dh-52"></a>**DEC-DH-52** · Data Hub processes the artifacts of Colleciónes and dbt-prod, so that the full lineage of every resource can be requested and searched, also by people without a dbt licence. See [The dbt artifacts](#the-dbt-artifacts) above.
- <a id="dec-dh-53"></a>**DEC-DH-53** · Data Hub runs on GCP, on Cloud Run, next to the Colleciónes server that already runs there, and close to the data it queries. The chart server stays on AWS; the two may run separately.
- <a id="dec-dh-54"></a>**DEC-DH-54** · Data Hub is built in Node with TypeScript.

### Storage

- <a id="dec-dh-55"></a>**DEC-DH-55** · Data Hub stores its resource cards, lenses, reports and conversations in a relational database: Postgres on Cloud SQL, in GCP next to Data Hub on Cloud Run. A relational database suits a catalogue full of relationships: searching along different paths, relationships in two directions, free text and overlapping periods.
- <a id="dec-dh-56"></a>**DEC-DH-56** · The Firestore of Colleciónes and the Postgres of Data Hub are intrinsically two different stores. Firestore keeps the entidades, the entities created in Colleciónes; Postgres keeps what Data Hub knows about the data. They are not mixed up: Data Hub reads Colleciónes only via the manifests or the API of the Colleciónes server, never directly from Firestore.
- <a id="dec-dh-57"></a>**DEC-DH-57** · History, such as confirmations, level changes and anomalies, is kept append-only: nothing is overwritten, in the same spirit as the SCD approach in Domain Hub.
- <a id="dec-dh-58"></a>**DEC-DH-58** · BigQuery is not a store for the resource cards: it is made for analysis, not for many small writes.
- <a id="dec-dh-59"></a>**DEC-DH-59** · The database schema is versioned in the Data Hub repository, as migrations that run in a separate step at deploy, before the new version goes live. Horizontal scalability is not a requirement for this internal tool.

### How business works with it

Three entry points to the same shelves:

| Entry point | What you do |
| --- | --- |
| Resource | You open a resource, read its resource card and see the full lineage behind it. |
| Catalogue | You search the catalogue, as in a library, and get back everything that fits: resources, lenses and reports. |
| Domain model | You navigate through the domain model to an entity. For that, the entities must be findable in the manifest of the dbt project of the domain model, so that the two can be mapped onto each other in different views. |

For every resource, the description, the maturity level and all the artefacts around it are defined. From there, business can start asking questions and turn them into lenses and reports.

## Relation to existing work

- This page deepens what [EDA: understanding data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168) (Confluence, Dutch) still calls the data server: there it knows the dbt manifest, reads the EDA documents from the repository and guards the access axis. Here lenses, reports, communication and the maturity levels are added, and EDAs move to Data Hub as their source.
- [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch) describes the distinction between the domain model and Data Hub: the domain model describes the entities of the business and only produces dbt artifacts; Data Hub describes the data. Owner units, collections and the promotion loop are worked out there from the point of view of Data Hub. The anomalies on the resource card are the end point of the defensive trigger for refinement described there.
- [Chart server - Environments and documentation](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361412109) (Confluence, Dutch) is the chart server Data Hub works with.
- [Functional domains](../requirements/functional/README.md) works out Data Hub functionally, domain by domain.

## Open themes

The themes still to be worked out, and the points to clarify in the analysis, are in [Open themes](open-themes.md).

## Builds on

- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [EDA: understanding data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168) (Confluence, Dutch)
- [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch)
