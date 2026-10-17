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

> **Note:** not to be confused with GCP's Artifact Registry, which holds the Docker images of Data Hub. This domain is about the artifacts of dbt: `manifest.json` and `catalog.json`.

## Decisions

The decisions for this domain are in the [Data Hub overview](../../overview/data-hub.md):

- Fetching: [DEC-DH-19](../../overview/data-hub.md#dec-dh-19) to [DEC-DH-22](../../overview/data-hub.md#dec-dh-22)
- Processing: [DEC-DH-23](../../overview/data-hub.md#dec-dh-23) to [DEC-DH-25](../../overview/data-hub.md#dec-dh-25)
- Changes: [DEC-DH-26](../../overview/data-hub.md#dec-dh-26) to [DEC-DH-30](../../overview/data-hub.md#dec-dh-30)

## Terms

| Term | Meaning |
| --- | --- |
| Source job | The one prod job in dbt Cloud, per dbt project, whose artifacts Data Hub uses: a full build that also runs `dbt docs generate` |
| Artifact set | The artifacts of one successful run of a source job: `manifest.json` and `catalog.json`, with run ID, git SHA and timestamp |
| Current version | Per dbt project, the most recent fully processed artifact set; the rest of Data Hub works on it |
| Node | A model, seed, snapshot, source or exposure from the manifest, with its columns |
| Edge | A link in the lineage: this node depends on that node |
| Change | A difference for one node between the new set and the previous current version |
| Log of a resource | Everything that touches a resource, including changes deeper in the lineage |

## Flow

1. **Signal.** dbt Cloud reports a finished run, or Data Hub detects by itself that there is a new successful run.
2. **Fetch.** Data Hub fetches `manifest.json` and `catalog.json` from dbt Cloud.
3. **Store.** The files are stored unchanged, per project and per run.
4. **Process.** The set is read and normalised into nodes, columns, edges and tests.
5. **Switch.** Only when everything has succeeded does the set become the current version of the project.
6. **Compare.** The new version is compared with the previous one, and every change is recorded.
7. **Propagate.** Every change is followed through the lineage to the resources that depend on it, and lands in their log.

## Requirements

<a id="fr-ar-01"></a>
### FR-AR-01 · Fetch the artifacts from dbt Cloud

**Status:** Specified · **Confluence:** AR-01

Data Hub fetches the artifacts from dbt Cloud itself. The repositories deliver nothing.

<a id="fr-ar-02"></a>
### FR-AR-02 · Two dbt projects, one source job each

**Status:** Specified · **Confluence:** AR-02

There are two dbt projects: dbt-prod and Colleciónes. Per project, exactly one prod job is the source job.

<a id="fr-ar-03"></a>
### FR-AR-03 · Only successful runs of a source job

**Status:** Specified · **Confluence:** AR-03

Only successful runs of a source job are fetched. Runs of other jobs are ignored.

<a id="fr-ar-04"></a>
### FR-AR-04 · Manifest and catalog only

**Status:** Specified · **Confluence:** AR-04

Per run, `manifest.json` and `catalog.json` are fetched. Other artifacts are outside the first version.

<a id="fr-ar-05"></a>
### FR-AR-05 · Ingest a run at most once

**Status:** Specified · **Confluence:** AR-05

A run is ingested at most once. A duplicate signal for the same run creates no duplicates.

<a id="fr-ar-06"></a>
### FR-AR-06 · Store the files unchanged and keep old versions

**Status:** Specified · **Confluence:** AR-06

The fetched files are stored unchanged, per project and per run. Old versions are kept.

<a id="fr-ar-07"></a>
### FR-AR-07 · Normalise a set into nodes, columns, edges and tests

**Status:** Specified · **Confluence:** AR-07

Processing normalises a set into nodes, columns, edges and tests. Columns combine the description from the manifest with the actual name and type from the catalog. Relationships tests are split out into column, target table and target column.

<a id="fr-ar-08"></a>
### FR-AR-08 · Lineage across the dbt projects

**Status:** Specified · **Confluence:** AR-08

Lineage crosses the boundary between the dbt projects: nodes from dbt-prod and Colleciónes are linked to each other.

<a id="fr-ar-09"></a>
### FR-AR-09 · Switch to a set only after complete processing

**Status:** Specified · **Confluence:** AR-09

A set only becomes the current version of its project once it is fully processed. If processing fails, the previous version stays current, and the error is stored with the set.

<a id="fr-ar-10"></a>
### FR-AR-10 · Search by name, free text and lineage

**Status:** Specified · **Confluence:** AR-10

Search works by name (also with a typo or a half-remembered name), by free text in descriptions and columns, and along the lineage in both directions.

<a id="fr-ar-11"></a>
### FR-AR-11 · Compare every new version node by node

**Status:** Specified · **Confluence:** AR-11

Every new current version is compared with the previous one, node by node. This yields changes of five kinds: description, logic, type, structural, and node added or removed (see [Kinds of change](#kinds-of-change) below).

<a id="fr-ar-12"></a>
### FR-AR-12 · Propagate every change downstream

**Status:** Specified · **Confluence:** AR-12

Every change is followed downstream to all resources that depend on it, however deep. Every affected resource gets an entry in its log, with the original change and the distance in the lineage. Nothing is filtered out.

<a id="fr-ar-13"></a>
### FR-AR-13 · Anyone with access can read the log

**Status:** Specified · **Confluence:** AR-13

Anyone with access to a resource can read its log.

<a id="fr-ar-14"></a>
### FR-AR-14 · Fetch and process a run again manually

**Status:** Specified · **Confluence:** AR-14

A run can be fetched and processed again manually, for recovery and tests.

## Kinds of change

This domain detects the change and passes it on. What happens next (lowering the level, notifying the owner, running checks) belongs to the domains [Maturity and release](06-maturity-and-release.md), [Log and notifications](07-log-and-notifications.md), and [Checks and monitoring](08-checks-and-monitoring.md).

| Kind | When | Consequence, in another domain |
| --- | --- | --- |
| Description | A text on a table or field changes | In the log |
| Logic | The code of a node changes (a filter, a join); the schema stays the same | In the log, notification to the owner |
| Type | A field keeps its name but gets a different data type | In the log, notification to the owner |
| Structural | A field is added or removed, including a rename | In the log; the resource drops to Described |
| Node added or removed | A model appears or disappears | In the log of the resources that depended on it |

## Edge cases

Proposals to confirm.

<a id="ec-ar-01"></a>
### EC-AR-01 · An older run arrives after a newer one

**Status:** Proposed

It is stored and processed, but does not become the current version: the current version never goes back in time.

<a id="ec-ar-02"></a>
### EC-AR-02 · The catalog is missing

**Status:** Proposed

Without `catalog.json`, the actual columns are not known. The set gets the status failed, with that reason, and the previous version stays current.

<a id="ec-ar-03"></a>
### EC-AR-03 · A view in the stacks is renamed

**Status:** Proposed

In the artifacts, this looks like one node disappearing and another appearing. The resource keeps its history only once someone confirms the rename; the [Stacks and resources](04-stacks-and-resources.md) domain defines how (see [EC-SR-03](04-stacks-and-resources.md#ec-sr-03)).

<a id="ec-ar-04"></a>
### EC-AR-04 · An upstream model disappears

**Status:** Proposed

The resources that depended on it get an entry in their log, even if the stacks view itself is (still) unchanged.

## Out of scope

Which views are resources and how their ID stays stable ([Stacks and resources](04-stacks-and-resources.md)), lowering the level ([Maturity and release](06-maturity-and-release.md)), notifications and their channel ([Log and notifications](07-log-and-notifications.md)), and automatic checks ([Checks and monitoring](08-checks-and-monitoring.md)).

## Open points

- [ ] <a id="op-ar-01"></a>**OP-AR-01** · At build time, record which dbt Cloud projects dbt-prod and Colleciónes are, and which job is the source job of each project.
- [ ] <a id="op-ar-02"></a>**OP-AR-02** · Find out whether dbt Cloud can send a webhook after a successful run, or whether Data Hub polls after the scheduled time.
- [ ] <a id="op-ar-03"></a>**OP-AR-03** · Confirm or adjust the edge cases above.
- [ ] <a id="op-ar-04"></a>**OP-AR-04** · Decide how nodes from dbt-prod and Colleciónes are linked to each other.

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Functional domains](README.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
