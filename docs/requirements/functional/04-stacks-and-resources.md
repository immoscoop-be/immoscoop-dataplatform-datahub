# Stacks and resources

| | |
| --- | --- |
| Domain | 4 of Data Hub · code `SR` |
| Type | Working document |
| Tags | context, decision, governance |
| Area | Tooling, Technical |
| Status | Specified; edge cases and open points remain |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Stacks en resources](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371078741) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17 |
| Last decisions | 2026-10-19: a table becomes a Resource through an exposure with the tag `datahub` in its dbt project ([DEC-SR-22](#dec-sr-22) to [DEC-SR-27](#dec-sr-27)) |

**In one sentence:** the Data Team makes a table a Resource with an exposure tagged `datahub` in its dbt project, and adds it to a Collection in Data Hub; from then on Data Hub knows it, assesses its Level and keeps its Log, until the Owner publishes it to everyone who sees the Collection, who can then find, read, query and discuss it.

*Functional domain 4 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: a book is only in the library once the librarian registers it. It then stands on a shelf, has a title, belongs to a collection and gets a catalogue card. Only when the curator releases it is it in general circulation.

## Decisions

- <a id="dec-sr-01"></a>**DEC-SR-01** · There is one Stack: the dataset `dbt_prod_stacks`. Because a Resource is registered with its full name, more Stacks can be added later without changing the model. *Note of 2026-10-19: a Resource no longer has to be in a Stack ([DEC-SR-23](#dec-sr-23)).*
- <a id="dec-sr-02"></a>**DEC-SR-02** · The Registration in Data Hub is the index. Being in a Stack is necessary, because the service account of Data Hub can only read there, but it is not enough: a view only exists for Data Hub once a Data Admin registers it. This replaces the earlier decision "the Stacks are the index". *Note of 2026-10-19: replaced by [DEC-SR-22](#dec-sr-22) and [DEC-SR-23](#dec-sr-23): the exposures in the dbt projects are the index.*
- <a id="dec-sr-03"></a>**DEC-SR-03** · Only a Data Admin registers Resources: a member of the Role Group of the Data Team from [User management](02-user-management.md). At Registration, the Data Admin chooses the Collection straight away. *Note of 2026-10-19: replaced by [DEC-SR-22](#dec-sr-22) and [DEC-SR-27](#dec-sr-27): the Data Team registers through the dbt project, and chooses the Collection afterwards in Data Hub.*
- <a id="dec-sr-04"></a>**DEC-SR-04** · A Resource has two identities: a Key, the full name `project.dataset.table`, and a Display Name, readable and unique, that the Data Admin chooses. *Note of 2026-10-19: the Display Name comes from the exposure ([DEC-SR-24](#dec-sr-24)).*
- <a id="dec-sr-05"></a>**DEC-SR-05** · At Registration, the Level is derived, and it is at most 2. A new Resource is not yet published, and therefore only visible to the Data Team and to the Owner of its Collection.
- <a id="dec-sr-06"></a>**DEC-SR-06** · Visibility depends on Publication, not on the Level. Publishing is a deliberate switch that the Owner flips. That way, a Resource does not disappear for those who use it every time the Level briefly drops. *Note of 2026-10-19: a published Resource is visible to everyone who sees its Collection, the whole company only when the Collection is public ([DEC-CO-12](03-collections.md#dec-co-12)).*
- <a id="dec-sr-07"></a>**DEC-SR-07** · The first Publication is only possible from Described, and is at once the first Confirmation: with it, the Resource rises to Confirmed. *Note of 2026-10-26: or over Described, where Business Descriptions cover every description dbt lacks ([DEC-MR-09](06-maturity-and-release.md#dec-mr-09)).*
- <a id="dec-sr-08"></a>**DEC-SR-08** · A published Resource stays published, even if its Level drops afterwards. The Owner then gets an alert, the lower Level is visible on the Resource Card and on every Lens and Report built on it, and the Owner confirms again without touching the Publication.
- <a id="dec-sr-09"></a>**DEC-SR-09** · The Log works with fixed Log IDs from a catalogue. Every Log Entry refers to a Log ID, with the extra parameters in a JSON field. The text is only built at display time from the template and the parameters, so that the Log stays compact and filterable.
- <a id="dec-sr-10"></a>**DEC-SR-10** · Search across names, descriptions and Log texts happens in Postgres itself: full-text search, complemented by trigrams for typos and half-remembered names. Semantic search with pgvector may follow later. A separate search engine is not needed.
- <a id="dec-sr-11"></a>**DEC-SR-11** · At Registration, Data Hub stores a Fingerprint of the Resource, as the basis for later comparisons.
- <a id="dec-sr-12"></a>**DEC-SR-12** · Every Registration sends a message to the Message Centre of the Data Admins.
- <a id="dec-sr-22"></a>**DEC-SR-22** · A table becomes a Resource through its dbt project: every table that an exposure with the tag `datahub` depends on, in the Current Version of a dbt project Data Hub follows, is a Resource. Registering is merging such an exposure, so the review of the dbt project is the review of the Registration, and the project itself shows what Data Hub exposes. Data Hub keeps no list of its own to type into. This replaces [DEC-SR-02](#dec-sr-02) and the Registration by a Data Admin in Data Hub of [DEC-SR-03](#dec-sr-03).
- <a id="dec-sr-23"></a>**DEC-SR-23** · The table does not have to be in a Stack: the exposure is enough. Every model, seed, snapshot or source the exposure depends on counts, as long as it is a table or view in BigQuery; an ephemeral model is not. This replaces the requirement of a Stack in [DEC-SR-01](#dec-sr-01) and [DEC-SR-02](#dec-sr-02). How Data Hub reads the data of these tables, for the Preview and for queries, is still open ([OP-SR-10](#op-sr-10)). *Note of 2026-10-26: how Data Hub reads these tables is decided ([DEC-SR-32](#dec-sr-32)).*
- <a id="dec-sr-24"></a>**DEC-SR-24** · How the exposures are written is up to how dbt is used: one exposure per Resource is recommended, and one exposure for several tables works too. The Display Name of a Resource is the `label` of an exposure that depends on that table alone, and otherwise the name of its Node. This replaces the Display Name chosen by a Data Admin of [DEC-SR-04](#dec-sr-04); the Key stays the full name of the table.
- <a id="dec-sr-25"></a>**DEC-SR-25** · Data Hub ignores the `owner` and the `maturity` of an exposure: the Owner comes from the Collection, the Level from the maturity ladder. Because dbt requires an `owner`, an exposure for Data Hub names the Data Team.
- <a id="dec-sr-26"></a>**DEC-SR-26** · A Resource on which no exposure with the tag `datahub` depends any more is withdrawn, not deleted. Only the Data Team and the Owner Unit of its Collection still see it, marked as withdrawn; it keeps its Collection, its Confirmations and its Log, and comes back as it was when an exposure depends on it again. A refactoring or a typo in the dbt project thus costs nothing.
- <a id="dec-sr-27"></a>**DEC-SR-27** · A new Resource has no Collection: only the Data Team sees it until it adds the Resource to a Collection in Data Hub ([FR-CO-14](03-collections.md#fr-co-14)). The Collection is chosen in Data Hub, never in the dbt project, because a Collection exists only in Data Hub ([DEC-CO-02](03-collections.md#dec-co-02)).
- <a id="dec-sr-28"></a>**DEC-SR-28** · An Owner cannot unpublish a Resource: once published, it stays available to whoever builds on it. Instead, the Owner and the Data Team can mark it deprecated, which discourages its use without hiding or blocking anything. *Decided on 2026-10-26, by Max ([OP-SR-05](#op-sr-05)).*
- <a id="dec-sr-29"></a>**DEC-SR-29** · What a query reads decides what happens, in three ranges, for every query, every preview and one run of a Lens that is made: up to 100 MB it runs freely; from 100 MB to 1 GB the User is warned and approves it; above 1 GB it goes to the Data Team, as a Request. These are start values, configurable, to be adjusted once there is experience with them. *Decided on 2026-10-26, by Max ([OP-SR-07](#op-sr-07)).*
- <a id="dec-sr-30"></a>**DEC-SR-30** · A preview, and a result in Query, shows its rows a page of 100 at a time. The query runs once; the next pages are read from the result of that run, which BigQuery does not bill again. *Decided on 2026-10-26, by Max ([OP-SR-07](#op-sr-07)).*
- <a id="dec-sr-31"></a>**DEC-SR-31** · Everyone who may see a Resource sees the queries on it: who, when, how and what it read. The SQL of a query is shown to whoever ran it, to the Owner Unit of the Resource for every query on what it owns, and to the Data Team, which sees all. *Decided on 2026-10-26, by Max ([OP-SR-13](#op-sr-13)).*
- <a id="dec-sr-32"></a>**DEC-SR-32** · The service account of Data Hub may read every table in the GCP projects of the dbt projects it follows, granted in Terraform. It needs no curated Stack: every table an exposure with the tag `datahub` depends on can be read, wherever dbt puts it. Who sees what stays decided in Data Hub, by the Publication. *Decided on 2026-10-26, by Max ([OP-SR-10](#op-sr-10)).*

Further decisions on using a Resource are under [Using a Resource](#using-a-resource).

## Terms

| Term | Meaning |
| --- | --- |
| Stack | A dataset in BigQuery with mart views that the Data Team releases, as authorized views onto the datasets behind them. Today there is one: `dbt_prod_stacks` |
| Resource | A table of a dbt project that an exposure with the tag `datahub` depends on: one book on the shelves |
| Key | The full name of the table in BigQuery, `project.dataset.table` |
| Display Name | The readable, unique name of the Resource, as business sees it, for example "Agency purity" |
| Data Admin | A member of the Role Group of the Data Team, who registers and manages Resources |
| Publication | The switch with which the Owner makes a Resource visible to everyone who sees its Collection: the whole company when the Collection is public |
| Log ID | The fixed code of a kind of Log Entry, with a template and a list of parameters, for example `RES-001` |
| Fingerprint | A set of hashes of the structure, the types and the descriptions of a Resource at a given moment |
| Signal | A remark reporting that something seems odd about the data; it can grow into an Anomaly |

## Flow: registering a Resource

1. **Expose.** In the dbt project, the Data Team adds an exposure with the tag `datahub` that depends on the table, through a reviewed pull request ([DEC-SR-22](#dec-sr-22)).
2. **Run.** The next run of the Source Job of that project makes the exposure part of its Current Version in the [Artifact registry](01-artifact-registry.md).
3. **Register.** Data Hub finds the table under the exposure and registers it as a Resource, linked to its Node, with its Key and its Display Name.
4. **Describe.** The description of the table and its columns comes from the Artifacts.
5. **Assess.** The Level is derived: Available if the description is incomplete, Described if it is complete. Never higher.
6. **Take a Fingerprint.** Data Hub stores the hashes of structure, types and descriptions.
7. **Open the Log.** The first Log Entries are written: the Registration and the Level.
8. **Notify.** A message goes to the Message Centre of the Data Admins.
9. **Assign.** The Data Team adds the Resource to a Collection in Data Hub ([DEC-SR-27](#dec-sr-27)); the Owner of that Collection then takes it from there.
10. **Withdraw.** When no exposure with the tag `datahub` depends on the table any more, its Resource is withdrawn and held ([DEC-SR-26](#dec-sr-26)).

## Flow: publishing a Resource

1. **Ready.** The Resource is at Described and visible to the Owner of its Collection.
2. **Publish.** The Owner checks the documentation and switches the Publication on. That is at once the first Confirmation: the Resource rises to Confirmed and is visible to the whole company.
3. **Change.** If a field changes later, the Level and the Publication stay. A warning on the Resource says what changed, and the Owner is told ([DEC-MR-08](06-maturity-and-release.md#dec-mr-08)).
4. **Seen.** The Owner or the Data Team marks the change as seen; no new Confirmation is needed.

## Using a Resource

Whoever may see a Resource can find it, read it, query it, help describe it and discuss it. What someone sees always follows the Publication: an unpublished Resource is only findable and readable for the Data Team and for the Owner.

- <a id="dec-sr-13"></a>**DEC-SR-13** · Finding works in three ways: searching on title, description, Collection and Owner; browsing per Collection; and navigating via the Domain Model. A search result shows title, description, Collection and Owner.
- <a id="dec-sr-14"></a>**DEC-SR-14** · The link with the Domain Model is derived from the manifest and the lineage, without manual work. Colleciónes gets no special treatment in this: it is part of the manifest like everything else. A Resource from dbt-prod thus finds its Entities via the models further along its lineage. A Resource without an Entity in its lineage stays findable via search and Collection.
- <a id="dec-sr-15"></a>**DEC-SR-15** · Reading a Resource happens in tabs: Overview, Columns, Lineage, EDA, History, Conversations and Preview. Usage, who uses the Resource in Lenses, Reports and feeds, comes later. *Note of 2026-10-26: there is no tab Conversations any more; the Messages on a Resource open from "Messages" in its header, as on every object ([DEC-UX-67](../../design/principles.md#dec-ux-67)).*
- <a id="dec-sr-16"></a>**DEC-SR-16** · Querying comes in two flavours. Via Claude, it is free SQL, also across multiple Resources, with joins. In the interface there is only a preview of the first rows, no query builder: real questions need joins, and those belong with Claude and, later, with Lenses.
- <a id="dec-sr-17"></a>**DEC-SR-17** · When Claude queries on behalf of a User, Data Hub checks that every Resource in the query is visible to that User, and a limit on scanned bytes applies. Every query gets a label with the User.
- <a id="dec-sr-18"></a>**DEC-SR-18** · Executed queries are not stored in Data Hub in v1. BigQuery keeps its own job log for 180 days; query history may be added later. *Note of 2026-10-22: replaced by [DEC-LN-01](07-log-and-notifications.md#dec-ln-01): Data Hub keeps its own Query Log of every query.*
- <a id="dec-sr-19"></a>**DEC-SR-19** · The Owner and the Data Team can supplement the description on top of the Artifacts: intended use, pitfalls, Anomalies, key fields and Parameter fields. Every addition goes into the Log, with who made it.
- <a id="dec-sr-20"></a>**DEC-SR-20** · Everyone who may see a Resource can react to it. A Reaction has a type: a Question, a Remark or a Signal.
- <a id="dec-sr-21"></a>**DEC-SR-21** · A Signal reports that something seems odd about the data. It goes to the Owner and to the Data Team, and they can turn it into an Anomaly on the Resource Card, with a period and the impact.

### The tabs of a Resource

| Tab | What you read | v1 |
| --- | --- | --- |
| Overview | Table description, Display Name and Key, Collection and Owner, Level and Publication, freshness, Known Behaviour: intended use and pitfalls | Yes |
| Columns | Columns with description and type, relationships to other tables, and which fields serve as Parameters | Yes |
| Lineage | Where the Resource comes from, also across the boundary between dbt-prod and Colleciónes | Yes |
| EDA | The exploration by the Owner | Yes |
| History | The Log, filterable by kind: Changes, Level, Publication, incidents and Anomalies | Yes |
| Conversations | Questions, Remarks and Signals about the Resource | Yes |
| Preview | The first rows of the data | Yes |
| Usage | Which Lenses, Reports and feeds depend on the Resource | Later |

*Note of 2026-10-22: the detail page does not show freshness ([DEC-UX-07](../../design/principles.md#dec-ux-07)).*

### Kinds of Reaction

| Type | For | Who gets a notification |
| --- | --- | --- |
| Question | A question about the Resource, for example how to read a field | The Owner, and whoever is already in the conversation |
| Remark | A remark or tip for others | Whoever is already in the conversation |
| Signal | Something seems odd about the data; it can become an Anomaly | The Owner and the Data Team |

## Requirements

<a id="fr-sr-01"></a>
### FR-SR-01 · Only Data Admins register, rename and deregister

**Status:** Withdrawn · **Confluence:** SR-01

Only Data Admins can register Resources, change their name and deregister them.

*Withdrawn on 2026-10-19: registering, renaming and deregistering happen in the dbt project, through exposures ([FR-SR-32](#fr-sr-32), [DEC-SR-22](#dec-sr-22)).*

<a id="fr-sr-02"></a>
### FR-SR-02 · A Registration needs a full name, a Display Name and a Collection

**Status:** Withdrawn · **Confluence:** SR-02

A Registration requires three things: the full name, a Display Name and a Collection.

*Withdrawn on 2026-10-19: the full name and the Display Name come from the dbt project ([FR-SR-32](#fr-sr-32), [FR-SR-33](#fr-sr-33)), and the Collection is chosen afterwards ([FR-SR-35](#fr-sr-35)).*

<a id="fr-sr-03"></a>
### FR-SR-03 · The view must be in a Stack and in the current Artifacts

**Status:** Withdrawn · **Confluence:** SR-03

The view must lie in a Stack on which the service account of Data Hub has read access, and must appear as a Node in the current Artifacts. Otherwise the Registration is refused, with the reason.

*Withdrawn on 2026-10-19: a Resource no longer has to be in a Stack, and being in the Current Version follows from the exposure ([FR-SR-32](#fr-sr-32), [DEC-SR-23](#dec-sr-23)).*

<a id="fr-sr-04"></a>
### FR-SR-04 · The Key is unique

**Status:** Implemented · **Confluence:** SR-04

The Key is unique: a view can only be registered once.

<a id="fr-sr-05"></a>
### FR-SR-05 · The Display Name is required, unique and can be changed

**Status:** Implemented · **Confluence:** SR-05

The Display Name is required and unique. It can be changed later; every change goes into the Log.

<a id="fr-sr-06"></a>
### FR-SR-06 · The description comes from the Artifacts

**Status:** Implemented · **Confluence:** SR-06

The description comes from the Artifacts and is not retyped in Data Hub.

*Note of 2026-10-26: next to it, the Owner and the Data Team can write a Business Description, of the Resource and of each field ([DEC-RC-01](05-resource-card.md#dec-rc-01)); the description from dbt itself is still never edited in Data Hub.*

<a id="fr-sr-07"></a>
### FR-SR-07 · The Level at Registration is at most Described

**Status:** Specified · **Confluence:** SR-07

At Registration, the Level is derived and is at most 2, Described. The Resource is then not yet published, and only visible to the Data Team and to the Owner of its Collection.

<a id="fr-sr-08"></a>
### FR-SR-08 · Store a Fingerprint at Registration

**Status:** Specified · **Confluence:** SR-08

At Registration, a Fingerprint is stored: a hash of the structure (the column names), a hash of the types, a hash of the descriptions, and the checksum of the code from the manifest.

<a id="fr-sr-09"></a>
### FR-SR-09 · Open the Log at Registration

**Status:** Specified · **Confluence:** SR-09

At Registration, the Log of the Resource starts with the entries for Registration, Collection and Level.

<a id="fr-sr-10"></a>
### FR-SR-10 · Notify the Data Admins of every Registration

**Status:** Specified · **Confluence:** SR-10

Every Registration sends a message to the Message Centre of the Data Admins.

<a id="fr-sr-11"></a>
### FR-SR-11 · Structure of a Log Entry

**Status:** Implemented · **Confluence:** SR-11

A Log Entry consists of a Log ID, the Resource, the parameters as JSON, the actor (a person or Data Hub itself) and the timestamp. Free text is never stored.

<a id="fr-sr-12"></a>
### FR-SR-12 · Log IDs come from a fixed catalogue

**Status:** Implemented · **Confluence:** SR-12

The Log IDs are in a fixed catalogue (see the [Log catalogue](log-catalogue.md)). A new kind of Log Entry means a new Log ID, not free text.

<a id="fr-sr-13"></a>
### FR-SR-13 · Names, descriptions and Log texts are searchable

**Status:** Specified · **Confluence:** SR-13

The built texts of names, descriptions and Log Entries are searchable, by words and with tolerance for typos.

<a id="fr-sr-14"></a>
### FR-SR-14 · Deregistration keeps the Log and history

**Status:** Implemented · **Confluence:** SR-14

A deregistered Resource disappears from the index and from its Collection. Its Log and history are kept.

<a id="fr-sr-15"></a>
### FR-SR-15 · All texts in the app are in English

**Status:** Withdrawn · **Confluence:** SR-15

All texts in the app are in English: the interface, the names and the templates of the Log.

*Note of 2026-10-25: the language principle proposes Dutch and English sentences, with English names ([NFR-LOC-01](../non-functional/localisation.md#nfr-loc-01), [NFR-LOC-06](../non-functional/localisation.md#nfr-loc-06)); open in [OP-DH-43](../../overview/open-themes.md#op-dh-43).*

*Withdrawn on 2026-10-25: replaced by the language principle, decided by Max: names English, sentences Dutch by default with English available ([DEC-DH-65](../../overview/data-hub.md#dec-dh-65), [NFR-LOC-01](../non-functional/localisation.md#nfr-loc-01), [NFR-LOC-06](../non-functional/localisation.md#nfr-loc-06)).*

<a id="fr-sr-16"></a>
### FR-SR-16 · Only the Owner publishes

**Status:** Specified · **Confluence:** SR-16

Only the Owner of the Collection can publish a Resource.

<a id="fr-sr-17"></a>
### FR-SR-17 · The first Publication, from Described, is the first Confirmation

**Status:** Specified · **Confluence:** SR-17

The first Publication is only possible when the Resource is at Described. It is at once the first Confirmation: the Resource rises to Confirmed.

*Note of 2026-10-26: or over Described, where Business Descriptions cover every description dbt lacks ([DEC-MR-09](06-maturity-and-release.md#dec-mr-09)).*

<a id="fr-sr-18"></a>
### FR-SR-18 · Visibility depends only on Publication

**Status:** Withdrawn · **Confluence:** SR-18

Who sees the Resource depends only on the Publication: not published means visible to the Data Team and the Owner; published means visible to the whole company.

*Withdrawn on 2026-10-19: replaced by [FR-SR-31](#fr-sr-31), where the Collection decides who "everyone" is ([DEC-CO-12](03-collections.md#dec-co-12)).*

<a id="fr-sr-19"></a>
### FR-SR-19 · A published Resource stays published when its Level drops

**Status:** Specified · **Confluence:** SR-19

A published Resource stays published when its Level drops. The Owner gets an alert, and the current Level is visible on the Resource Card and on every Lens and Report that depends on it.

<a id="fr-sr-20"></a>
### FR-SR-20 · Reconfirm after a drop

**Status:** Withdrawn · **Confluence:** SR-20

After a drop, the Owner confirms again. Reconfirming changes nothing about the Publication.

*Note of 2026-10-26: withdrawn by Max. There is no reconfirmation; a change to the schema gives a warning ([DEC-MR-08](06-maturity-and-release.md#dec-mr-08)).*

<a id="fr-sr-21"></a>
### FR-SR-21 · Search on title, description, Collection and Owner

**Status:** Specified · **Confluence:** SR-21

Search covers title, description, Collection and Owner. A result shows those four, and only Resources the User may see.

<a id="fr-sr-22"></a>
### FR-SR-22 · Browse per Collection

**Status:** Specified · **Confluence:** SR-22

Browsing per Collection shows the Resources of a Collection, with the colour and the icon of that Collection.

*Note of 2026-10-22: in the web app, a Collection unfolds to its Resources in the panel of Collections ([FR-CO-18](03-collections.md#fr-co-18)).*

<a id="fr-sr-23"></a>
### FR-SR-23 · Derive the Entities from the manifest and the lineage

**Status:** Specified · **Confluence:** SR-23

The Entities of a Resource are derived from the manifest and the lineage, in the same way for every Resource. Via an Entity of the Domain Model, you find the Resources that are about it.

<a id="fr-sr-24"></a>
### FR-SR-24 · Read a Resource in tabs

**Status:** Specified · **Confluence:** SR-24

A Resource is read in the tabs Overview, Columns, Lineage, EDA, History, Conversations and Preview. History is filterable by kind of Log Entry.

*Note of 2026-10-26: there is no tab Conversations any more; the Messages on a Resource open from "Messages" in its header, as on every object ([DEC-UX-67](../../design/principles.md#dec-ux-67)).*

*Note of 2026-10-23: a tab Queries is proposed ([FR-SR-44](#fr-sr-44)).*

<a id="fr-sr-25"></a>
### FR-SR-25 · The preview shows a limited number of rows

**Status:** Specified · **Confluence:** SR-25

The Preview shows a limited number of first rows. There is no query builder in the interface.

*Note of 2026-10-23: SQL does come into the interface, in a section Query of its own ([FR-SR-41](#fr-sr-41)); the Preview itself stays without a query builder ([FR-SR-38](#fr-sr-38)).*

<a id="fr-sr-26"></a>
### FR-SR-26 · Free SQL via Claude, over visible Resources only

**Status:** Specified · **Confluence:** SR-26

Via Claude, a User can have free SQL executed over the Resources they may see. A query that touches a Resource they cannot see is refused.

*Note of 2026-10-23: Query is the other way, in the interface ([FR-SR-41](#fr-sr-41)).*

<a id="fr-sr-27"></a>
### FR-SR-27 · A byte limit and a User label on every query

**Status:** Specified · **Confluence:** SR-27

Every query gets a limit on scanned bytes and a label with the User. Executed queries are not stored in Data Hub in v1.

*Note of 2026-10-22: queries are stored after all, in the Query Log ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)).*

<a id="fr-sr-28"></a>
### FR-SR-28 · The Owner and the Data Team supplement the description

**Status:** Specified · **Confluence:** SR-28

The Owner and the Data Team can supplement intended use, pitfalls, Anomalies, key fields and Parameter fields. Every addition goes into the Log.

<a id="fr-sr-29"></a>
### FR-SR-29 · React with a Question, a Remark or a Signal

**Status:** Specified · **Confluence:** SR-29

Everyone who may see a Resource can react with a Question, a Remark or a Signal.

<a id="fr-sr-30"></a>
### FR-SR-30 · A Signal can become an Anomaly

**Status:** Specified · **Confluence:** SR-30

A Signal goes to the Owner and the Data Team, and they can turn it into an Anomaly on the Resource Card.

<a id="fr-sr-31"></a>
### FR-SR-31 · Visibility follows the Publication and the Collection

**Status:** Specified

Who sees a Resource depends on its Publication and on its Collection. Not published: the Data Team and the members of the Owner Unit of its Collection. Published: everyone who sees its Collection ([FR-CO-17](03-collections.md#fr-co-17)), which for a public Collection is the whole company. A Resource without a Collection is visible only to the Data Team.

<a id="fr-sr-32"></a>
### FR-SR-32 · A table is registered through an exposure with the tag datahub

**Status:** Implemented

Every table, view or seed that an exposure with the tag `datahub` depends on, in the Current Version of a dbt project Data Hub follows, is a Resource, once: several exposures on one table make one Resource. A Node that builds nothing in BigQuery, such as an ephemeral model, is not. Data Hub registers a new one when the run that brings its exposure becomes the Current Version, and writes the Registration in its Log.

<a id="fr-sr-33"></a>
### FR-SR-33 · The Display Name comes from the exposure

**Status:** Implemented

The Display Name is the `label` of an exposure that depends on that table alone, and otherwise the name of its Node. When another Resource already has that Display Name, the name of the dbt project is added in brackets. A change of the label in the dbt project renames the Resource, and the change goes into its Log.

<a id="fr-sr-34"></a>
### FR-SR-34 · A Resource without exposure is withdrawn and held

**Status:** Implemented

When the Current Version of its dbt project has no exposure with the tag `datahub` on the table any more, the Resource is withdrawn: only the Data Team and the Owner Unit of its Collection still see it, marked as withdrawn. It keeps its Collection and its Log, and comes back as it was when an exposure depends on it again. Both go into its Log.

<a id="fr-sr-35"></a>
### FR-SR-35 · A new Resource waits for a Collection

**Status:** Implemented

A new Resource has no Collection. Until the Data Team adds it to one, only the Data Team sees it, in a list of Resources without a Collection.

<a id="fr-sr-36"></a>
### FR-SR-36 · A Pre-flight before every query

**Status:** Proposed · **Source:** [REQ-DH-PREFLIGHT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-preflight)

Before every query, Data Hub shows a Pre-flight with the volume it will process, in MB or GB.

<a id="fr-sr-37"></a>
### FR-SR-37 · Approval above one threshold, a block above another

**Status:** Proposed · **Source:** [REQ-DH-PREFLIGHT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-preflight)

Above X GB, the User has to approve a query explicitly; above Y GB, the query is blocked. X and Y are configurable.

*Note of 2026-10-26: X is 100 MB and Y 1 GB, as start values; above Y a query is not blocked but goes to the Data Team, as a Request ([DEC-SR-29](#dec-sr-29)).*

<a id="fr-sr-38"></a>
### FR-SR-38 · The Parameters of a Resource choose the rows of its Preview

**Status:** Proposed · **Source:** [the design of the Preview](../../design/principles.md#preview), 2026-10-23

The Preview offers a choice per Parameter of the Resource, such as the weeks or the lead source, to choose which first rows it shows. Choosing is picking values, not typing SQL. The partition column of a partitioned Resource is always one of them, with a recent range chosen by default, so that a preview reads only the partitions it shows: in BigQuery, a `LIMIT` alone lowers nothing that is read. Every preview is a query: it passes the Pre-flight ([FR-SR-36](#fr-sr-36)) and its result carries its Query ID ([FR-LN-06](07-log-and-notifications.md#fr-ln-06)).

<a id="fr-sr-39"></a>
### FR-SR-39 · A Resource shows how it is partitioned and clustered

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#detail-page-of-a-resource)

The page of a Resource shows its partition column and the unit of its partitions, the number of partitions, its cluster columns in their order, and its size, with a sentence on how to query it cheaply. Its columns are marked as the partition or a cluster column. Claude gets the same through the MCP, so that it filters on them too. For a Resource that is a view, these are of the table beneath it ([OP-SR-12](#op-sr-12)).

<a id="fr-sr-40"></a>
### FR-SR-40 · The Pre-flight counts the partitions and warns without a partition filter

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#query)

The Pre-flight ([FR-SR-36](#fr-sr-36)) says, per Resource, how many of its partitions a query reads and through which column, and calls its volume "at most" where clustering can make the real read lower. A query on a partitioned Resource without a filter on its partition column gets a warning, with what it would read with one.

*Note of 2026-10-25: a Resource can require a partition filter, because BigQuery requires one or because the Data Admin set it ([FR-CO-34](03-collections.md#fr-co-34)). A query without one then does not run at all; how the Pre-flight treats it is [OP-SR-15](#op-sr-15).*

<a id="fr-sr-41"></a>
### FR-SR-41 · Query, a section for SQL over everything the User may see

**Status:** Proposed · **Source:** [DEC-UX-17](../../design/principles.md#dec-ux-17)

Data Hub has a section Query, next to Collections, in which a User writes SQL over every Resource they may see, and later Lenses. A query that touches a Resource they cannot see is refused, as through Claude ([FR-SR-26](#fr-sr-26)). Every query passes the Pre-flight, with its thresholds ([FR-SR-36](#fr-sr-36), [FR-SR-37](#fr-sr-37)), gets a byte limit and a label ([FR-SR-27](#fr-sr-27)), and its result carries its Query ID ([FR-LN-06](07-log-and-notifications.md#fr-ln-06)). From the page of a Resource, "Query this resource" opens Query with it.

*Note of 2026-10-27: a query reads only its own Resources; a table outside them is an error, and another set of Resources is another query ([DEC-UX-73](../../design/principles.md#dec-ux-73)).*

<a id="fr-sr-42"></a>
### FR-SR-42 · The editor formats and suggests

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#query)

The SQL editor in Query formats the SQL on request, and suggests while typing: the Resources the User may see, their columns and the Parameters, the partition and cluster columns first and marked as such.

<a id="fr-sr-43"></a>
### FR-SR-43 · The panel of Query lists the queries that ran

**Status:** Proposed · **Source:** [DEC-UX-20](../../design/principles.md#dec-ux-20)

The panel of Query lists the queries a User ran, through Query, a preview or Claude, newest first and grouped by day. The Data Team can also list everyone's, with who ran them and their SQL; nobody else sees the queries of others ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)). Each query shows whether it ran on Resources or on a Lens, its name, what it ran on, what it read, and whether it was approved or blocked, and opens in Query with a click.

*Note of 2026-10-27: one item per query, not per run; every run is a variation in the history of its query ([DEC-UX-74](../../design/principles.md#dec-ux-74)).*

<a id="fr-sr-44"></a>
### FR-SR-44 · The page of a Resource lists the queries on it

**Status:** Proposed · **Source:** [DEC-UX-19](../../design/principles.md#dec-ux-19)

The page of a Resource has a tab Queries with every query that ran on it: when, who, through what, what it read and its Query ID, and a few numbers over the last 30 days. The SQL of a query is shown only to whoever ran it and to the Data Team ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)). Who sees the list is open ([OP-SR-13](#op-sr-13)).

*Note of 2026-10-26: everyone who may see the Resource sees the list; the SQL also shows to the Owner Unit of the Resource ([DEC-SR-31](#dec-sr-31)).*

<a id="fr-sr-45"></a>
### FR-SR-45 · Every query has a name

**Status:** Proposed · **Source:** [DEC-UX-21](../../design/principles.md#dec-ux-21)

A new query starts with its name, before its SQL. Data Hub suggests one from where the query starts: its Resources and the date, or for a Lens the name of the Lens. It suggests no other names. The name can be changed later; a query without a name cannot be run.

<a id="fr-sr-46"></a>
### FR-SR-46 · "Query" on the page of a Resource starts a new query on it

**Status:** Proposed · **Source:** [DEC-UX-21](../../design/principles.md#dec-ux-21)

The page of a Resource has a button "Query". It opens Query with a new query: the Resource as its source, its name suggested ([FR-SR-45](#fr-sr-45)), and its SQL starting with a filter on the partition column ([FR-SR-39](#fr-sr-39)).

<a id="fr-sr-47"></a>
### FR-SR-47 · A new query first shows the Lenses on its Resources

**Status:** Proposed · **Source:** [DEC-UX-22](../../design/principles.md#dec-ux-22)

While a User names a new query and chooses its Resources, Data Hub shows the Lenses they may see that already use those Resources: a Lens only when the User may use every Resource beneath it ([DEC-CO-16](03-collections.md#dec-co-16)). First the Lenses on exactly these Resources, then those on these Resources and more; within each, ranked by the words they share with the question of the query ([FR-SR-48](#fr-sr-48)). Each Lens shows what it shows, its Resources, its maker, its use and its Level, and can be used straight away. Starting an own query stays possible, as the alternative.

<a id="fr-sr-48"></a>
### FR-SR-48 · The question of a new query finds Lenses by their words

**Status:** Proposed · **Source:** [DEC-UX-23](../../design/principles.md#dec-ux-23)

A new query has a question: what the User wants to know, in a sentence. Its words are matched against the name, the description and the tags of the Lenses ([FR-LE-06](09-lenses.md#fr-le-06)), deterministically, with the full-text search of Postgres in the English configuration ([Search](#search)): common words such as "the" and "a" are left out, and words count by their stem, so that "sessions" matches "session". The Lenses that share most words come first, and the shared words are marked in their name, description and tags.


<a id="fr-sr-49"></a>
### FR-SR-49 · Publishing says who will see the Resource and asks for the Confirmation

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#publishing-and-confirming)

The Owner publishes a Resource from its page. Before they do, Data Hub shows who will see it once published ([FR-SR-31](#fr-sr-31)), and what it checked: that they may publish it ([FR-SR-16](#fr-sr-16)) and that the Resource is Described ([FR-SR-17](#fr-sr-17)). When it is not Described, publishing is not possible, and Data Hub names the columns without a description. As the first Publication is the first Confirmation, the Owner confirms in the same step, with the declaration that the Resource is correct: what it is and what it stands for ([DEC-MR-07](06-maturity-and-release.md#dec-mr-07)). They tick the declaration right next to the button that publishes; until it is ticked, the button stays off.

*Note of 2026-10-26: the control figures and since when the data is reliable are no longer asked here; a Confirmation makes no claim about the data ([DEC-MR-07](06-maturity-and-release.md#dec-mr-07)). Since when the data is reliable stays on the Resource Card ([FR-RC-13](05-resource-card.md#fr-rc-13)).*

*Note of 2026-10-26: when the Resource is not Described, the sheet names what dbt lacks and whether a Business Description covers it; once every gap is covered, publishing is possible, and the Resource is Confirmed with a mark ([FR-MR-13](06-maturity-and-release.md#fr-mr-13)).*

<a id="fr-sr-50"></a>
### FR-SR-50 · A Resource can be marked deprecated

**Status:** Proposed · **Source:** Max, 2026-10-26 ([OP-SR-05](#op-sr-05))

The Owner and the Data Team can mark a published Resource deprecated: its use is discouraged. The mark shows wherever the Resource appears, on the Lenses and Reports built on it and for Claude. It hides nothing and blocks nothing, and it can be taken away again. Every mark and its removal go into the Log.

<a id="fr-sr-51"></a>
### FR-SR-51 · A result shows 100 rows a page

**Status:** Specified · **Source:** Max, 2026-10-26 ([OP-SR-07](#op-sr-07))

A preview, and the result of a query in Query, shows its rows 100 at a time, with how many rows there are in all and a way to the next and the previous page. Turning a page reads the next rows of the same run; it runs no query again ([DEC-SR-30](#dec-sr-30)).


<a id="fr-sr-52"></a>
### FR-SR-52 · Data Hub finds what is Broken, and what works again

**Status:** Proposed · **Source:** [DEC-DH-67](../../overview/data-hub.md#dec-dh-67), [DEC-DH-68](../../overview/data-hub.md#dec-dh-68)

Data Hub looks for Broken assets at three moments:

1. **After every new Current Version** of a dbt project, for each Resource it withdraws or brings back ([FR-SR-34](#fr-sr-34)) and each Resource with a field removed, renamed or back ([FR-AR-12](01-artifact-registry.md#fr-ar-12)).
2. **Once a day**, for each Resource whose table is not found in BigQuery, or is found again. This also catches a table dropped outside dbt.
3. **When a run, a Pre-flight or a Preview fails** because a table or a column is not found.

For each Resource found, Data Hub takes from its database what reads it ([DEC-DH-68](../../overview/data-hub.md#dec-dh-68)) and does a dry run of each Lens, feed and query: one that fails on a missing table or column becomes Broken, with what is missing; one that was Broken and now succeeds works again. A Report follows its Lenses. A dry run reads nothing and costs nothing. Every change of state goes into the Log of the asset (`BRK-001`, `BRK-002` in the [Log catalogue](log-catalogue.md)) and into its Message ([MSG-LEN-05](message-catalogue.md#msg-len-05), [MSG-QRY-02](message-catalogue.md#msg-qry-02), [MSG-RPT-01](message-catalogue.md#msg-rpt-01)).

<a id="fr-sr-53"></a>
### FR-SR-53 · A query that reads what no longer exists is Broken

**Status:** Proposed · **Source:** [DEC-DH-67](../../overview/data-hub.md#dec-dh-67)

A Broken query cannot run: Run is off, and a callout on top of it names what no longer exists. It carries a red dot in the panel of Query and in the Queries of a Resource ([FR-SR-43](#fr-sr-43), [FR-SR-44](#fr-sr-44)). Who made it gets a Message ([MSG-QRY-02](message-catalogue.md#msg-qry-02)). Its SQL can still be opened, copied and changed; a change that runs makes it work again, as does the return of what it reads.

## Log Catalogue

The first draft of the Log Catalogue started on this page. Because it spans all domains, it now lives in its own file: [Log catalogue](log-catalogue.md).

## Search

| What | How | When |
| --- | --- | --- |
| Word search | Full-text search in Postgres, with the English configuration and `unaccent` | Now |
| Typos and half-remembered names | Trigrams in Postgres (`pg_trgm`) | Now |
| Search by meaning, also for Claude | Embeddings with pgvector | Later |

## Edge cases

Proposals to confirm.

<a id="ec-sr-01"></a>
### EC-SR-01 · The view is not (yet) in the Artifacts

**Status:** Withdrawn

The Registration is refused. After the next prod run, the Data Admin can try again.

*Withdrawn on 2026-10-19: a Registration starts from the Artifacts themselves, so this cannot happen any more ([FR-SR-32](#fr-sr-32)).*

<a id="ec-sr-02"></a>
### EC-SR-02 · A registered view disappears from the Artifacts

**Status:** Withdrawn

The Resource gets a Log Entry and is flagged as missing. It is not deregistered automatically; the Data Admin decides.

*Withdrawn on 2026-10-19: replaced by [FR-SR-34](#fr-sr-34): the Resource is withdrawn and held, and comes back when its exposure does.*

<a id="ec-sr-03"></a>
### EC-SR-03 · A view is renamed in BigQuery

**Status:** Proposed

The Data Admin links the new full name to the existing Resource, so that it keeps its ID, Log and Confirmations.

*Note of 2026-10-19: with Registration through exposures, the Resource of the old name is withdrawn and the new name becomes a new Resource without Collection ([FR-SR-34](#fr-sr-34), [FR-SR-35](#fr-sr-35)); linking the two is still to be built.*

<a id="ec-sr-04"></a>
### EC-SR-04 · A second Stack is added

**Status:** Withdrawn

The service account of Data Hub gets read access to it, via Terraform. After that, views from that Stack can be registered like any other.

*Withdrawn on 2026-10-19: a Resource no longer has to be in a Stack ([DEC-SR-23](#dec-sr-23)); reading its data is [OP-SR-10](#op-sr-10).*

## Out of scope

How the Level evolves after Registration ([Maturity and release](06-maturity-and-release.md)), managing Collections ([Collections](03-collections.md)), the Message Centre and notifications ([Log and notifications](07-log-and-notifications.md)), fetching and comparing the Artifacts ([Artifact registry](01-artifact-registry.md)), and working out conversations and their notifications ([Conversations](14-conversations.md)).

## Open points

- [ ] <a id="op-sr-01"></a>**OP-SR-01** · Agree a convention for the Display Names of Resources. *Note of 2026-10-19: the Display Name is the `label` of the exposure ([DEC-SR-24](#dec-sr-24)), so the convention applies to those labels.*
- [ ] <a id="op-sr-02"></a>**OP-SR-02** · Complete the [Log catalogue](log-catalogue.md), with the Log IDs from the other domains.
- [x] <a id="op-sr-03"></a>**OP-SR-03** · Work out what happens to Lenses and Reports when their Resource is deregistered. *Decided on 2026-10-28, by Max: they become Broken until it comes back ([DEC-DH-67](../../overview/data-hub.md#dec-dh-67), [FR-SR-52](#fr-sr-52)).*
- [ ] <a id="op-sr-04"></a>**OP-SR-04** · Work out the Message Centre of the Data Admins in the domain [Log and notifications](07-log-and-notifications.md).
- [x] <a id="op-sr-05"></a>**OP-SR-05** · Later: work out whether an Owner can unpublish a Resource, and what then happens to the Lenses and Reports of colleagues that depend on it. *Decided on 2026-10-26, by Max: an Owner cannot unpublish; a Resource can be marked deprecated instead ([DEC-SR-28](#dec-sr-28), [FR-SR-50](#fr-sr-50)).*
- [x] <a id="op-sr-06"></a>**OP-SR-06** · Work out how Resources are read, found, described and commented on.
- [x] <a id="op-sr-07"></a>**OP-SR-07** · Decide the limit on scanned bytes and the number of rows in the Preview. *Note of 2026-10-22: decide together with the thresholds X and Y of the Pre-flight ([FR-SR-37](#fr-sr-37)).* *Note of 2026-10-23: and the two thresholds that check the making of a Lens ([FR-LE-08](09-lenses.md#fr-le-08)).* *Decided on 2026-10-26, by Max: 100 MB, 1 GB and pages of 100 rows ([DEC-SR-29](#dec-sr-29), [DEC-SR-30](#dec-sr-30)).*
- [ ] <a id="op-sr-08"></a>**OP-SR-08** · Later: query history in Data Hub, and the Usage tab. *Note of 2026-10-22: the Query Log keeps every query ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)); the Usage tab remains open.* *Note of 2026-10-23: a history per User ([FR-SR-43](#fr-sr-43)) and per Resource ([FR-SR-44](#fr-sr-44)) are proposed.*
- [ ] <a id="op-sr-09"></a>**OP-SR-09** · Confirm or adjust the edge cases above.
- [x] <a id="op-sr-10"></a>**OP-SR-10** · Decide how Data Hub reads the data of Resources outside the Stacks, for the Preview and for queries: read access for its service account on those datasets, or the tables of Resources always in a Stack after all ([DEC-SR-23](#dec-sr-23)). *Raised on 2026-10-19.* *Decided on 2026-10-26, by Max: Data Hub reads every table in the projects it follows ([DEC-SR-32](#dec-sr-32)).*
- [x] <a id="op-sr-11"></a>**OP-SR-11** · Decide whether the page of a Resource gets a Query tab with SQL. Max asked on 2026-10-23 for a preview and a query on the page of a Resource. [FR-SR-25](#fr-sr-25) keeps a query builder out of the interface, and [FR-SR-26](#fr-sr-26) sends free SQL through Claude. The [Preview](../../design/principles.md#preview) stays within that: Parameters, no SQL. A Query tab was designed first, as a proposal: SQL on this Resource, with the Pre-flight and its thresholds. Decide which of the two, and if the Query tab: for whom, and whether it replaces or joins free SQL through Claude. *Raised on 2026-10-23.* *Decided on 2026-10-23: SQL comes into the interface, in a section Query of its own rather than a tab of a Resource ([DEC-UX-17](../../design/principles.md#dec-ux-17), [FR-SR-41](#fr-sr-41)); Claude stays the other way.*
- [ ] <a id="op-sr-12"></a>**OP-SR-12** · Decide how Data Hub finds the partition and cluster columns of a Resource. A Resource is a view in the Stacks: it has no partitions of its own, and a filter on it reads fewer partitions of the table beneath only when the view passes the partition column through unchanged. Proposal: take `partition_by`, `cluster_by` and `require_partition_filter` from the dbt manifest of the model beneath the view, through the lineage, and the size and the number of partitions from BigQuery; when the view derives the column, say so instead of promising savings. *Raised on 2026-10-23.* *Note of 2026-10-25: the Data Admin confirms them when adding the Resource, and sets what cannot be derived ([FR-CO-34](03-collections.md#fr-co-34)).*
- [x] <a id="op-sr-13"></a>**OP-SR-13** · Decide who sees the queries of others: on a Resource ([FR-SR-44](#fr-sr-44)) and under "All" in the panel of Query ([FR-SR-43](#fr-sr-43)). *Note of 2026-10-23: "All" in the panel is for the Data Team only ([DEC-UX-20](../../design/principles.md#dec-ux-20)); what remains is the tab Queries of a Resource, where the same rule would show a colleague only their own queries and the numbers.* The Query Log is readable only by the Data Team and whoever ran a query ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)). Max asked on 2026-10-23 for an "All" in the panel of Query, next to your own. Proposal: every User sees the queries of others on what they may see, with who, when, how and what it read, but not their SQL. *Raised on 2026-10-23.* *Decided on 2026-10-26, by Max: everyone sees who, when, how and what it read; the SQL shows to its author, the Owner Unit of the Resource and the Data Team ([DEC-SR-31](#dec-sr-31)).*
- [ ] <a id="op-sr-14"></a>**OP-SR-14** · Work out what follows "Make it an anomaly" on a Signal ([FR-SR-30](#fr-sr-30)): how the Anomaly shows on the Resource Card and in its History ([FR-RC-04](05-resource-card.md#fr-rc-04), [FR-RC-05](05-resource-card.md#fr-rc-05)), who resolves it, and when it is closed. The link is in the Messages on a Resource; what it leads to is not designed. *Raised on 2026-10-24, while checking the screens against the requirements.*
- [ ] <a id="op-sr-15"></a>**OP-SR-15** · Decide how the Pre-flight treats a query without a partition filter on a Resource that requires one ([FR-CO-34](03-collections.md#fr-co-34)): BigQuery refuses such a query when the table beneath requires it, and the Data Admin can require it in Data Hub too. Proposal: the Pre-flight blocks it, names the partition column, and offers to add the filter, instead of the warning of [FR-SR-40](#fr-sr-40). *Raised on 2026-10-25, while designing how a Resource is stored.*
- [ ] <a id="op-sr-16"></a>**OP-SR-16** · Work out what marking a Resource deprecated holds ([FR-SR-50](#fr-sr-50)): whether it asks for a reason and what to use instead, how it shows in search, on a Lens and for Claude, and whether a new Lens can still be built on it. Proposal: a reason is asked, what to use instead is optional; a label next to the Level, wherever the Level shows; a new Lens on it is possible, with a warning. *Raised on 2026-10-26, in the review of Max.*
- [ ] <a id="op-sr-17"></a>**OP-SR-17** · Work out the Request to run a query above 1 GB ([DEC-SR-29](#dec-sr-29)): what accepting it allows, one run or the query as it is, and for how long; whether a change to its SQL needs a new Request; and its timeout, as for a Lens ([OP-LE-10](09-lenses.md#op-le-10)). The Message Catalogue has the Request ([MSG-QRY-01](message-catalogue.md#msg-qry-01)) and its decision ([MSG-CNV-05](message-catalogue.md#msg-cnv-05)). *Raised on 2026-10-28, while making the Message Catalogue.*

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Artifact registry](01-artifact-registry.md)
- [Collections](03-collections.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
