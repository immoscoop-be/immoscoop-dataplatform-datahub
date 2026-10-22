# Log and notifications

| | |
| --- | --- |
| Domain | 7 of Data Hub · code `LN` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Log en meldingen) |

**Scope:** the Log Catalogue across all domains, the Message Centre, who gets which notification when, and through which channel.

*Functional domain 7 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- The [Log catalogue](log-catalogue.md), and the structure of a Log Entry: [FR-SR-11](04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](04-stacks-and-resources.md#fr-sr-12)
- Propagating Changes into the Log: [FR-AR-12](01-artifact-registry.md#fr-ar-12), [FR-AR-13](01-artifact-registry.md#fr-ar-13)
- The Message Centre of the Data Admins: [FR-SR-10](04-stacks-and-resources.md#fr-sr-10), [OP-SR-04](04-stacks-and-resources.md#op-sr-04)
- Completing the Log Catalogue: [OP-SR-02](04-stacks-and-resources.md#op-sr-02)
- Channel and rhythm of notifications: [OP-DH-20](../../overview/open-themes.md#op-dh-20)

## Decisions

- <a id="dec-ln-01"></a>**DEC-LN-01** · Data Hub keeps its own Query Log of every query it executes, with the Query ID, the SQL, who ran it, when, the bytes processed, the Resources beneath it and the ID of the job in BigQuery. It does not rely on the job log of BigQuery, which keeps 180 days, so that a Report or a screenshot can be traced back for as long as it exists. Because SQL can hold values, the Query Log is readable only by the Data Team and by whoever ran the query. This replaces [DEC-SR-18](04-stacks-and-resources.md#dec-sr-18). *Decided on 2026-10-22, after the workshop ([OP-LN-01](#op-ln-01)).*

## Requirements

*The requirements below come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md). They are proposals, still to be validated, and therefore Proposed; those on the Query Log are Specified by [DEC-LN-01](#dec-ln-01).*

<a id="fr-ln-01"></a>
### FR-LN-01 · A notification to an Owner reaches its whole Owner Unit

**Status:** Proposed · **Source:** [REQ-DH-OWNERS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-owners)

A notification to the Owner of a Collection or a Resource reaches every member of its Owner Unit, so that a Collection always potentially has several owners.

<a id="fr-ln-02"></a>
### FR-LN-02 · The Owner can notify the Consumers of a structural Change

**Status:** Proposed · **Source:** [REQ-DH-NOTIFY-SCHEMA](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-notify-schema)

When a structural Change makes a Resource drop to Described and its Owner gets a notification ([FR-MR-05](06-maturity-and-release.md#fr-mr-05)), the Owner can notify the Consumers of the Resource from Data Hub.

<a id="fr-ln-03"></a>
### FR-LN-03 · Data Hub knows the Consumers of a Resource

**Status:** Proposed · **Source:** [REQ-DH-NOTIFY-SCHEMA](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-notify-schema)

Data Hub knows the Consumers of a Resource, the Users of the Lenses and Reports built on it, through the lineage of those Lenses and Reports.

<a id="fr-ln-04"></a>
### FR-LN-04 · The Owner hears when a Lens on their Resource becomes public

**Status:** Proposed · **Source:** [REQ-DH-NOTIFY-LENS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-notify-lens)

When a Lens that builds on a Resource is made public, the Owner of that Resource gets a notification. Before the Lens is public, there is no notification.

<a id="fr-ln-05"></a>
### FR-LN-05 · Every query gets a Query ID in the Query Log

**Status:** Specified · **Source:** [REQ-DH-SQLLOG](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-sqllog)

Every query that Data Hub executes, ad hoc, for a Lens, a Report or an export, or through the MCP, is kept in the Query Log with a unique Query ID, the SQL, who ran it, when, the bytes processed and the Resources beneath it.

<a id="fr-ln-06"></a>
### FR-LN-06 · Every output carries its Query ID

**Status:** Specified · **Source:** [REQ-DH-SQLLOG](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-sqllog)

Every output, a chart, a Report, a PDF or an export, visibly carries the Query ID of its query, so that a screenshot can always be traced back to the SQL. The Chart Server already does this; Data Hub extends it to all assets.

## Open points

- [x] <a id="op-ln-01"></a>**OP-LN-01** · The Query Log ([FR-LN-05](#fr-ln-05)) differs from [DEC-SR-18](04-stacks-and-resources.md#dec-sr-18) and [FR-SR-27](04-stacks-and-resources.md#fr-sr-27): executed queries are not stored in Data Hub in v1. Decide whether the Query Log replaces that, and how long it is kept; see also [OP-SR-08](04-stacks-and-resources.md#op-sr-08) (query history later) and [OP-DH-04](../../overview/open-themes.md#op-dh-04) (usage per Resource). *Raised while taking in the workshop of 2026-10-22.* *Decided on 2026-10-22: Data Hub keeps its own Query Log ([DEC-LN-01](#dec-ln-01)).*
- [ ] <a id="op-ln-02"></a>**OP-LN-02** · Work out what making a Lens public means, on which [FR-LN-04](#fr-ln-04) depends: Lenses have no visibility of their own yet ([OP-CO-07](03-collections.md#op-co-07)). *Raised while taking in the workshop of 2026-10-22.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
