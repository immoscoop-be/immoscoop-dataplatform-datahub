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

**In one sentence:** a Data Admin registers every Resource in Data Hub personally, with its full name in BigQuery, a Display Name and a Collection; from then on Data Hub knows it, assesses its Level and keeps its Log, until the Owner publishes it to the company, which can then find, read, query and discuss it.

*Functional domain 4 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: a book is only in the library once the librarian registers it. It then stands on a shelf, has a title, belongs to a collection and gets a catalogue card. Only when the curator releases it is it in general circulation.

## Decisions

- <a id="dec-sr-01"></a>**DEC-SR-01** · There is one Stack: the dataset `dbt_prod_stacks`. Because a Resource is registered with its full name, more Stacks can be added later without changing the model.
- <a id="dec-sr-02"></a>**DEC-SR-02** · The Registration in Data Hub is the index. Being in a Stack is necessary, because the service account of Data Hub can only read there, but it is not enough: a view only exists for Data Hub once a Data Admin registers it. This replaces the earlier decision "the Stacks are the index".
- <a id="dec-sr-03"></a>**DEC-SR-03** · Only a Data Admin registers Resources: a member of the Role Group of the Data Team from [User management](02-user-management.md). At Registration, the Data Admin chooses the Collection straight away.
- <a id="dec-sr-04"></a>**DEC-SR-04** · A Resource has two identities: a Key, the full name `project.dataset.table`, and a Display Name, readable and unique, that the Data Admin chooses.
- <a id="dec-sr-05"></a>**DEC-SR-05** · At Registration, the Level is derived, and it is at most 2. A new Resource is not yet published, and therefore only visible to the Data Team and to the Owner of its Collection.
- <a id="dec-sr-06"></a>**DEC-SR-06** · Visibility depends on Publication, not on the Level. Publishing is a deliberate switch that the Owner flips. That way, a Resource does not disappear for those who use it every time the Level briefly drops. *Note of 2026-10-19: a published Resource is visible to everyone who sees its Collection, the whole company only when the Collection is public ([DEC-CO-12](03-collections.md#dec-co-12)).*
- <a id="dec-sr-07"></a>**DEC-SR-07** · The first Publication is only possible from Described, and is at once the first Confirmation: with it, the Resource rises to Confirmed.
- <a id="dec-sr-08"></a>**DEC-SR-08** · A published Resource stays published, even if its Level drops afterwards. The Owner then gets an alert, the lower Level is visible on the Resource Card and on every Lens and Report built on it, and the Owner confirms again without touching the Publication.
- <a id="dec-sr-09"></a>**DEC-SR-09** · The Log works with fixed Log IDs from a catalogue. Every Log Entry refers to a Log ID, with the extra parameters in a JSON field. The text is only built at display time from the template and the parameters, so that the Log stays compact and filterable.
- <a id="dec-sr-10"></a>**DEC-SR-10** · Search across names, descriptions and Log texts happens in Postgres itself: full-text search, complemented by trigrams for typos and half-remembered names. Semantic search with pgvector may follow later. A separate search engine is not needed.
- <a id="dec-sr-11"></a>**DEC-SR-11** · At Registration, Data Hub stores a Fingerprint of the Resource, as the basis for later comparisons.
- <a id="dec-sr-12"></a>**DEC-SR-12** · Every Registration sends a message to the Message Centre of the Data Admins.

Further decisions on using a Resource are under [Using a Resource](#using-a-resource).

## Terms

| Term | Meaning |
| --- | --- |
| Stack | A dataset in BigQuery with mart views that the Data Team releases, as authorized views onto the datasets behind them. Today there is one: `dbt_prod_stacks` |
| Resource | A registered view from a Stack: one book on the shelves |
| Key | The full name of the view in BigQuery, `project.dataset.table` |
| Display Name | The readable, unique name of the Resource, as business sees it, for example "Agency purity" |
| Data Admin | A member of the Role Group of the Data Team, who registers and manages Resources |
| Publication | The switch with which the Owner makes a Resource visible to everyone who sees its Collection: the whole company when the Collection is public |
| Log ID | The fixed code of a kind of Log Entry, with a template and a list of parameters, for example `RES-001` |
| Fingerprint | A set of hashes of the structure, the types and the descriptions of a Resource at a given moment |
| Signal | A remark reporting that something seems odd about the data; it can grow into an Anomaly |

## Flow: registering a Resource

1. **Register.** In the admin of Data Hub, the Data Admin enters the full name and chooses a Display Name and a Collection.
2. **Check.** Data Hub checks that the view lies in a Stack and appears as a Node in the current Artifacts of the [Artifact registry](01-artifact-registry.md).
3. **Link.** The Resource is linked to its Node in the manifest and the catalog.
4. **Describe.** The description of the view and its columns comes from the Artifacts.
5. **Assess.** The Level is derived: Available if the description is incomplete, Described if it is complete. Never higher.
6. **Take a Fingerprint.** Data Hub stores the hashes of structure, types and descriptions.
7. **Open the Log.** The first Log Entries are written: the Registration, the Collection and the Level.
8. **Notify.** A message goes to the Message Centre of the Data Admins.

## Flow: publishing a Resource

1. **Ready.** The Resource is at Described and visible to the Owner of its Collection.
2. **Publish.** The Owner checks the documentation and switches the Publication on. That is at once the first Confirmation: the Resource rises to Confirmed and is visible to the whole company.
3. **Drop.** If the Level drops later, for example because of a structural Change, the Resource stays published. The Owner gets an alert, and the lower Level is visible everywhere.
4. **Reconfirm.** The Owner confirms again, without touching the Publication.

## Using a Resource

Whoever may see a Resource can find it, read it, query it, help describe it and discuss it. What someone sees always follows the Publication: an unpublished Resource is only findable and readable for the Data Team and for the Owner.

- <a id="dec-sr-13"></a>**DEC-SR-13** · Finding works in three ways: searching on title, description, Collection and Owner; browsing per Collection; and navigating via the Domain Model. A search result shows title, description, Collection and Owner.
- <a id="dec-sr-14"></a>**DEC-SR-14** · The link with the Domain Model is derived from the manifest and the lineage, without manual work. Colleciónes gets no special treatment in this: it is part of the manifest like everything else. A Resource from dbt-prod thus finds its Entities via the models further along its lineage. A Resource without an Entity in its lineage stays findable via search and Collection.
- <a id="dec-sr-15"></a>**DEC-SR-15** · Reading a Resource happens in tabs: Overview, Columns, Lineage, EDA, History, Conversations and Preview. Usage, who uses the Resource in Lenses, Reports and feeds, comes later.
- <a id="dec-sr-16"></a>**DEC-SR-16** · Querying comes in two flavours. Via Claude, it is free SQL, also across multiple Resources, with joins. In the interface there is only a preview of the first rows, no query builder: real questions need joins, and those belong with Claude and, later, with Lenses.
- <a id="dec-sr-17"></a>**DEC-SR-17** · When Claude queries on behalf of a User, Data Hub checks that every Resource in the query is visible to that User, and a limit on scanned bytes applies. Every query gets a label with the User.
- <a id="dec-sr-18"></a>**DEC-SR-18** · Executed queries are not stored in Data Hub in v1. BigQuery keeps its own job log for 180 days; query history may be added later.
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

### Kinds of Reaction

| Type | For | Who gets a notification |
| --- | --- | --- |
| Question | A question about the Resource, for example how to read a field | The Owner, and whoever is already in the conversation |
| Remark | A remark or tip for others | Whoever is already in the conversation |
| Signal | Something seems odd about the data; it can become an Anomaly | The Owner and the Data Team |

## Requirements

<a id="fr-sr-01"></a>
### FR-SR-01 · Only Data Admins register, rename and deregister

**Status:** Specified · **Confluence:** SR-01

Only Data Admins can register Resources, change their name and deregister them.

<a id="fr-sr-02"></a>
### FR-SR-02 · A Registration needs a full name, a Display Name and a Collection

**Status:** Specified · **Confluence:** SR-02

A Registration requires three things: the full name, a Display Name and a Collection.

<a id="fr-sr-03"></a>
### FR-SR-03 · The view must be in a Stack and in the current Artifacts

**Status:** Specified · **Confluence:** SR-03

The view must lie in a Stack on which the service account of Data Hub has read access, and must appear as a Node in the current Artifacts. Otherwise the Registration is refused, with the reason.

<a id="fr-sr-04"></a>
### FR-SR-04 · The Key is unique

**Status:** Specified · **Confluence:** SR-04

The Key is unique: a view can only be registered once.

<a id="fr-sr-05"></a>
### FR-SR-05 · The Display Name is required, unique and can be changed

**Status:** Specified · **Confluence:** SR-05

The Display Name is required and unique. It can be changed later; every change goes into the Log.

<a id="fr-sr-06"></a>
### FR-SR-06 · The description comes from the Artifacts

**Status:** Specified · **Confluence:** SR-06

The description comes from the Artifacts and is not retyped in Data Hub.

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

**Status:** Specified · **Confluence:** SR-11

A Log Entry consists of a Log ID, the Resource, the parameters as JSON, the actor (a person or Data Hub itself) and the timestamp. Free text is never stored.

<a id="fr-sr-12"></a>
### FR-SR-12 · Log IDs come from a fixed catalogue

**Status:** Specified · **Confluence:** SR-12

The Log IDs are in a fixed catalogue (see the [Log catalogue](log-catalogue.md)). A new kind of Log Entry means a new Log ID, not free text.

<a id="fr-sr-13"></a>
### FR-SR-13 · Names, descriptions and Log texts are searchable

**Status:** Specified · **Confluence:** SR-13

The built texts of names, descriptions and Log Entries are searchable, by words and with tolerance for typos.

<a id="fr-sr-14"></a>
### FR-SR-14 · Deregistration keeps the Log and history

**Status:** Specified · **Confluence:** SR-14

A deregistered Resource disappears from the index and from its Collection. Its Log and history are kept.

<a id="fr-sr-15"></a>
### FR-SR-15 · All texts in the app are in English

**Status:** Specified · **Confluence:** SR-15

All texts in the app are in English: the interface, the names and the templates of the Log.

<a id="fr-sr-16"></a>
### FR-SR-16 · Only the Owner publishes

**Status:** Specified · **Confluence:** SR-16

Only the Owner of the Collection can publish a Resource.

<a id="fr-sr-17"></a>
### FR-SR-17 · The first Publication, from Described, is the first Confirmation

**Status:** Specified · **Confluence:** SR-17

The first Publication is only possible when the Resource is at Described. It is at once the first Confirmation: the Resource rises to Confirmed.

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

**Status:** Specified · **Confluence:** SR-20

After a drop, the Owner confirms again. Reconfirming changes nothing about the Publication.

<a id="fr-sr-21"></a>
### FR-SR-21 · Search on title, description, Collection and Owner

**Status:** Specified · **Confluence:** SR-21

Search covers title, description, Collection and Owner. A result shows those four, and only Resources the User may see.

<a id="fr-sr-22"></a>
### FR-SR-22 · Browse per Collection

**Status:** Specified · **Confluence:** SR-22

Browsing per Collection shows the Resources of a Collection, with the colour and the icon of that Collection.

<a id="fr-sr-23"></a>
### FR-SR-23 · Derive the Entities from the manifest and the lineage

**Status:** Specified · **Confluence:** SR-23

The Entities of a Resource are derived from the manifest and the lineage, in the same way for every Resource. Via an Entity of the Domain Model, you find the Resources that are about it.

<a id="fr-sr-24"></a>
### FR-SR-24 · Read a Resource in tabs

**Status:** Specified · **Confluence:** SR-24

A Resource is read in the tabs Overview, Columns, Lineage, EDA, History, Conversations and Preview. History is filterable by kind of Log Entry.

<a id="fr-sr-25"></a>
### FR-SR-25 · The preview shows a limited number of rows

**Status:** Specified · **Confluence:** SR-25

The Preview shows a limited number of first rows. There is no query builder in the interface.

<a id="fr-sr-26"></a>
### FR-SR-26 · Free SQL via Claude, over visible Resources only

**Status:** Specified · **Confluence:** SR-26

Via Claude, a User can have free SQL executed over the Resources they may see. A query that touches a Resource they cannot see is refused.

<a id="fr-sr-27"></a>
### FR-SR-27 · A byte limit and a User label on every query

**Status:** Specified · **Confluence:** SR-27

Every query gets a limit on scanned bytes and a label with the User. Executed queries are not stored in Data Hub in v1.

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

**Status:** Proposed

The Registration is refused. After the next prod run, the Data Admin can try again.

<a id="ec-sr-02"></a>
### EC-SR-02 · A registered view disappears from the Artifacts

**Status:** Proposed

The Resource gets a Log Entry and is flagged as missing. It is not deregistered automatically; the Data Admin decides.

<a id="ec-sr-03"></a>
### EC-SR-03 · A view is renamed in BigQuery

**Status:** Proposed

The Data Admin links the new full name to the existing Resource, so that it keeps its ID, Log and Confirmations.

<a id="ec-sr-04"></a>
### EC-SR-04 · A second Stack is added

**Status:** Proposed

The service account of Data Hub gets read access to it, via Terraform. After that, views from that Stack can be registered like any other.

## Out of scope

How the Level evolves after Registration ([Maturity and release](06-maturity-and-release.md)), managing Collections ([Collections](03-collections.md)), the Message Centre and notifications ([Log and notifications](07-log-and-notifications.md)), fetching and comparing the Artifacts ([Artifact registry](01-artifact-registry.md)), and working out conversations and their notifications ([Conversations](14-conversations.md)).

## Open points

- [ ] <a id="op-sr-01"></a>**OP-SR-01** · Agree a convention for the Display Names of Resources.
- [ ] <a id="op-sr-02"></a>**OP-SR-02** · Complete the [Log catalogue](log-catalogue.md), with the Log IDs from the other domains.
- [ ] <a id="op-sr-03"></a>**OP-SR-03** · Work out what happens to Lenses and Reports when their Resource is deregistered.
- [ ] <a id="op-sr-04"></a>**OP-SR-04** · Work out the Message Centre of the Data Admins in the domain [Log and notifications](07-log-and-notifications.md).
- [ ] <a id="op-sr-05"></a>**OP-SR-05** · Later: work out whether an Owner can unpublish a Resource, and what then happens to the Lenses and Reports of colleagues that depend on it.
- [x] <a id="op-sr-06"></a>**OP-SR-06** · Work out how Resources are read, found, described and commented on.
- [ ] <a id="op-sr-07"></a>**OP-SR-07** · Decide the limit on scanned bytes and the number of rows in the Preview.
- [ ] <a id="op-sr-08"></a>**OP-SR-08** · Later: query history in Data Hub, and the Usage tab.
- [ ] <a id="op-sr-09"></a>**OP-SR-09** · Confirm or adjust the edge cases above.

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Artifact registry](01-artifact-registry.md)
- [Collections](03-collections.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
