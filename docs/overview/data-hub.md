# Data Hub

| | |
| --- | --- |
| Type | Working document |
| Tags | strategy, context, decision |
| Area | Tooling, Technical |
| Status | Idea |
| Repository | [immoscoop-dataplatform-datahub](https://github.com/immoscoop-be/immoscoop-dataplatform-datahub) |
| Source of truth | This file. On Confluence the source of truth was "this page, until there is a functional and technical analysis"; that analysis is now built up under [requirements](../requirements/README.md). |
| Migrated from | [ptditt - Tooling - Data Hub](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1362428000) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17 |

**In one sentence:** Data Hub is the library of our data: the one entry point for business colleagues and their Claude, next to and together with the Chart Server. All data in the company runs through Data Hub.

*Built up from conversations with Max, on 2026-10-07 and later, about documentation in ptditt. This is a direction, not a design. Earlier we spoke of "the data server", "the data tool" and "Data-Desk"; since 2026-10-12 it has been called Data Hub, next to Domain Hub. Whether Data Hub stays a separate application or merges with Domain Hub is still open. The functional elaboration per domain is in [Functional domains](../requirements/functional/README.md).*

- <a id="dec-dh-01"></a>**DEC-DH-01** · The name is Data Hub, next to Domain Hub: Domain Hub for the meaning, Data Hub for the data. The image behind it is a library, with the Data Team as librarian and the Stacks as shelves.
- <a id="dec-dh-02"></a>**DEC-DH-02** · The app is entirely in English: the interface, the names and the texts of the Log. The documentation on Confluence stays in Dutch. *Note of 2026-10-25: the language principle Max proposed keeps names English and puts sentences in the language of the User ([localisation](../requirements/non-functional/localisation.md)); whether it replaces this decision is [OP-DH-43](open-themes.md#op-dh-43).* *Note of 2026-10-25: replaced by [DEC-DH-65](#dec-dh-65).*
- <a id="dec-dh-65"></a>**DEC-DH-65** · The language principle applies: names are English and never translated; sentences are in the language of the User, Dutch by default with English available ([localisation](../requirements/non-functional/localisation.md)). A name is a term of the Domain Model, a kind of asset or a level, a name of a field, column, status or Query ID, or a name a User gives. The interface, notifications, Pre-flights and the texts of the Log are sentences. This replaces [DEC-DH-02](#dec-dh-02). *Decided on 2026-10-25, by Max ([OP-DH-43](open-themes.md#op-dh-43)).*
- <a id="dec-dh-66"></a>**DEC-DH-66** · A column that disappears from a Resource simply no longer exists: everything downstream that needs it, such as a Lens or a query, stops working, without special handling. The Change itself is in the Log and gives a warning on the Resource ([DEC-MR-08](../requirements/functional/06-maturity-and-release.md#dec-mr-08)). Deregistering a Resource does not happen yet. *Decided on 2026-10-27, by Max ([OP-DH-21](open-themes.md#op-dh-21)).* *Note of 2026-10-28: what stops working is now marked Broken, flagged, and its Owner told ([DEC-DH-67](#dec-dh-67)); "without special handling" no longer holds.*
- <a id="dec-dh-67"></a>**DEC-DH-67** · A Lens, Report, feed or query that reads a Resource or a column that no longer exists is Broken. It cannot run any more; it carries a red dot wherever it is listed, for everyone who sees it; and its Owner gets a Message for each Broken asset: the Owner Unit of a Lens or a Report, who made a query. A Resource no longer exists when it is withdrawn ([DEC-SR-26](../requirements/functional/04-stacks-and-resources.md#dec-sr-26)) or its table is not found in BigQuery; a renamed Resource is a withdrawn one and a new one ([EC-SR-03](../requirements/functional/04-stacks-and-resources.md#ec-sr-03)). A Report is Broken when one of its Lenses is. Once everything it reads exists again, it works again by itself, and its Owner is told. Data Hub notices it after every dbt run, in a daily check and when a run fails ([FR-SR-52](../requirements/functional/04-stacks-and-resources.md#fr-sr-52)). *Decided on 2026-10-28, by Max ([OP-DH-03](open-themes.md#op-dh-03)).*
- <a id="dec-dh-68"></a>**DEC-DH-68** · Which Resources a Lens, Report, feed, query or EDA uses is part of the data model of Data Hub, in its database: each points to the Resources it reads, and a Report to its Lenses. An EDA belongs to one Resource and may point to others. Data Hub thus knows per Resource what uses it, without reading the BigQuery job log. *Decided on 2026-10-28, by Max ([OP-DH-04](open-themes.md#op-dh-04)).*
- <a id="dec-dh-69"></a>**DEC-DH-69** · Data Hub asks for no dbt model contract. Whether a model carries one, and whether it is enforced, is managed in dbt by the Data Team. What Data Hub counts are the descriptions from dbt: without them a Resource stays at Available ([DEC-MR-10](../requirements/functional/06-maturity-and-release.md#dec-mr-10)). *Decided on 2026-10-28, by Max ([OP-DH-05](open-themes.md#op-dh-05)).*

*Migration note: the documentation has since moved to this repository, in English. The Confluence pages remain in Dutch.*

## Data Hub as a library

Whoever explains Data Hub can best start from a library. Most terms on this page have a counterpart there. The full list of terms is in the [definitions](../definitions.md).

| In the library | In Data Hub |
| --- | --- |
| The librarian | The Data Team: takes data in, describes it and puts it on the shelves |
| The shelves | The tables an exposure with the tag `datahub` makes Resources: what may be released |
| Registering a book | The Registration of a Resource by a Data Admin: only then does it exist for Data Hub |
| A book on the shelves | A Resource |
| General circulation | A published Resource: the curator has released it for the whole company |
| A collection | A functional domain of Immoscoop in which Resources sit together, such as leads or agencies |
| The catalogue card | The Resource Card: everything we know about one book |
| The catalogue | Searching and browsing in Data Hub, via table, Catalogue or Domain Model |
| The accession register | The dbt Artifacts: what changed in the collection, at every prod run |
| The curator of a collection | The Owner, who vouches for a Collection and confirms its Resources |
| The library card | The Excel key: the personal key with which Excel signs in |
| The reading room | Where business makes Lenses and Reports |
| The magnifying glass | A Lens: a way of looking at one Resource |
| The dossier | A Report: Lenses bundled around one question |
| Margin notes | The conversation between colleagues, attached to the object it is about |
| Collection management and weeding | Registering and deregistering Resources, and adding them to or removing them from Collections |

## Why

The first readers of our documentation are business colleagues and Claude. They largely ask the same things (what does this mean, may I use it this way, what is not in it), the one by reading, the other by querying.

Part of that knowledge already exists, in Colleciónes and the dbt manifests, but it sits behind the wrong door. Claude only gets to know the Domain Model through the dbt plugin, and that is available to three people today. The rest of the business, and their Claude, have to rely on names and descriptions in BigQuery. That breeds misunderstandings, such as a mart built for one BI application being used for another analysis, or an event table being read as a state.

- <a id="dec-dh-03"></a>**DEC-DH-03** · Descriptions in BigQuery are not sufficient as a carrier for documentation.
- <a id="dec-dh-04"></a>**DEC-DH-04** · Handing out dbt licences to everyone who wants to work with data is not feasible within the budget.
- <a id="dec-dh-05"></a>**DEC-DH-05** · We choose our own application, Data Hub, as the one entry point, next to and together with the Chart Server.

## What Data Hub does

| Function | What |
| --- | --- |
| Connectivity | Access to the Resources, for people and for Claude. |
| Documentation | What is on the shelves and how you may use it: the Resource Card of every Resource, with field descriptions, EDA results and questions with their data answer. We determine the exact scope in the analysis. |
| Keeping | Storing Lenses and Reports, together with the Chart Server. |
| Communication | Colleagues talk to each other about data, and that conversation stays attached as a margin note to the object it is about. |

## Three forms of documentation

| Form | What it tells | Where it comes from | Who writes it |
| --- | --- | --- | --- |
| Structural | Model type (event, state, dimension, mart), grain, lineage, fields | Derivable from Colleciónes and the dbt manifests | Generated, supplemented by the Data Team |
| Descriptive | How the data actually behaves: distributions, quality, patterns | The EDAs, with Data Hub as the source | The Owner, guided by the Data Team |
| Question and data answer | How you answer a business question with data, and what the answer is | A derivative of the data and its maturity; still to be worked out | Still to be worked out |

Data Hub carries the maturity Levels according to [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch), from Beta (Level 0) to Monitored (Level 5), and the Chart Server shows the Level on every chart. A Lens and a Report carry the lowest Level of what lies beneath them. The Level names are in the [definitions](../definitions.md#maturity-levels).

## From Resource to Report

Data Hub offers three kinds of assets, which build on each other: the Resource from the shelves, the Lens you look at it through, and the Report that bundles Lenses around a question.

| Asset | What it is | Who makes it | Level |
| --- | --- | --- | --- |
| Resource | A table of a dbt project, exposed with the tag `datahub` and offered by the Data Team | Data Team | 1 to 5, per Resource |
| Lens | A rendering of a Resource, of a fixed type, with Parameters | Business | The lowest Level of the Resources beneath it |
| Report | One or more Lenses around a question, with text and explanation | Business | The lowest Level of the Lenses in it |

- <a id="dec-dh-64"></a>**DEC-DH-64** · Data Hub has four kinds of assets: next to the Resource, the Lens and the Report above, the chart, a semgraph that the Chart Server draws on a Lens or a Resource, with the Level of what lies beneath it ([DEC-DH-37](#dec-dh-37)). A Collection is not an asset: it is the container that groups Resources under an Owner, and has no Level of its own. This extends the three kinds above. *Decided on 2026-10-22, after the [workshop on data agents and governance](../workshops/2026-10-22-data-agents-and-governance.md#req-dh-assets) ([OP-DH-38](open-themes.md#op-dh-38)).* *Note of 2026-10-23: a Collection also holds the Lenses its Owner Unit adds ([DEC-CO-15](../requirements/functional/03-collections.md#dec-co-15)).*

### Where Resources come from

- <a id="dec-dh-71"></a>**DEC-DH-71** · The word Stacks is no longer used. It named a curated dataset of mart views, `dbt_prod_stacks`; since a table becomes a Resource through an exposure with the tag `datahub` on any model ([DEC-SR-22](../requirements/functional/04-stacks-and-resources.md#dec-sr-22), [DEC-SR-23](../requirements/functional/04-stacks-and-resources.md#dec-sr-23)), there is no such dataset. Where the decisions below and other older decisions say the Stacks, read: the tables that are Resources. *Decided on 2026-10-28, by Max ([OP-DH-47](open-themes.md#op-dh-47)).*
- <a id="dec-dh-73"></a>**DEC-DH-73** · A Resource can be any dbt model, in any layer, staging, intermediate or mart, and in any dbt project Data Hub follows, dbt-prod or Colleciónes: an exposure with the tag `datahub` on it is all it takes ([DEC-SR-22](../requirements/functional/04-stacks-and-resources.md#dec-sr-22), [DEC-SR-23](../requirements/functional/04-stacks-and-resources.md#dec-sr-23)). There is no dataset to name: where its table sits is abstract to Data Hub. *Decided on 2026-10-28, by Max ([OP-DH-13](open-themes.md#op-dh-13)).*
- <a id="dec-dh-74"></a>**DEC-DH-74** · What is built today may be thrown away. The design and the rebuild need not stay compatible with it: not with its code, its schema in Postgres or its data. *Decided on 2026-10-28, by Max ([OP-DH-14](open-themes.md#op-dh-14)).*
- <a id="dec-dh-76"></a>**DEC-DH-76** · The schema of the Resource Card in Postgres, and of the rest of Data Hub, follows from the functional requirements and is made when building. The rebuild starts from a fresh database: no migration from what is built today. From then on, every change to the schema is a migration, as the repository asks. *Decided on 2026-10-28, by Max ([OP-DH-14](open-themes.md#op-dh-14)).*
- <a id="dec-dh-77"></a>**DEC-DH-77** · What a User sees through Data Hub follows from Collections and Owner Units alone: everything that is public, and everything in the private Collections whose Owner Unit they belong to ([DEC-CO-10](../requirements/functional/03-collections.md#dec-co-10), [DEC-CO-12](../requirements/functional/03-collections.md#dec-co-12)). The Data Team sees every Collection ([DEC-CO-11](../requirements/functional/03-collections.md#dec-co-11)). There is no further access axis; confidentiality, should it come, is worked out first as a concept ([OP-PL-01](../requirements/functional/12-permissions-and-library-cards.md#op-pl-01)). *Decided on 2026-10-28, by Max ([OP-DH-22](open-themes.md#op-dh-22)).*
- <a id="dec-dh-78"></a>**DEC-DH-78** · Data Hub has two roles, Owner and Reader, and the Data Admin above them. A User is the Owner of every asset in the Collections of their Owner Unit: its Resources and its Lenses, also a Lens made by a colleague, as a Lens always goes into a Collection its author owns ([DEC-CO-20](../requirements/functional/03-collections.md#dec-co-20)); and of the queries they made. Of everything else they see ([DEC-DH-77](#dec-dh-77)) they are a Reader. A Data Admin can access everything. *Decided on 2026-10-28, by Max ([OP-DH-24](open-themes.md#op-dh-24)).*
- <a id="dec-dh-79"></a>**DEC-DH-79** · The personal key with which Excel signs in is called the Excel key, no longer the Library Card. A User makes one on My page, names it after where it is used, and sees it once, to copy. My page lists their keys with when each was last used, and revokes one; renewing is revoking and making a new one. A key lasts a year, and stops at once when its User can no longer sign in with Google. The Data Team can revoke any key ([FR-PL-01](../requirements/functional/12-permissions-and-library-cards.md#fr-pl-01) to [FR-PL-03](../requirements/functional/12-permissions-and-library-cards.md#fr-pl-03)). *Decided on 2026-10-28, by Max ([OP-DH-25](open-themes.md#op-dh-25)).*
- <a id="dec-dh-82"></a>**DEC-DH-82** · Data Hub stays a separate application next to Domain Hub: Domain Hub for the meaning, Data Hub for the data ([DEC-DH-01](#dec-dh-01)). It reads the Domain Model that Domain Hub delivers ([FR-AR-15](../requirements/functional/01-artifact-registry.md#fr-ar-15)), and does not merge with it. *Decided on 2026-10-28, by Max ([OP-DH-31](open-themes.md#op-dh-31)).*
- <a id="dec-dh-75"></a>**DEC-DH-75** · Everything about usage reporting on Data Hub is not part of v1: who uses what, the Usage tab of a Resource, and reporting on the Catalogue. It is a Could, after the first build ([Could: not in v1](../requirements/README.md#could-not-in-v1)). *Decided on 2026-10-28, by Max ([OP-DH-16](open-themes.md#op-dh-16)).*

- <a id="dec-dh-06"></a>**DEC-DH-06** · In `immoscoop-dataplatform-398214` there will be a dataset with the working name `dbt_prod_stacks`: the Stacks. It consists only of mart views that release data to Data Hub, managed in dbt-prod. Today there is one Stack; because Resources are registered with their full name, more can be added later. *Note of 2026-10-28: there is no such dataset ([DEC-DH-71](#dec-dh-71), [DEC-DH-73](#dec-dh-73)).*
- <a id="dec-dh-07"></a>**DEC-DH-07** · The Registration in Data Hub is the index. Putting a view in the Stacks is necessary, but not sufficient: only when a Data Admin registers it, with a Display Name and a Collection, is it a Resource. This replaces the earlier decision "the Stacks are the index". Worked out in [Resources](../requirements/functional/04-stacks-and-resources.md).
- <a id="dec-dh-08"></a>**DEC-DH-08** · The service account of Data Hub only has access to the Stacks. The views in the Stacks are authorized views onto the other datasets, so that the account cannot reach anything else. *Note of 2026-10-26: replaced by [DEC-SR-32](../requirements/functional/04-stacks-and-resources.md#dec-sr-32): the service account of Data Hub reads every table in the GCP projects of the dbt projects it follows; there is no curated Stack to limit it to.*

### Lenses

- <a id="dec-dh-09"></a>**DEC-DH-09** · A Lens is a composition by and for business: a particular rendering of an underlying Resource. We deliberately do not call it a view, to avoid confusion with the views of the Data Team.
- <a id="dec-dh-10"></a>**DEC-DH-10** · A Lens reflects the maturity of what lies beneath it: the lowest Level of the underlying Resources determines the Level of the Lens.
- <a id="dec-dh-11"></a>**DEC-DH-11** · A Lens has Parameters with which you adjust it, such as the name of a client or a start date. Parameters are named functionally and by data type, for example `dateFrom`, so that they can be combined across several Lenses.
- <a id="dec-dh-12"></a>**DEC-DH-12** · From a Lens you can fetch the data, or you can view it in the interface.
- <a id="dec-dh-13"></a>**DEC-DH-13** · A Lens is always of a particular type, so that the visualisation in the interface complies with the chart language. An example is the funnel: from one table, a drill-down with filters, where at each step what remains stays visible. *Note of 2026-10-28: a Lens has no type from a fixed list; it is a query with its Parameters ([DEC-LE-06](../requirements/functional/09-lenses.md#dec-le-06)).* *Note of 2026-10-28: in v1 a Lens shows a table, no chart ([DEC-LE-08](../requirements/functional/09-lenses.md#dec-le-08)).*

### Reports

- <a id="dec-dh-14"></a>**DEC-DH-14** · A Report bundles one or more Lenses in a particular visualisation around a question, such as "how many leads have there been since …", with text and explanation. A Report shares its Parameters with the Lenses in it.

### Visible in Data Hub and in Claude

- <a id="dec-dh-15"></a>**DEC-DH-15** · Lenses and Reports look exactly the same in Claude as in Data Hub. In Claude they appear as an MCP App, an interactive window in the conversation. For that, both use the same component, so that only one version exists. *Note of 2026-10-28: Claude comes in version 2 ([DEC-CH-02](../requirements/functional/13-channels.md#dec-ch-02)).*

## The Resource Card

Just as every book in a library has a catalogue card, every Resource in Data Hub gets a Resource Card. Part of it is derived from the manifests, the catalog and BigQuery; the rest Data Hub keeps itself.

- <a id="dec-dh-16"></a>**DEC-DH-16** · A Resource gets an internal ID in Data Hub. The full name, `project.dataset.view`, is the findable Key, and in addition it gets a Display Name, readable and unique. Renames are tracked, so that Confirmations, EDAs and Questions are not lost on a rename.
- <a id="dec-dh-17"></a>**DEC-DH-17** · What can be derived is not stored again as a source: descriptions, columns, lineage and usage come from their origin. Data Hub only stores what is nowhere else.
- <a id="dec-dh-18"></a>**DEC-DH-18** · Every Resource Card has a "Known Behaviour" block: intended use, pitfalls and a log of Anomalies. An Anomaly has a period, a description of what happened, the impact on the figures and who recorded it, so that everyone can take it into account.

| Part | What | Source |
| --- | --- | --- |
| Description and columns | Description of the table and fields, `model_type` and `grain` | Derived from manifest and catalog |
| Lineage | Where the Resource comes from, also via tables that are not in Data Hub | Derived from the manifests |
| Relationships | Which fields create which relationships to other tables | Partly derived from the relationships tests in dbt, supplemented in Data Hub |
| Usage | Which Lenses, Reports and feeds use the Resource | Derived from the job log |
| Freshness | When the data was last refreshed | Derived from BigQuery |
| Owner and Collection | Which Collection the Resource is in, and therefore who the Owner is | Data Hub |
| Publication | Whether the Resource is published to the company, by whom and when | Data Hub |
| Confirmations | Who from business confirmed it and when, with the schema Fingerprint of that moment | Data Hub |
| Level history | When and why the Resource rose or dropped on the ladder | Data Hub |
| Log | Everything that happened to the Resource, including Changes deeper in the lineage, with fixed Log IDs | Data Hub |
| Key fields | The fields that matter, as input for the EDA | Data Hub |
| Parameter fields | Which fields can serve as a Parameter, such as `dateFrom` or `agency` | Data Hub |
| Link to the Domain Model | Which Entity the Resource represents | Data Hub |
| Known Behaviour | Intended use, pitfalls and Anomalies with their period | Data Hub |
| Time range | Since when the data is reliable | Data Hub |
| Questions and Remarks | The conversation about the Resource | Data Hub |
| EDA documentation | The exploration by the Owner | Data Hub |
| Monitors | What is monitored, with which thresholds, and who gets a notification | Data Hub |
| Access classification | For example personal data, for the access axis | Data Hub |

## The dbt Artifacts

What Data Hub derives comes from the Artifacts of dbt: `manifest.json` and `catalog.json`. Those files are large and slow to query directly. Data Hub therefore fetches them, stores them unchanged, and processes them into searchable tables. That way the library keeps an accession register: at every prod run, it knows what changed in the collection. Worked out functionally in [Artifact registry](../requirements/functional/01-artifact-registry.md).

### Fetching

- <a id="dec-dh-19"></a>**DEC-DH-19** · Data Hub fetches the Artifacts from dbt Cloud (pull), instead of the repositories delivering them (push). The production Artifacts are created in the dbt Cloud jobs; the GitHub pipelines only trigger those jobs, and scheduled prod builds run independently of git.
- <a id="dec-dh-20"></a>**DEC-DH-20** · There are two dbt projects: dbt-prod and Colleciónes. Per project, one prod job is the source of the Artifacts: a full build that also runs `dbt docs generate`, so that there is a `catalog.json`.
- <a id="dec-dh-21"></a>**DEC-DH-21** · We start with `manifest.json` and `catalog.json`. Other Artifacts, such as `run_results.json` and `sources.json`, may follow later.
- <a id="dec-dh-22"></a>**DEC-DH-22** · After a successful run, Data Hub fetches the Artifacts via the dbt Cloud Admin API and stores them unchanged in a GCS bucket, per project and per run. Old versions stay in the bucket.

### Processing

- <a id="dec-dh-23"></a>**DEC-DH-23** · Processing happens asynchronously: the Artifacts are read and normalised into tables in Postgres (Nodes, columns, lineage, tests), with indexes for searching by name, by free text and along the lineage in both directions.
- <a id="dec-dh-24"></a>**DEC-DH-24** · Every processing run is a version. Only when it has fully succeeded does it become the Current Version of that project, so that no one ever sees a half-loaded manifest.
- <a id="dec-dh-25"></a>**DEC-DH-25** · Lineage crosses the boundary between the dbt projects: processing links Nodes from dbt-prod and Colleciónes to each other.

### Changes

By comparing every new version with the previous one, Data Hub sees what has changed, and follows that Change through the lineage to the Resources, Lenses and Reports that depend on it.

| Kind of Change | Example | Consequence |
| --- | --- | --- |
| Description | A text on a table or field changes | In the Log |
| Logic | A filter or join changes; the schema stays the same | In the Log, notification to the Owner |
| Type | A field gets a different data type, with the same name | In the Log, notification to the Owner |
| Structural | A field is added or removed, including a rename | In the Log; a warning on the Resource, the Level stays ([DEC-MR-08](../requirements/functional/06-maturity-and-release.md#dec-mr-08)) |

- <a id="dec-dh-26"></a>**DEC-DH-26** · Only a structural Change makes a Resource drop: a field added or removed. As long as the field name stays the same, a changed type is not a structural Change; the Owner does get a notification. *Note of 2026-10-26: a change to the schema never lowers the Level; it gives a warning on the Resource and a Message to the Owner ([DEC-MR-08](../requirements/functional/06-maturity-and-release.md#dec-mr-08)).*
- <a id="dec-dh-27"></a>**DEC-DH-27** · On a logic Change, the Owner gets a notification, without the Level dropping.
- <a id="dec-dh-28"></a>**DEC-DH-28** · Everything goes into the Log of the Resource, including Changes deeper in the lineage. Everyone with access to the Resource can read the Log.
- <a id="dec-dh-29"></a>**DEC-DH-29** · For a Resource that is Monitored, Data Hub runs automatic checks after every Change, following from the EDA and the monitors, to check that everything still holds after the migration.
- <a id="dec-dh-30"></a>**DEC-DH-30** · The Owner gets no notification before the merge, in the pull request of the Data Team: today they cannot contribute anything there. We may evolve towards that, but only with a very mature business.

## How it works in practice

### How the Level is determined

- <a id="dec-dh-31"></a>**DEC-DH-31** · Levels are derived from the traces that exist, not stored as a label. That way they can never get out of step with reality.
- <a id="dec-dh-32"></a>**DEC-DH-32** · The Level is determined entirely in Data Hub, from Level 2 upwards. Git and dbt are input, not authority.
- <a id="dec-dh-33"></a>**DEC-DH-33** · Data Hub reads the dbt manifest (descriptions and meta) and the dbt catalog (the actual columns in BigQuery). A column in the catalog without a description in the manifest means: not Described. *Note of 2026-10-28: a column without a description no longer keeps a Resource from Described, if the table and another field have one ([DEC-MR-11](../requirements/functional/06-maturity-and-release.md#dec-mr-11)).*
- <a id="dec-dh-34"></a>**DEC-DH-34** · Described requires, at a minimum: a description on the table and on every column, plus `model_type` and `grain` in `meta`. The test is automatic. *Note of 2026-10-28: the table and at least one field, not every column; `model_type` and `grain` stay ([DEC-MR-11](../requirements/functional/06-maturity-and-release.md#dec-mr-11)).* *Note of 2026-10-28: and no `model_type` or `grain` from dbt ([DEC-MR-12](../requirements/functional/06-maturity-and-release.md#dec-mr-12)).*
- <a id="dec-dh-35"></a>**DEC-DH-35** · At every Confirmation, Data Hub stores a Fingerprint of the schema from the catalog. If the schema deviates from it, the table drops to Described. *Note of 2026-10-26: a change to the schema never lowers the Level; it gives a warning on the Resource and a Message to the Owner ([DEC-MR-08](../requirements/functional/06-maturity-and-release.md#dec-mr-08)).*
- <a id="dec-dh-36"></a>**DEC-DH-36** · Business manages everything from Level 3 upwards in Data Hub, not via git: Confirmations, EDAs and monitors have Data Hub as their source.
- <a id="dec-dh-37"></a>**DEC-DH-37** · Static artefacts (a rendered chart, an export) carry the Level at the moment of the build, with a date and a link to the current Level, one click away.

*Migration note: [DEC-DH-34](#dec-dh-34) and the Maturity and release domain differ on whether Described requires `model_type` and `grain`; see [OP-MR-03](../requirements/functional/06-maturity-and-release.md#op-mr-03).*

### Release in two steps

Release happens in two steps, and Data Hub enforces that order. The librarian registers a Resource, in a Collection, for the curator of that Collection; the curator decides when it goes into general circulation for the rest of the company. The first two Levels are a responsibility of the Data Team, the third of the Owner.

- <a id="dec-dh-38"></a>**DEC-DH-38** · Step one, Data Team to Owner: the Data Team puts a view in the Stacks, and a Data Admin registers it in Data Hub and adds it to a Collection. With that, the Data Team makes it available to the Owner of that Collection. Levels 1 and 2, Available and Described, are thereby a responsibility of the Data Team. *Note of 2026-10-19: the Data Team registers a table with an exposure in its dbt project, without a Stack, and adds it to a Collection in Data Hub ([DEC-SR-22](../requirements/functional/04-stacks-and-resources.md#dec-sr-22), [DEC-SR-23](../requirements/functional/04-stacks-and-resources.md#dec-sr-23)).*
- <a id="dec-dh-39"></a>**DEC-DH-39** · Step two, Owner to company: the Owner publishes the Resource to the rest of the company. The first Publication is only possible from Described, and is at once the first Confirmation: by publishing, the Owner declares that the data is correct, and the Resource rises to Level 3, Confirmed. *Note of 2026-10-26: the Owner declares what the Resource is and what it stands for, not that its data is correct; the data is for the EDA ([DEC-MR-07](../requirements/functional/06-maturity-and-release.md#dec-mr-07)).*
- <a id="dec-dh-40"></a>**DEC-DH-40** · Visibility follows the Publication, not the Level. Not published means visible to the Data Team and to the Owner; published means visible to the whole company. A published Resource stays published when its Level later drops: the Owner gets an alert, the lower Level is visible everywhere, and the Owner confirms again without touching the Publication. That way a Resource does not disappear for those who use it. This replaces the earlier decision that visibility follows the Level; worked out in [Resources](../requirements/functional/04-stacks-and-resources.md). *Note of 2026-10-19: published means visible to everyone who sees the Collection, which is the whole company only for a public Collection ([DEC-CO-12](../requirements/functional/03-collections.md#dec-co-12)).*

### From exposure to Lens

How data comes into Data Hub and becomes a Lens for the company, in seven steps, as Max described it on 2026-10-23. It carries the [Release in two steps](#release-in-two-steps) on into Query and Lenses. The [walkthrough on Confluence](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1380253717) shows each step with its screens, to present the flow.

1. **The Data Team exposes a table in dbt,** with an exposure with the tag `datahub`. Merging it registers a Resource, without a Collection yet ([DEC-SR-22](../requirements/functional/04-stacks-and-resources.md#dec-sr-22)).
2. **The Data Team adds it to a Collection.** A Data Admin adds the Resource to a Collection, which makes it available to the Owner of that Collection ([DEC-DH-38](#dec-dh-38)).
3. **The Owner takes control.** The page of the Collection shows the Owner what waits for them ([FR-CO-25](../requirements/functional/03-collections.md#fr-co-25)).
4. **The Owner checks the data and describes it and its fields,** with the Preview and on the page of the Resource ([FR-SR-38](../requirements/functional/04-stacks-and-resources.md#fr-sr-38), [DEC-UX-09](../design/principles.md#dec-ux-09)).
5. **The Owner publishes the Resource.** The first Publication is the first Confirmation, and the Resource becomes visible to everyone who sees the Collection ([DEC-DH-39](#dec-dh-39), [DEC-DH-40](#dec-dh-40)). A sheet on the page of the Resource says who will see it and asks for the Confirmation ([FR-SR-49](../requirements/functional/04-stacks-and-resources.md#fr-sr-49)).
6. **The Owner and colleagues query it,** in Query, together with other Resources they may see ([FR-SR-41](../requirements/functional/04-stacks-and-resources.md#fr-sr-41), [FR-SR-46](../requirements/functional/04-stacks-and-resources.md#fr-sr-46)).
7. **A query becomes a Lens.** With "Make it a lens" and once its size is checked, the Lens is published for everyone who may use its Resources ([FR-LE-07](../requirements/functional/09-lenses.md#fr-le-07), [FR-LE-08](../requirements/functional/09-lenses.md#fr-le-08), [DEC-CO-16](../requirements/functional/03-collections.md#dec-co-16)). Colleagues find it in the section Lenses ([FR-LE-15](../requirements/functional/09-lenses.md#fr-le-15)).

### Collections and ownership

- <a id="dec-dh-41"></a>**DEC-DH-41** · Ownership, meaning Owner Units and their assignments, lives in Data Hub and never in the Domain Model. Owner Units are Google groups following a convention; see [User management](../requirements/functional/02-user-management.md). *Note of 2026-10-19: any Google group of the own Workspace domain can be an Owner Unit, without a convention ([DEC-CO-09](../requirements/functional/03-collections.md#dec-co-09)).*
- <a id="dec-dh-42"></a>**DEC-DH-42** · A Collection is a functional domain of Immoscoop and a concept of Data Hub, not of the Domain Model. We speak of a Collection and not of a dataset, to avoid confusion with the datasets of BigQuery. Every Collection has one Owner Unit and is managed by the Data Team; see [Collections](../requirements/functional/03-collections.md). *Note of 2026-10-19: anyone creates a Collection, and its Owner Unit manages it together with the Data Team; a Collection is private or public ([DEC-CO-08](../requirements/functional/03-collections.md#dec-co-08), [DEC-CO-10](../requirements/functional/03-collections.md#dec-co-10)).*
- <a id="dec-dh-43"></a>**DEC-DH-43** · Business can only work with what a Data Admin registers in Data Hub. That way the Data Team releases in a structured way. Within that offer, business chooses for itself what it takes into use, and it stays available only within Data Hub. *Note of 2026-10-19: what the Data Team registers is what it exposes with the tag `datahub` in its dbt projects ([DEC-SR-22](../requirements/functional/04-stacks-and-resources.md#dec-sr-22)).*
- <a id="dec-dh-44"></a>**DEC-DH-44** · Everything that goes outside, for example to KBC or another tool, is taken on by the Data Team: the Lens or query from Data Hub is the specification, and it lands in dbt or the Domain Model.
- <a id="dec-dh-45"></a>**DEC-DH-45** · Making available and the Level are independent of each other. A Resource that is registered but not yet fully described is at Available, is not yet published and therefore only visible to the Data Team and the Owner, and can only be published after it has been described.

### Excel

- <a id="dec-dh-46"></a>**DEC-DH-46** · Excel remains possible as a window onto Data Hub: the data of Lenses is fetched as a feed via Power Query, without direct BigQuery access. *Note of 2026-10-28: with the Parameters at their default values, as data only ([DEC-CH-03](../requirements/functional/13-channels.md#dec-ch-03)).*
- <a id="dec-dh-47"></a>**DEC-DH-47** · In the pilot, Power Query signs in with a personal key per User, the Excel key, which can be revoked and renewed. Signing in with a Microsoft work account (Entra) is a possible later step. *Note of 2026-10-28: the Library Card is now called the Excel key, and how a User makes, revokes and renews one is decided ([DEC-DH-79](#dec-dh-79)).*

### Infrastructure

- <a id="dec-dh-48"></a>**DEC-DH-48** · No separate GCP project and no separate dbt project for Data Hub. The Stacks are a dataset in the existing project, managed in dbt-prod.
- <a id="dec-dh-49"></a>**DEC-DH-49** · The Registration in Data Hub is the only list of what is released. Data Hub queries only the Stacks, with its own account that has no access to other datasets; the authorized views make the connection to upstream. Costs are tracked via that account. This replaces the earlier choice to query upstream models directly.
- <a id="dec-dh-50"></a>**DEC-DH-50** · The mart views in the Stacks are the only stable layer between upstream and business; no extra intermediate names come behind them. This adjusts the earlier choice to let business work on the upstream names. What the Data Team needs besides that is insight into where a Resource is used, and Data Hub makes that visible.
- <a id="dec-dh-51"></a>**DEC-DH-51** · The Data Team requests that usage on demand, via the API or MCP of Data Hub. No automatic notification in the pull request.
- <a id="dec-dh-52"></a>**DEC-DH-52** · Data Hub processes the Artifacts of Colleciónes and dbt-prod, so that the full lineage of every Resource can be requested and searched, also by people without a dbt licence. See [The dbt Artifacts](#the-dbt-artifacts) above.
- <a id="dec-dh-53"></a>**DEC-DH-53** · Data Hub runs on GCP, on Cloud Run, next to the Colleciónes server that already runs there, and close to the data it queries. The Chart Server stays on AWS; the two may run separately. *Note of 2026-10-18: the Chart Server becomes part of Data Hub ([DEC-DH-63](#dec-dh-63)).*
- <a id="dec-dh-54"></a>**DEC-DH-54** · Data Hub is built in Node.js with TypeScript.
- <a id="dec-dh-63"></a>**DEC-DH-63** · The Chart Server is part of Data Hub. Its code, semgraph, moves into the Data Hub repository as a service and runs on GCP like the other services. This replaces the part of [DEC-DH-53](#dec-dh-53) that kept the Chart Server on AWS. How it moves is in [OP-PF-15](../requirements/technical/00-platform.md#op-pf-15) to [OP-PF-18](../requirements/technical/00-platform.md#op-pf-18).

### Storage

- <a id="dec-dh-55"></a>**DEC-DH-55** · Data Hub stores its Resource Cards, Lenses, Reports and conversations in a relational database: Postgres on Cloud SQL, in GCP next to Data Hub on Cloud Run. A relational database suits a catalogue full of relationships: searching along different paths, relationships in two directions, free text and overlapping periods.
- <a id="dec-dh-56"></a>**DEC-DH-56** · The Firestore of Colleciónes and the Postgres of Data Hub are intrinsically two different stores. Firestore keeps the entidades, the Entities created in Colleciónes; Postgres keeps what Data Hub knows about the data. They are not mixed up: Data Hub reads Colleciónes only via the manifests or the API of the Colleciónes server, never directly from Firestore.
- <a id="dec-dh-57"></a>**DEC-DH-57** · History, such as Confirmations, Level changes and Anomalies, is kept append-only: nothing is overwritten, in the same spirit as the SCD approach in Domain Hub.
- <a id="dec-dh-58"></a>**DEC-DH-58** · BigQuery is not a store for the Resource Cards: it is made for analysis, not for many small writes.
- <a id="dec-dh-59"></a>**DEC-DH-59** · The database schema is versioned in the Data Hub repository, as migrations that run in a separate step at deploy, before the new version goes live. Horizontal scalability is not a requirement for this internal tool.

### How business works with it

Three entry points to the same shelves:

| Entry point | What you do |
| --- | --- |
| Resource | You open a Resource, read its Resource Card and see the full lineage behind it. |
| Catalogue | You search the Catalogue, as in a library, and get back everything that fits: Resources, Lenses and Reports. |
| Domain Model | You navigate through the Domain Model to an Entity. For that, the Entities must be findable in the manifest of the dbt project of the Domain Model, so that the two can be mapped onto each other in different views. |

For every Resource, the description, the maturity Level and all the artefacts around it are defined. From there, business can start asking questions and turn them into Lenses and Reports.

## Relation to existing work

- This page deepens what [EDA: understanding data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168) (Confluence, Dutch) still calls the data server: there it knows the dbt manifest, reads the EDA documents from the repository and guards the access axis. Here Lenses, Reports, communication and the maturity Levels are added, and EDAs move to Data Hub as their source.
- [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch) describes the distinction between the Domain Model and Data Hub: the Domain Model describes the Entities of the business and only produces dbt Artifacts; Data Hub describes the data. Owner Units, Collections and the Promotion Loop are worked out there from the point of view of Data Hub. The Anomalies on the Resource Card are the end point of the defensive trigger for refinement described there.
- [Chart server - Environments and documentation](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361412109) (Confluence, Dutch) is the Chart Server Data Hub works with. It becomes part of Data Hub ([DEC-DH-63](#dec-dh-63)).
- [Functional domains](../requirements/functional/README.md) works out Data Hub functionally, domain by domain.

## Open themes

The themes still to be worked out, and the points to clarify in the analysis, are in [Open themes](open-themes.md).

## Builds on

- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [EDA: understanding data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168) (Confluence, Dutch)
- [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch)
