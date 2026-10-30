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

  *Note of 2026-10-30: the Source Jobs are the merge builds now ([DEC-AR-09](#dec-ar-09)).*

- <a id="dec-ar-02"></a>**DEC-AR-02** · dbt Cloud announces a finished run with a webhook (`job.run.completed`), signed with a secret that only dbt Cloud and Data Hub know. Data Hub does not poll. A delivery that is lost even after dbt Cloud's retries is recovered by fetching the run again by hand ([FR-AR-14](#fr-ar-14)).
- <a id="dec-ar-03"></a>**DEC-AR-03** · A source in one dbt project is linked to the Node in the other project that builds the same table: the same database, schema and table name. The link is made when the lineage is read, between the Current Versions of both projects, so it always follows both.
- <a id="dec-ar-04"></a>**DEC-AR-04** · Data Hub reads the Domain Model in use from the public API of the collector of Colleciónes: `GET /domain-model` at `https://colleciones-eventos.immoscoop.be`. It answers with the contract that actually validates the events: its name and version, such as `immoscoop` 0.1.0, its release with tag and commit, such as 0.0.70, the package it comes from, `@compilacion/colleciones-domain-model@0.0.70`, and its domains, Entities, events, contexts and actors. Data Hub does not join the Cloud Run setup of Colleciónes, and connects to it through this API only. *Decided on 2026-10-28, by Max, with the dev tool that loads the Domain Model this way ([OP-DH-35](../../overview/open-themes.md#op-dh-35), [OP-AR-06](#op-ar-06)).*
- <a id="dec-ar-05"></a>**DEC-AR-05** · Data Hub reads the Domain Model in real time: whenever it needs it, it asks the collector at that moment, and keeps no copy that could fall behind. There is no polling for a new version. With each mapping it records the release the answer came with ([FR-AR-15](#fr-ar-15)). *Decided on 2026-10-28, by Max ([OP-AR-06](#op-ar-06)).*
- <a id="dec-ar-06"></a>**DEC-AR-06** · Everyone who may see a Resource may read the lineage around it, through its tab Lineage: the names, layers and projects of the models it is built on and those built on it ([FR-SR-54](04-stacks-and-resources.md#fr-sr-54)). The rest of the registry, searching all dbt models and reading their columns and tests, stays with the Data Team ([TR-AR-05](../technical/01-artifact-registry.md#tr-ar-05)). *Decided on 2026-10-28, by Max ([OP-AR-05](#op-ar-05)).*
- <a id="dec-ar-07"></a>**DEC-AR-07** · The Colleciónes generator is extended, in the shared code of its strategies, so that the manifest says per column what the Domain Model says about it: `meta.domain` per column, with `is` or a relation type and the identity of its Entity; the references of an Entity in `meta.domain` of the model; and the release of the Domain Model on every model ([The Domain Model in the manifest](#the-domain-model-in-the-manifest)). Adding a Colleciónes model as a Resource then arrives filled in, for the Data Admin to confirm ([FR-AR-17](#fr-ar-17)). The grain and the model type stay in Data Hub ([DEC-RC-09](05-resource-card.md#dec-rc-09)). *Decided on 2026-10-28, by Max ([OP-AR-07](#op-ar-07)).* *Note of 2026-10-28: the generic columns `identifiers`, `references` and `collections` are lists and are left out of a Resource ([DEC-SR-33](04-stacks-and-resources.md#dec-sr-33)); what they hold reaches a Resource as fields the Data Team selects.*
- <a id="dec-ar-08"></a>**DEC-AR-08** · On a state mart, Data Hub maps `identifierValue` as `is` the Entity by whichever of its identifiers `identifierName` names; the step that adds a Resource shows it as "is businessGoal, by any of its identifiers". The generator does not change. To link it with another Resource on one identifier, such as `businessGoalId`, Data Hub filters on `identifierName = 'businessGoalId'`. *Decided on 2026-10-28, by Max ([OP-AR-08](#op-ar-08)).*
- <a id="dec-ar-09"></a>**DEC-AR-09** · The Source Jobs are the merge builds: per dbt project and environment, the job that the GitHub pipeline of its repository starts after a merge into `uat` or `main`. Tables and columns change only through a merge, so Data Hub shows a change minutes after its merge instead of after the next daily build. A column that changes without a merge is not followed; the checks of both projects allow no `select *`. A merge build also runs `dbt docs generate`, or its runs have no catalog ([EC-AR-02](#ec-ar-02)). A failed merge build changes nothing in Data Hub until the next successful run of that job, such as a rerun in dbt Cloud ([FR-AR-03](#fr-ar-03)). Each environment of Data Hub reads the merge builds of the same environment:

  | dbt project | Source Job for prod | Source Job for uat |
  | --- | --- | --- |
  | dbt-prod (9367) | 324502 · CI/CD - prod - triggered by Github Pipelines | 322951 · daily UAT build (uat), until its merge build exists ([OP-AR-09](#op-ar-09)) |
  | Colleciónes (17121) | 748278 · PROD - Deploy - Merge build | 748279 · UAT - Deploy - Merge build |

  *Decided on 2026-10-30, by Max, in place of the daily builds of [DEC-AR-01](#dec-ar-01).*

## Terms

| Term | Meaning |
| --- | --- |
| Source Job | The one job in dbt Cloud, per dbt project and environment, whose Artifacts Data Hub uses: the merge build, which builds the project after a merge and also runs `dbt docs generate`. uat of Data Hub reads the merge builds of uat ([DEC-AR-09](#dec-ar-09)) |
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

**The extension of the strategies,** decided ([DEC-AR-07](#dec-ar-07)). All of it in the shared code of the generator, so every strategy follows: `lib/domainMeta.js`, the field kinds of `lib/fields.js`, which already tell primary, natural and foreign keys apart, and `DbtDocument.js`, which writes the yaml.

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

**Status:** Implemented · **Confluence:** AR-08 · **Screens:** [resource-lineage](../../design/screens/resource-lineage.html)

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

**Status:** Specified · **Confluence:** AR-13 · **Screens:** [resource-detail](../../design/screens/resource-detail.html)

Anyone with access to a Resource can read its Log.

<a id="fr-ar-14"></a>
### FR-AR-14 · Fetch and process a run again manually

**Status:** Implemented · **Confluence:** AR-14

A run can be fetched and processed again manually, for recovery and tests.

<a id="fr-ar-15"></a>
### FR-AR-15 · Read the Domain Model in use

**Status:** Implemented · **Source:** Max, 2026-10-26 · **Screens:** [collection-add-relations](../../design/screens/collection-add-relations.html)

Data Hub reads the Domain Model as it runs on prod, from the overview the server of Colleciónes deploys: its Entities with their identities, its relation types with their cardinality and inverse, and the references of every Entity and action. It uses them for every Resource, also one not built on a Colleciónes model, to suggest and check the mappings of its fields ([FR-CO-33](03-collections.md#fr-co-33), [DEC-RC-05](05-resource-card.md#dec-rc-05)). It reads it again when a new version is deployed, and records with each mapping the version it was made with.


*Note of 2026-10-28: the overview is `GET /domain-model` of the collector ([DEC-AR-04](#dec-ar-04)).*

*Note of 2026-10-28: "reads it again when a new version is deployed" becomes: reads it every time it is needed ([DEC-AR-05](#dec-ar-05)).*

<a id="fr-ar-16"></a>
### FR-AR-16 · A Node built from the Domain Model knows its Entity

**Status:** Implemented · **Source:** [OP-DH-06](../../overview/open-themes.md#op-dh-06), the manifest of `immoscoop_generated` read on 2026-10-28 · **Screens:** [collection-add-relations](../../design/screens/collection-add-relations.html)

registry reads `meta.domain`, `meta.model` and the `colleciones` tags of every Node and keeps per Node its Entity, its action, its strategy and its layer. The Entities of a Node outside Colleciónes are those of the Colleciónes Nodes in its lineage ([FR-SR-23](04-stacks-and-resources.md#fr-sr-23), [FR-AR-08](#fr-ar-08)).

<a id="fr-ar-17"></a>
### FR-AR-17 · The meta of a column fills in its mapping

**Status:** Implemented · **Source:** [OP-DH-06](../../overview/open-themes.md#op-dh-06) · depends on [OP-AR-07](#op-ar-07) · **Screens:** [collection-add-relations](../../design/screens/collection-add-relations.html)

When the Data Admin adds a Resource ([FR-CO-33](03-collections.md#fr-co-33)), every field whose column carries `meta.domain` arrives filled in, with `is` or its relation type and the identity of its Entity, and the grain is suggested from what the model declares, for the Data Admin to confirm ([DEC-RC-09](05-resource-card.md#dec-rc-09)); the Data Admin confirms or changes them. On a Resource outside Colleciónes, a column named as an identifier of an Entity in its lineage is suggested as that identity. Each mapping records the release of the Domain Model it comes from ([FR-AR-15](#fr-ar-15)).

<a id="fr-ar-18"></a>
### FR-AR-18 · A Data Admin sets the Source Jobs on a page of Data Hub

**Status:** Specified · **Source:** Max, 2026-10-30, while testing on uat

A Data Admin sets on a page of Data Hub which dbt projects Data Hub follows and which dbt Cloud job is the Source Job of each ([FR-AR-02](#fr-ar-02)), for the environment of that page, in place of the configuration of its deployment. They choose a job from the jobs of the dbt Cloud account, each shown by its name, its ID, its dbt project and its environment in dbt Cloud, as Data Hub reads them from dbt Cloud; nobody types an ID. A change applies from the next run dbt Cloud reports, without a deploy of Data Hub. Per dbt project the page shows its Source Job by name and ID, who set it and when, and the last run that delivered an Artifact Set. The webhook of the environment in dbt Cloud names the same jobs ([DEC-AR-02](#dec-ar-02)); the page says so. The page is designed in the [design](../../design/README.md) before it is built.

*Could, not in v1: set on 2026-10-30, by Max; in version 1 the Source Jobs are set in the configuration of each environment, in Terraform ([DEC-AR-09](#dec-ar-09)).*

<a id="fr-ar-19"></a>
### FR-AR-19 · A Data Admin sees every delivery of the webhook

**Status:** Specified · **Source:** Max, 2026-10-30, while testing on uat

On the page of the Source Jobs ([FR-AR-18](#fr-ar-18)), a Data Admin sees every delivery dbt Cloud sent to the webhook of that environment in the last 30 days, the newest first: when it came, the job by its name and its ID, the dbt project, the run and its status in dbt Cloud, and what Data Hub did with it. That is one of:

- recorded as an Artifact Set, with the status of that set: pending, processed, or failed and why ([EC-AR-02](#ec-ar-02));
- ignored, and why: the job is no Source Job of this environment, its dbt project does not match, the run did not succeed, it comes from another dbt Cloud account, or it is a test from dbt Cloud;
- refused, because its signature does not match the secret.

So whoever sets up a webhook or a Source Job sees at once whether its runs arrive and are taken, without the logs of Google Cloud, and a job in the webhook that is no Source Job stands out.

*Could, not in v1: set on 2026-10-30, by Max, with the page of the Source Jobs ([FR-AR-18](#fr-ar-18)); in version 1 the deliveries are in the logs of registry.*

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

**Status:** Specified

It is stored and processed, but does not become the Current Version: the Current Version never goes back in time.

<a id="ec-ar-02"></a>
### EC-AR-02 · The catalog is missing

**Status:** Specified

Without `catalog.json`, the actual columns are not known. The set gets the status failed, with that reason, and the previous version stays current.

<a id="ec-ar-03"></a>
### EC-AR-03 · The table of a Resource is renamed

**Status:** Specified

In the Artifacts, this looks like one Node disappearing and another appearing. The Resource keeps its history only once someone confirms the rename; the [Resources](04-stacks-and-resources.md) domain defines how (see [EC-SR-03](04-stacks-and-resources.md#ec-sr-03)).

*Note of 2026-10-28: reworded without the Stacks, which no longer exist ([DEC-DH-71](../../overview/data-hub.md#dec-dh-71)).*

<a id="ec-ar-04"></a>
### EC-AR-04 · An upstream model disappears

**Status:** Specified

The Resources that depended on it get an entry in their Log, even if the table of the Resource itself is (still) unchanged.


*Note of 2026-10-28: reworded without the Stacks, which no longer exist ([DEC-DH-71](../../overview/data-hub.md#dec-dh-71)).*

<a id="ec-ar-05"></a>
### EC-AR-05 · The collector does not answer

**Status:** Specified

When Data Hub needs the Domain Model and the collector does not answer ([DEC-AR-05](#dec-ar-05)), the step that needs it says so, such as suggesting the mappings when adding a Resource, and offers to try again. Data Hub guesses nothing and falls back on no copy; what does not need the Domain Model goes on as usual.
## Out of scope

Which views are Resources and how their ID stays stable ([Resources](04-stacks-and-resources.md)), lowering the Level ([Maturity and release](06-maturity-and-release.md)), notifications and their channel ([Log and notifications](07-log-and-notifications.md)), and automatic checks ([Checks and monitoring](08-checks-and-monitoring.md)).

## Open points

- [x] <a id="op-ar-01"></a>**OP-AR-01** · At build time, record which dbt Cloud projects dbt-prod and Colleciónes are, and which job is the Source Job of each project. *Recorded on 2026-10-18 in [DEC-AR-01](#dec-ar-01). The prod Source Job of Colleciónes does not generate the docs yet; until "Generate docs on run" is on, its sets fail without a catalog ([EC-AR-02](#ec-ar-02)).*
- [x] <a id="op-ar-02"></a>**OP-AR-02** · Find out whether dbt Cloud can send a webhook after a successful run, or whether Data Hub polls after the scheduled time. *Decided on 2026-10-18: a webhook ([DEC-AR-02](#dec-ar-02)).*
- [x] <a id="op-ar-03"></a>**OP-AR-03** · Confirm or adjust the edge cases above. *Decided on 2026-10-28, by Max: confirmed; EC-AR-01 to EC-AR-05 are Specified.*
- [x] <a id="op-ar-04"></a>**OP-AR-04** · Decide how Nodes from dbt-prod and Colleciónes are linked to each other. *Decided on 2026-10-18, while building: by the table they build or read ([DEC-AR-03](#dec-ar-03)).*
- [x] <a id="op-ar-06"></a>**OP-AR-06** · Find out where the overview of the Domain Model is served ([FR-AR-15](#fr-ar-15)), in which form Data Hub can read it, and how Data Hub learns of a new version: the release of the package `@compilacion/colleciones-domain-model` that the server pins per environment, or by checking. *Raised on 2026-10-26.* *Note of 2026-10-28: where and in which form are decided ([DEC-AR-04](#dec-ar-04)). What remains is how Data Hub learns of a new version. Proposal: it asks again every hour and after every new Current Version, compares the release, and reads the Domain Model again when the release changed; no push from Colleciónes is needed.* *Decided on 2026-10-28, by Max: in real time, read whenever it is needed ([DEC-AR-05](#dec-ar-05)).*
- [x] <a id="op-ar-07"></a>**OP-AR-07** · Decide the extension of the Colleciónes strategies so that the manifest says per column what the Domain Model says about it: `meta.domain` per column, the references of an Entity and the release of the Domain Model ([The Domain Model in the manifest](#the-domain-model-in-the-manifest)). Its alternative: Data Hub matches columns by name and the Data Admin fills in the rest by hand. *Raised on 2026-10-28, while reading the generated project for [OP-DH-06](../../overview/open-themes.md#op-dh-06).* *Decided on 2026-10-28, by Max: extend Colleciónes ([DEC-AR-07](#dec-ar-07)).*
- [x] <a id="op-ar-08"></a>**OP-AR-08** · Decide how the identity of an Entity on a state mart is mapped ([DEC-RC-06](05-resource-card.md#dec-rc-06)): `identifierValue` holds whichever identifier `identifierName` names. Either Data Hub shows that field as `is` the Entity by any of its identifiers, or the mart gets one column per identifier, each mapping as `is` that identifier. *Raised on 2026-10-28, while reading the generated project for [OP-DH-06](../../overview/open-themes.md#op-dh-06).* *Decided on 2026-10-28, by Max: as is, by any of its identifiers ([DEC-AR-08](#dec-ar-08)).*
- [x] <a id="op-ar-05"></a>**OP-AR-05** · Decide who besides the Data Team may read the registry: its search, Nodes and lineage. Until then only the Data Team may ([TR-AR-05](../technical/01-artifact-registry.md#tr-ar-05)); the domain [Permissions and Excel keys](12-permissions-and-library-cards.md) decides ([OP-DH-24](../../overview/open-themes.md#op-dh-24)). *Decided on 2026-10-28, by Max: the lineage around a Resource for everyone who sees it, the rest for the Data Team ([DEC-AR-06](#dec-ar-06)).*
- [ ] <a id="op-ar-09"></a>**OP-AR-09** · Make the merge build of dbt-prod the Source Job of uat once it exists. Job 324451 runs both the PR checks of dbt-prod, in their own `DBT_CLOUD_PR_*` schemas, and the deploy of `uat`, so it cannot be a Source Job; the deploy of `uat` gets its own job, "UAT - Deploy - Merge build" ([immoscoop-dataplatform-data#980](https://github.com/immoscoop-be/immoscoop-dataplatform-data/pull/980)). Its ID then goes in `uat.tfvars` and in the webhook of uat; until then, uat reads the daily UAT build 322951 ([DEC-AR-09](#dec-ar-09)). *Raised on 2026-10-30, by Max.*

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Functional domains](README.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
