# Artifact registry

| | |
| --- | --- |
| Domain | 1 of Data Hub · code `AR` |
| Type | Working document |
| Tags | context, strategy |
| Area | Tooling, Technical |
| Status | Specified; edge cases and open points remain |
| Source of truth | This file for the functional rules of this domain; the decisions are in the [Data Hub overview](../../overview/data-hub.md) |
| Migrated from | [ptditt - Tooling - Data Hub - Artifact registry](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371340830) (Confluence, Dutch), last modified 2026-10-15, migrated 2026-10-17 |

**In one sentence:** Data Hub knows at any moment what is in the dbt projects, how it fits together, and what has changed since the previous prod run.

*Functional domain 1 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms, this is the accession register: at every prod run, the library records what was added to the collection, what left it, and what changed.

> **Note:** not to be confused with GCP's Artifact Registry, which holds the Docker images of Data Hub. This domain is about the Artifacts of dbt: `manifest.json` and `catalog.json`.

## Decisions

The decisions for this domain are in the [Data Hub overview](../../overview/data-hub.md):

- Fetching: [DEC-DH-19](../../overview/data-hub.md#dec-dh-19) to [DEC-DH-22](../../overview/data-hub.md#dec-dh-22)
- Processing: [DEC-DH-23](../../overview/data-hub.md#dec-dh-23) to [DEC-DH-25](../../overview/data-hub.md#dec-dh-25)
- Changes: [DEC-DH-26](../../overview/data-hub.md#dec-dh-26) to [DEC-DH-30](../../overview/data-hub.md#dec-dh-30)

Decisions taken while building this domain:

- <a id="dec-ar-01"></a>**DEC-AR-01** · The two dbt projects are `immoscoop_dataplatform_sql` (dbt-prod, project 9367) and `compilacion-colleciones-dbt` (Colleciónes, project 17121), in dbt Cloud account 576. Their Source Jobs are the daily full builds. Each environment of Data Hub reads the Source Jobs of the same environment of the data platform, so that uat of Data Hub is tested against uat of the data:

  | dbt project | Source Job for prod | Source Job for uat |
  | --- | --- | --- |
  | dbt-prod (9367) | 322950 · daily production build (prod) | 322951 · daily UAT build (uat) |
  | Colleciónes (17121) | 739004 · PROD - Scheduled - Daily build | 739003 · UAT - Scheduled - Daily build |

- <a id="dec-ar-02"></a>**DEC-AR-02** · dbt Cloud announces a finished run with a webhook (`job.run.completed`), signed with a secret that only dbt Cloud and Data Hub know. Data Hub does not poll. A delivery that is lost even after dbt Cloud's retries is recovered by fetching the run again by hand ([FR-AR-14](#fr-ar-14)).
- <a id="dec-ar-03"></a>**DEC-AR-03** · A source in one dbt project is linked to the Node in the other project that builds the same table: the same database, schema and table name. The link is made when the lineage is read, between the Current Versions of both projects, so it always follows both.

## Terms

| Term | Meaning |
| --- | --- |
| Source Job | The one prod job in dbt Cloud, per dbt project, whose Artifacts Data Hub uses: a full build that also runs `dbt docs generate`. uat of Data Hub reads the UAT counterpart ([DEC-AR-01](#dec-ar-01)) |
| Artifact Set | The Artifacts of one successful run of a Source Job: `manifest.json` and `catalog.json`, with run ID, git SHA and timestamp |
| Current Version | Per dbt project, the most recent fully processed Artifact Set; the rest of Data Hub works on it |
| Node | A model, seed, snapshot, source or exposure from the manifest, with its columns |
| Edge | A link in the lineage: this Node depends on that Node |
| Change | A difference for one Node between the new set and the previous Current Version |
| Log of a Resource | Everything that touches a Resource, including Changes deeper in the lineage |

## Flow

1. **Signal.** dbt Cloud reports a finished run, or Data Hub detects by itself that there is a new successful run.
2. **Fetch.** Data Hub fetches `manifest.json` and `catalog.json` from dbt Cloud.
3. **Store.** The files are stored unchanged, per project and per run.
4. **Process.** The set is read and normalised into Nodes, columns, Edges and tests.
5. **Switch.** Only when everything has succeeded does the set become the Current Version of the project.
6. **Compare.** The new version is compared with the previous one, and every Change is recorded.
7. **Propagate.** Every Change is followed through the lineage to the Resources that depend on it, and lands in their Log.

## The Domain Model in the manifest

What the dbt project that Colleciónes generates from the Domain Model tells Data Hub about Entities, as found on 2026-10-28 in `immoscoop_generated` 1.0.0, built by `compilacion-colleciones-domain-model`: 556 models over 42 Entities, in the layers `stg`, `intm` and `mrt`. Each model is made by a strategy of the generator, such as `Event`, `AtomicEvent`, `TransposedEvent`, `EntityStateMart`; the generator writes the facts below in one place for every strategy (`lib/domainMeta.js`).

**Per model, today.** Under `config`, every model carries:

- **tags** to select it by: `colleciones:entity:<entity>`, `colleciones:action:<action>`, `colleciones:actor:<actor>`, `colleciones:strategy:<strategy>` and `colleciones:layer:<layer>`;
- **`meta.domain`**: its Entity with its description, identifiers (name, description, type), adjectives and parents (`extends`); for a model of one action also the action, who performs it (`performedBy`), its contexts and its references, each with its target Entity, relation type and cardinality;
- **`meta.model`**: its strategy, kind and layer, its grain as a word (`event`, `state`, `stateChange`, `currentState`, `identifier`), and in plain language what it is and how to read it (`explanation`, `usage`).

**Per column, today:** only a name and a description.

**What Data Hub needs, and what is there:**

| Data Hub needs | In the manifest today | Missing |
| --- | --- | --- |
| The Entity of a Node ([FR-SR-23](04-stacks-and-resources.md#fr-sr-23)) | `meta.domain.entity` and the tag `colleciones:entity` | Nothing |
| The Entities of a Resource outside Colleciónes, such as a view in dbt-prod | The Colleciónes Nodes in its lineage ([FR-AR-08](#fr-ar-08)), each with its Entity | Nothing; Data Hub suggests, the Data Admin confirms |
| A field that `is` the identity of an Entity ([DEC-RC-06](05-resource-card.md#dec-rc-06)) | Only by name: a column named as an identifier of `meta.domain.identifiers`. On a state mart, the identity is in `identifierValue`, keyed by `identifierName` | Said per column |
| A field with a relation type ([DEC-RC-05](05-resource-card.md#dec-rc-05)) | On event models, the references of the action, in the generic columns `references` and `collections`. On state models, one column per reference of the Entity, such as `userId` on `homeLoanProfile`, whose relation type is only in its description; the references of an Entity are not in `meta.domain` | Said per column, and the references of an Entity in `meta.domain` |
| The grain as fields ([DEC-RC-07](05-resource-card.md#dec-rc-07)) | `meta.model.grain` names the kind of grain, not its columns | The columns |
| The version of the Domain Model ([FR-AR-15](#fr-ar-15)) | `RELEASE.json` of the package, outside the manifest | The release, per model |

**Proposed extension of the strategies** ([OP-AR-07](#op-ar-07)). All of it in the shared code of the generator, so every strategy follows: `lib/domainMeta.js`, the field kinds of `lib/fields.js`, which already tell primary, natural and foreign keys apart, and `DbtDocument.js`, which writes the yaml.

1. **`meta.domain` per column**, wherever the Domain Model says what the column is:
   - `maps: is`, with the Entity and identifier, such as `listing` `listingId`; for `eventId`, the Entity and action, such as `listing` `view`; on a state mart, `identifierValue` names `identifierName` as the column that says which identifier it is;
   - `maps: relation`, with the relation type, target Entity, identifier and cardinality, such as `references` `user` `userId` `one`;
   - `maps: generic`, for `identifiers`, `references` and `collections`, which hold several, each described in `meta.domain` of the model.
2. **The references of an Entity** in `meta.domain`, next to those of an action, so a state model says them as an event model does.
3. ~~The grain as columns, and the model type.~~ *Dropped on 2026-10-28: the grain and the model type are defined only in Data Hub, by the Data Admin ([DEC-RC-09](05-resource-card.md#dec-rc-09)); the grain a Colleciónes model declares is at most a suggestion.*
4. **The release of the Domain Model** in `meta.domain.release` of every model: the version and commit of `RELEASE.json`.

## Requirements

<a id="fr-ar-01"></a>
### FR-AR-01 · Fetch the Artifacts from dbt Cloud

**Status:** Implemented · **Confluence:** AR-01

Data Hub fetches the Artifacts from dbt Cloud itself. The repositories deliver nothing.

<a id="fr-ar-02"></a>
### FR-AR-02 · Two dbt projects, one Source Job each

**Status:** Implemented · **Confluence:** AR-02

There are two dbt projects: dbt-prod and Colleciónes. Per project, exactly one prod job is the Source Job.

<a id="fr-ar-03"></a>
### FR-AR-03 · Only successful runs of a Source Job

**Status:** Implemented · **Confluence:** AR-03

Only successful runs of a Source Job are fetched. Runs of other jobs are ignored.

<a id="fr-ar-04"></a>
### FR-AR-04 · Manifest and catalog only

**Status:** Implemented · **Confluence:** AR-04

Per run, `manifest.json` and `catalog.json` are fetched. Other artifacts are outside the first version.

<a id="fr-ar-05"></a>
### FR-AR-05 · Ingest a run at most once

**Status:** Implemented · **Confluence:** AR-05

A run is ingested at most once. A duplicate signal for the same run creates no duplicates.

<a id="fr-ar-06"></a>
### FR-AR-06 · Store the files unchanged and keep old versions

**Status:** Implemented · **Confluence:** AR-06

The fetched files are stored unchanged, per project and per run. Old versions are kept.

<a id="fr-ar-07"></a>
### FR-AR-07 · Normalise a set into Nodes, columns, Edges and tests

**Status:** Implemented · **Confluence:** AR-07

Processing normalises a set into Nodes, columns, Edges and tests. Columns combine the description from the manifest with the actual name and type from the catalog. Relationships tests are split out into column, target table and target column.

<a id="fr-ar-08"></a>
### FR-AR-08 · Lineage across the dbt projects

**Status:** Implemented · **Confluence:** AR-08

Lineage crosses the boundary between the dbt projects: Nodes from dbt-prod and Colleciónes are linked to each other.

<a id="fr-ar-09"></a>
### FR-AR-09 · Switch to a set only after complete processing

**Status:** Implemented · **Confluence:** AR-09

A set only becomes the Current Version of its project once it is fully processed. If processing fails, the previous version stays current, and the error is stored with the set.

<a id="fr-ar-10"></a>
### FR-AR-10 · Search by name, free text and lineage

**Status:** Implemented · **Confluence:** AR-10

Search works by name (also with a typo or a half-remembered name), by free text in descriptions and columns, and along the lineage in both directions.

<a id="fr-ar-11"></a>
### FR-AR-11 · Compare every new version Node by Node

**Status:** Specified · **Confluence:** AR-11

Every new Current Version is compared with the previous one, Node by Node. This yields Changes of five kinds: description, logic, type, structural, and Node added or removed (see [Kinds of Change](#kinds-of-change) below).

<a id="fr-ar-12"></a>
### FR-AR-12 · Propagate every Change downstream

**Status:** Specified · **Confluence:** AR-12

Every Change is followed downstream to all Resources that depend on it, however deep. Every affected Resource gets an entry in its Log, with the original Change and the distance in the lineage. Nothing is filtered out.

<a id="fr-ar-13"></a>
### FR-AR-13 · Anyone with access can read the Log

**Status:** Specified · **Confluence:** AR-13

Anyone with access to a Resource can read its Log.

<a id="fr-ar-14"></a>
### FR-AR-14 · Fetch and process a run again manually

**Status:** Implemented · **Confluence:** AR-14

A run can be fetched and processed again manually, for recovery and tests.

<a id="fr-ar-15"></a>
### FR-AR-15 · Read the Domain Model in use

**Status:** Proposed · **Source:** Max, 2026-10-26

Data Hub reads the Domain Model as it runs on prod, from the overview the server of Colleciónes deploys: its Entities with their identities, its relation types with their cardinality and inverse, and the references of every Entity and action. It uses them for every Resource, also one not built on a Colleciónes model, to suggest and check the mappings of its fields ([FR-CO-33](03-collections.md#fr-co-33), [DEC-RC-05](05-resource-card.md#dec-rc-05)). It reads it again when a new version is deployed, and records with each mapping the version it was made with.


<a id="fr-ar-16"></a>
### FR-AR-16 · A Node built from the Domain Model knows its Entity

**Status:** Proposed · **Source:** [OP-DH-06](../../overview/open-themes.md#op-dh-06), the manifest of `immoscoop_generated` read on 2026-10-28

registry reads `meta.domain`, `meta.model` and the `colleciones` tags of every Node and keeps per Node its Entity, its action, its strategy and its layer. The Entities of a Node outside Colleciónes are those of the Colleciónes Nodes in its lineage ([FR-SR-23](04-stacks-and-resources.md#fr-sr-23), [FR-AR-08](#fr-ar-08)).

<a id="fr-ar-17"></a>
### FR-AR-17 · The meta of a column fills in its mapping

**Status:** Proposed · **Source:** [OP-DH-06](../../overview/open-themes.md#op-dh-06) · depends on [OP-AR-07](#op-ar-07)

When the Data Admin adds a Resource ([FR-CO-33](03-collections.md#fr-co-33)), every field whose column carries `meta.domain` arrives filled in, with `is` or its relation type and the identity of its Entity, and the grain is suggested from what the model declares, for the Data Admin to confirm ([DEC-RC-09](05-resource-card.md#dec-rc-09)); the Data Admin confirms or changes them. On a Resource outside Colleciónes, a column named as an identifier of an Entity in its lineage is suggested as that identity. Each mapping records the release of the Domain Model it comes from ([FR-AR-15](#fr-ar-15)).

## Kinds of Change

This domain detects the Change and passes it on. What happens next (a warning on the Resource, notifying the Owner, running checks) belongs to the domains [Maturity and release](06-maturity-and-release.md), [Log and notifications](07-log-and-notifications.md), and [Checks and monitoring](08-checks-and-monitoring.md).

| Kind | When | Consequence, in another domain |
| --- | --- | --- |
| Description | A text on a table or field changes | In the Log; for the description of the Resource itself or one of its fields, a Message to the Owner ([FR-RC-17](05-resource-card.md#fr-rc-17)) |
| Logic | The code of a Node changes (a filter, a join); the schema stays the same | In the Log, notification to the Owner |
| Type | A field keeps its name but gets a different data type | In the Log; a warning on the Resource and a Message to the Owner ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)) |
| Structural | A field is added or removed, including a rename | In the Log; a warning on the Resource and a Message to the Owner ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)); the Level stays |
| Node added or removed | A model appears or disappears | In the Log of the Resources that depended on it |

## Edge cases

Proposals to confirm.

<a id="ec-ar-01"></a>
### EC-AR-01 · An older run arrives after a newer one

**Status:** Proposed

It is stored and processed, but does not become the Current Version: the Current Version never goes back in time.

<a id="ec-ar-02"></a>
### EC-AR-02 · The catalog is missing

**Status:** Proposed

Without `catalog.json`, the actual columns are not known. The set gets the status failed, with that reason, and the previous version stays current.

<a id="ec-ar-03"></a>
### EC-AR-03 · The table of a Resource is renamed

**Status:** Proposed

In the Artifacts, this looks like one Node disappearing and another appearing. The Resource keeps its history only once someone confirms the rename; the [Resources](04-stacks-and-resources.md) domain defines how (see [EC-SR-03](04-stacks-and-resources.md#ec-sr-03)).

*Note of 2026-10-28: reworded without the Stacks, which no longer exist ([DEC-DH-71](../../overview/data-hub.md#dec-dh-71)).*

<a id="ec-ar-04"></a>
### EC-AR-04 · An upstream model disappears

**Status:** Proposed

The Resources that depended on it get an entry in their Log, even if the table of the Resource itself is (still) unchanged.


*Note of 2026-10-28: reworded without the Stacks, which no longer exist ([DEC-DH-71](../../overview/data-hub.md#dec-dh-71)).*
## Out of scope

Which views are Resources and how their ID stays stable ([Resources](04-stacks-and-resources.md)), lowering the Level ([Maturity and release](06-maturity-and-release.md)), notifications and their channel ([Log and notifications](07-log-and-notifications.md)), and automatic checks ([Checks and monitoring](08-checks-and-monitoring.md)).

## Open points

- [x] <a id="op-ar-01"></a>**OP-AR-01** · At build time, record which dbt Cloud projects dbt-prod and Colleciónes are, and which job is the Source Job of each project. *Recorded on 2026-10-18 in [DEC-AR-01](#dec-ar-01). The prod Source Job of Colleciónes does not generate the docs yet; until "Generate docs on run" is on, its sets fail without a catalog ([EC-AR-02](#ec-ar-02)).*
- [x] <a id="op-ar-02"></a>**OP-AR-02** · Find out whether dbt Cloud can send a webhook after a successful run, or whether Data Hub polls after the scheduled time. *Decided on 2026-10-18: a webhook ([DEC-AR-02](#dec-ar-02)).*
- [ ] <a id="op-ar-03"></a>**OP-AR-03** · Confirm or adjust the edge cases above.
- [x] <a id="op-ar-04"></a>**OP-AR-04** · Decide how Nodes from dbt-prod and Colleciónes are linked to each other. *Decided on 2026-10-18, while building: by the table they build or read ([DEC-AR-03](#dec-ar-03)).*
- [ ] <a id="op-ar-06"></a>**OP-AR-06** · Find out where the overview of the Domain Model is served ([FR-AR-15](#fr-ar-15)), in which form Data Hub can read it, and how Data Hub learns of a new version: the release of the package `@compilacion/colleciones-domain-model` that the server pins per environment, or by checking. *Raised on 2026-10-26.*
- [ ] <a id="op-ar-07"></a>**OP-AR-07** · Decide the extension of the Colleciónes strategies so that the manifest says per column what the Domain Model says about it: `meta.domain` per column, the references of an Entity and the release of the Domain Model ([The Domain Model in the manifest](#the-domain-model-in-the-manifest)). Its alternative: Data Hub matches columns by name and the Data Admin fills in the rest by hand. *Raised on 2026-10-28, while reading the generated project for [OP-DH-06](../../overview/open-themes.md#op-dh-06).*
- [ ] <a id="op-ar-08"></a>**OP-AR-08** · Decide how the identity of an Entity on a state mart is mapped ([DEC-RC-06](05-resource-card.md#dec-rc-06)): `identifierValue` holds whichever identifier `identifierName` names. Either Data Hub shows that field as `is` the Entity by any of its identifiers, or the mart gets one column per identifier, each mapping as `is` that identifier. *Raised on 2026-10-28, while reading the generated project for [OP-DH-06](../../overview/open-themes.md#op-dh-06).*
- [ ] <a id="op-ar-05"></a>**OP-AR-05** · Decide who besides the Data Team may read the registry: its search, Nodes and lineage. Until then only the Data Team may ([TR-AR-05](../technical/01-artifact-registry.md#tr-ar-05)); the domain [Permissions and Excel keys](12-permissions-and-library-cards.md) decides ([OP-DH-24](../../overview/open-themes.md#op-dh-24)).

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Functional domains](README.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
