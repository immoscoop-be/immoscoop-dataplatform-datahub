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

**In one sentence:** a data admin registers every resource in Data Hub personally, with its full name in BigQuery, a display name and a collection; from then on Data Hub knows it, assesses its level and keeps its log, until the owner publishes it to the company, which can then find, read, query and discuss it.

*Functional domain 4 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: a book is only in the library once the librarian registers it. It then stands on a shelf, has a title, belongs to a collection and gets a catalogue card. Only when the curator releases it is it in general circulation.

## Decisions

- <a id="dec-sr-01"></a>**DEC-SR-01** · There is one stack: the dataset `dbt_prod_stacks`. Because a resource is registered with its full name, more stacks can be added later without changing the model.
- <a id="dec-sr-02"></a>**DEC-SR-02** · The registration in Data Hub is the index. Being in a stack is necessary, because the service account of Data Hub can only read there, but it is not enough: a view only exists for Data Hub once a data admin registers it. This replaces the earlier decision "the stacks are the index".
- <a id="dec-sr-03"></a>**DEC-SR-03** · Only a data admin registers resources: a member of the role group of the data team from [User management](02-user-management.md). At registration, the data admin chooses the collection straight away.
- <a id="dec-sr-04"></a>**DEC-SR-04** · A resource has two identities: a key, the full name `project.dataset.table`, and a display name, readable and unique, that the data admin chooses.
- <a id="dec-sr-05"></a>**DEC-SR-05** · At registration, the level is derived, and it is at most 2. A new resource is not yet published, and therefore only visible to data and to the owner of its collection.
- <a id="dec-sr-06"></a>**DEC-SR-06** · Visibility depends on publication, not on the level. Publishing is a deliberate switch that the owner turns on. That way, a resource does not disappear for those who use it every time the level briefly drops.
- <a id="dec-sr-07"></a>**DEC-SR-07** · The first publication is only possible from Described, and is at once the first confirmation: with it, the resource rises to Confirmed.
- <a id="dec-sr-08"></a>**DEC-SR-08** · A published resource stays published, even if its level drops afterwards. The owner then gets an alert, the lower level is visible on the resource card and on every lens and report built on it, and the owner confirms again without touching the publication.
- <a id="dec-sr-09"></a>**DEC-SR-09** · The log works with fixed log IDs from a catalogue. Every log entry refers to a log ID, with the extra parameters in a JSON field. The text is only built at display time from the template and the parameters, so that the log stays compact and filterable.
- <a id="dec-sr-10"></a>**DEC-SR-10** · Search across names, descriptions and log texts happens in Postgres itself: full-text search, complemented by trigrams for typos and half-remembered names. Semantic search with pgvector may follow later. A separate search engine is not needed.
- <a id="dec-sr-11"></a>**DEC-SR-11** · At registration, Data Hub stores a fingerprint of the resource, as the basis for later comparisons.
- <a id="dec-sr-12"></a>**DEC-SR-12** · Every registration sends a message to the message centre of the data admins.

Further decisions on using a resource are under [Using a resource](#using-a-resource).

## Terms

| Term | Meaning |
| --- | --- |
| Stack | A dataset in BigQuery with mart views that the data team releases, as authorized views onto the datasets behind them. Today there is one: `dbt_prod_stacks` |
| Resource | A registered view from a stack: one book on the shelves |
| Key | The full name of the view in BigQuery, `project.dataset.table` |
| Display name | The readable, unique name of the resource, as business sees it, for example "Agency purity" |
| Data admin | A member of the role group of the data team, who registers and manages resources |
| Publication | The switch with which the owner makes a resource visible to the whole company |
| Log ID | The fixed code of a kind of log entry, with a template and a list of parameters, for example `RES-001` |
| Fingerprint | A set of hashes of the structure, the types and the descriptions of a resource at a given moment |
| Signal | A remark reporting that something seems odd about the data; it can grow into an anomaly |

## Flow: registering a resource

1. **Register.** In the admin of Data Hub, the data admin enters the full name and chooses a display name and a collection.
2. **Check.** Data Hub checks that the view lies in a stack and appears as a node in the current artifacts of the [Artifact registry](01-artifact-registry.md).
3. **Link.** The resource is linked to its node in the manifest and the catalog.
4. **Describe.** The description of the view and its columns comes from the artifacts.
5. **Assess.** The level is derived: Available if the description is incomplete, Described if it is complete. Never higher.
6. **Take a fingerprint.** Data Hub stores the hashes of structure, types and descriptions.
7. **Open the log.** The first log entries are written: the registration, the collection and the level.
8. **Notify.** A message goes to the message centre of the data admins.

## Flow: publishing a resource

1. **Ready.** The resource is at Described and visible to the owner of its collection.
2. **Publish.** The owner checks the documentation and switches the publication on. That is at once the first confirmation: the resource rises to Confirmed and is visible to the whole company.
3. **Drop.** If the level drops later, for example because of a structural change, the resource stays published. The owner gets an alert, and the lower level is visible everywhere.
4. **Reconfirm.** The owner confirms again, without touching the publication.

## Using a resource

Whoever may see a resource can find it, read it, query it, help describe it and discuss it. What someone sees always follows the publication: an unpublished resource is only findable and readable for data and for the owner.

- <a id="dec-sr-13"></a>**DEC-SR-13** · Finding works in three ways: searching on title, description, collection and owner; browsing per collection; and navigating via the domain model. A search result shows title, description, collection and owner.
- <a id="dec-sr-14"></a>**DEC-SR-14** · The link with the domain model is derived from the manifest and the lineage, without manual work. Colleciónes gets no special treatment in this: it is part of the manifest like everything else. A resource from dbt-prod thus finds its entities via the models further along its lineage. A resource without an entity in its lineage stays findable via search and collection.
- <a id="dec-sr-15"></a>**DEC-SR-15** · Reading a resource happens in tabs: Overview, Columns, Lineage, EDA, History, Conversations and Preview. Usage, who uses the resource in lenses, reports and feeds, comes later.
- <a id="dec-sr-16"></a>**DEC-SR-16** · Querying comes in two flavours. Via Claude, it is free SQL, also across multiple resources, with joins. In the interface there is only a preview of the first rows, no query builder: real questions need joins, and those belong with Claude and, later, with lenses.
- <a id="dec-sr-17"></a>**DEC-SR-17** · When Claude queries on behalf of a user, Data Hub checks that every resource in the query is visible to that user, and a limit on scanned bytes applies. Every query gets a label with the user.
- <a id="dec-sr-18"></a>**DEC-SR-18** · Executed queries are not stored in Data Hub in v1. BigQuery keeps its own job log for 180 days; query history may be added later.
- <a id="dec-sr-19"></a>**DEC-SR-19** · The owner and the data team can supplement the description on top of the artifacts: intended use, pitfalls, anomalies, key fields and parameter fields. Every addition goes into the log, with who made it.
- <a id="dec-sr-20"></a>**DEC-SR-20** · Everyone who may see a resource can react to it. A reaction has a type: a question, a remark or a signal.
- <a id="dec-sr-21"></a>**DEC-SR-21** · A signal reports that something seems odd about the data. It goes to the owner and to the data team, and they can turn it into an anomaly on the resource card, with a period and the impact.

### The tabs of a resource

| Tab | What you read | v1 |
| --- | --- | --- |
| Overview | Table description, display name and key, collection and owner, level and publication, freshness, known behaviour: intended use and pitfalls | Yes |
| Columns | Columns with description and type, relationships to other tables, and which fields serve as parameters | Yes |
| Lineage | Where the resource comes from, also across the boundary between dbt-prod and Colleciónes | Yes |
| EDA | The exploration by the owner | Yes |
| History | The log, filterable by kind: changes, level, publication, incidents and anomalies | Yes |
| Conversations | Questions, remarks and signals about the resource | Yes |
| Preview | The first rows of the data | Yes |
| Usage | Which lenses, reports and feeds depend on the resource | Later |

### Kinds of reaction

| Type | For | Who gets a notification |
| --- | --- | --- |
| Question | A question about the resource, for example how to read a field | The owner, and whoever is already in the conversation |
| Remark | A remark or tip for others | Whoever is already in the conversation |
| Signal | Something seems odd about the data; it can become an anomaly | The owner and the data team |

## Requirements

<a id="fr-sr-01"></a>
### FR-SR-01 · Only data admins register, rename and deregister

**Status:** Specified · **Confluence:** SR-01

Only data admins can register resources, change their name and deregister them.

<a id="fr-sr-02"></a>
### FR-SR-02 · A registration needs a full name, a display name and a collection

**Status:** Specified · **Confluence:** SR-02

A registration requires three things: the full name, a display name and a collection.

<a id="fr-sr-03"></a>
### FR-SR-03 · The view must be in a stack and in the current artifacts

**Status:** Specified · **Confluence:** SR-03

The view must lie in a stack on which the service account of Data Hub has read access, and must appear as a node in the current artifacts. Otherwise the registration is refused, with the reason.

<a id="fr-sr-04"></a>
### FR-SR-04 · The key is unique

**Status:** Specified · **Confluence:** SR-04

The key is unique: a view can only be registered once.

<a id="fr-sr-05"></a>
### FR-SR-05 · The display name is required, unique and can be changed

**Status:** Specified · **Confluence:** SR-05

The display name is required and unique. It can be changed later; every change goes into the log.

<a id="fr-sr-06"></a>
### FR-SR-06 · The description comes from the artifacts

**Status:** Specified · **Confluence:** SR-06

The description comes from the artifacts and is not retyped in Data Hub.

<a id="fr-sr-07"></a>
### FR-SR-07 · The level at registration is at most Described

**Status:** Specified · **Confluence:** SR-07

At registration, the level is derived and is at most 2, Described. The resource is then not yet published, and only visible to data and to the owner of its collection.

<a id="fr-sr-08"></a>
### FR-SR-08 · Store a fingerprint at registration

**Status:** Specified · **Confluence:** SR-08

At registration, a fingerprint is stored: a hash of the structure (the column names), a hash of the types, a hash of the descriptions, and the checksum of the code from the manifest.

<a id="fr-sr-09"></a>
### FR-SR-09 · Open the log at registration

**Status:** Specified · **Confluence:** SR-09

At registration, the log of the resource starts with the entries for registration, collection and level.

<a id="fr-sr-10"></a>
### FR-SR-10 · Notify the data admins of every registration

**Status:** Specified · **Confluence:** SR-10

Every registration sends a message to the message centre of the data admins.

<a id="fr-sr-11"></a>
### FR-SR-11 · Structure of a log entry

**Status:** Specified · **Confluence:** SR-11

A log entry consists of a log ID, the resource, the parameters as JSON, the actor (a person or Data Hub itself) and the timestamp. Free text is never stored.

<a id="fr-sr-12"></a>
### FR-SR-12 · Log IDs come from a fixed catalogue

**Status:** Specified · **Confluence:** SR-12

The log IDs are in a fixed catalogue (see the [log catalogue](log-catalogue.md)). A new kind of log entry means a new log ID, not free text.

<a id="fr-sr-13"></a>
### FR-SR-13 · Names, descriptions and log texts are searchable

**Status:** Specified · **Confluence:** SR-13

The built texts of names, descriptions and log entries are searchable, by words and with tolerance for typos.

<a id="fr-sr-14"></a>
### FR-SR-14 · Deregistration keeps the log and history

**Status:** Specified · **Confluence:** SR-14

A deregistered resource disappears from the index and from its collection. Its log and history are kept.

<a id="fr-sr-15"></a>
### FR-SR-15 · All texts in the app are in English

**Status:** Specified · **Confluence:** SR-15

All texts in the app are in English: the interface, the names and the templates of the log.

<a id="fr-sr-16"></a>
### FR-SR-16 · Only the owner publishes

**Status:** Specified · **Confluence:** SR-16

Only the owner of the collection can publish a resource.

<a id="fr-sr-17"></a>
### FR-SR-17 · The first publication, from Described, is the first confirmation

**Status:** Specified · **Confluence:** SR-17

The first publication is only possible when the resource is at Described. It is at once the first confirmation: the resource rises to Confirmed.

<a id="fr-sr-18"></a>
### FR-SR-18 · Visibility depends only on publication

**Status:** Specified · **Confluence:** SR-18

Who sees the resource depends only on the publication: not published means visible to data and the owner; published means visible to the whole company.

<a id="fr-sr-19"></a>
### FR-SR-19 · A published resource stays published when its level drops

**Status:** Specified · **Confluence:** SR-19

A published resource stays published when its level drops. The owner gets an alert, and the current level is visible on the resource card and on every lens and report that depends on it.

<a id="fr-sr-20"></a>
### FR-SR-20 · Reconfirm after a drop

**Status:** Specified · **Confluence:** SR-20

After a drop, the owner confirms again. Reconfirming changes nothing about the publication.

<a id="fr-sr-21"></a>
### FR-SR-21 · Search on title, description, collection and owner

**Status:** Specified · **Confluence:** SR-21

Search covers title, description, collection and owner. A result shows those four, and only resources the user may see.

<a id="fr-sr-22"></a>
### FR-SR-22 · Browse per collection

**Status:** Specified · **Confluence:** SR-22

Browsing per collection shows the resources of a collection, with the colour and the icon of that collection.

<a id="fr-sr-23"></a>
### FR-SR-23 · Derive the entities from the manifest and the lineage

**Status:** Specified · **Confluence:** SR-23

The entities of a resource are derived from the manifest and the lineage, in the same way for every resource. Via an entity of the domain model, you find the resources that are about it.

<a id="fr-sr-24"></a>
### FR-SR-24 · Read a resource in tabs

**Status:** Specified · **Confluence:** SR-24

A resource is read in the tabs Overview, Columns, Lineage, EDA, History, Conversations and Preview. History is filterable by kind of log entry.

<a id="fr-sr-25"></a>
### FR-SR-25 · The preview shows a limited number of rows

**Status:** Specified · **Confluence:** SR-25

The Preview shows a limited number of first rows. There is no query builder in the interface.

<a id="fr-sr-26"></a>
### FR-SR-26 · Free SQL via Claude, over visible resources only

**Status:** Specified · **Confluence:** SR-26

Via Claude, a user can have free SQL executed over the resources they may see. A query that touches a resource they cannot see is refused.

<a id="fr-sr-27"></a>
### FR-SR-27 · A byte limit and a user label on every query

**Status:** Specified · **Confluence:** SR-27

Every query gets a limit on scanned bytes and a label with the user. Executed queries are not stored in Data Hub in v1.

<a id="fr-sr-28"></a>
### FR-SR-28 · The owner and the data team supplement known behaviour

**Status:** Specified · **Confluence:** SR-28

The owner and the data team can supplement intended use, pitfalls, anomalies, key fields and parameter fields. Every addition goes into the log.

<a id="fr-sr-29"></a>
### FR-SR-29 · React with a question, a remark or a signal

**Status:** Specified · **Confluence:** SR-29

Everyone who may see a resource can react with a question, a remark or a signal.

<a id="fr-sr-30"></a>
### FR-SR-30 · A signal can become an anomaly

**Status:** Specified · **Confluence:** SR-30

A signal goes to the owner and the data team, and they can turn it into an anomaly on the resource card.

## Log catalogue

The first draft of the log catalogue started on this page. Because it spans all domains, it now lives in its own file: [log catalogue](log-catalogue.md).

## Search

| What | How | When |
| --- | --- | --- |
| Word search | Full-text search in Postgres, with the English configuration and `unaccent` | Now |
| Typos and half-remembered names | Trigrams in Postgres (`pg_trgm`) | Now |
| Search by meaning, also for Claude | Embeddings with pgvector | Later |

## Edge cases

Proposals to confirm.

<a id="ec-sr-01"></a>
### EC-SR-01 · The view is not (yet) in the artifacts

**Status:** Proposed

The registration is refused. After the next prod run, the data admin can try again.

<a id="ec-sr-02"></a>
### EC-SR-02 · A registered view disappears from the artifacts

**Status:** Proposed

The resource gets a log entry and is flagged as missing. It is not deregistered automatically; the data admin decides.

<a id="ec-sr-03"></a>
### EC-SR-03 · A view is renamed in BigQuery

**Status:** Proposed

The data admin links the new full name to the existing resource, so that it keeps its ID, log and confirmations.

<a id="ec-sr-04"></a>
### EC-SR-04 · A second stack is added

**Status:** Proposed

The service account of Data Hub gets read access to it, via Terraform. After that, views from that stack can be registered like any other.

## Out of scope

How the level evolves after registration ([Maturity and release](06-maturity-and-release.md)), managing collections ([Collections](03-collections.md)), the message centre and notifications ([Log and notifications](07-log-and-notifications.md)), fetching and comparing the artifacts ([Artifact registry](01-artifact-registry.md)), and working out conversations and their notifications ([Conversations](14-conversations.md)).

## Open points

- [ ] <a id="op-sr-01"></a>**OP-SR-01** · Agree a convention for the display names of resources.
- [ ] <a id="op-sr-02"></a>**OP-SR-02** · Complete the [log catalogue](log-catalogue.md), with the log IDs from the other domains.
- [ ] <a id="op-sr-03"></a>**OP-SR-03** · Work out what happens to lenses and reports when their resource is deregistered.
- [ ] <a id="op-sr-04"></a>**OP-SR-04** · Work out the message centre of the data admins in the domain [Log and notifications](07-log-and-notifications.md).
- [ ] <a id="op-sr-05"></a>**OP-SR-05** · Later: work out whether an owner can unpublish a resource, and what then happens to the lenses and reports of colleagues that depend on it.
- [x] <a id="op-sr-06"></a>**OP-SR-06** · Work out how resources are read, found, described and commented on.
- [ ] <a id="op-sr-07"></a>**OP-SR-07** · Decide the limit on scanned bytes and the number of rows in the Preview.
- [ ] <a id="op-sr-08"></a>**OP-SR-08** · Later: query history in Data Hub, and the Usage tab.
- [ ] <a id="op-sr-09"></a>**OP-SR-09** · Confirm or adjust the edge cases above.

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Artifact registry](01-artifact-registry.md)
- [Collections](03-collections.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
