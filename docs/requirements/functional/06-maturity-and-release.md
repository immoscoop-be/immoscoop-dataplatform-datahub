# Maturity and release

| | |
| --- | --- |
| Domain | 6 of Data Hub · code `MR` (Confluence: `MO`, Maturiteit en ontsluiting) |
| Status | Specified; open points remain |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Maturiteit en ontsluiting](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1373274123) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17. The Confluence page has no properties table, and the domain overview still listed it as "to be described". |

**In one sentence:** the level of a resource rises through demonstrable steps and drops only for concrete causes; it is information for everyone, while the publication determines who has access.

*Functional domain 6 of Data Hub. Overview: [Functional domains](README.md). The ladder itself: [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch); the level names are in the [glossary](../../glossary.md#maturity-levels).*

## Decisions

- <a id="dec-mr-01"></a>**DEC-MR-01** · Fully described means measurable: the view has a description and every column has one. The owner judges length and quality when confirming.
- <a id="dec-mr-02"></a>**DEC-MR-02** · Explored: an EDA document is linked to the resource.
- <a id="dec-mr-03"></a>**DEC-MR-03** · Monitored: at least one active check runs on the resource.
- <a id="dec-mr-04"></a>**DEC-MR-04** · A failing check does not lower the level: that is the monitoring doing its job. It becomes an incident in the log.
- <a id="dec-mr-05"></a>**DEC-MR-05** · A confirmation does not expire. There is no expiry date and no reminder.
- <a id="dec-mr-06"></a>**DEC-MR-06** · The level is information only and restricts nothing. The publication determines access. The level is visible in search results, on the resource card and on every lens and report, and Claude mentions it when it uses a resource.

The overarching decisions on how the level is determined and on the two-step release are in the overview: [DEC-DH-31](../../overview/data-hub.md#dec-dh-31) to [DEC-DH-37](../../overview/data-hub.md#dec-dh-37) and [DEC-DH-38](../../overview/data-hub.md#dec-dh-38) to [DEC-DH-40](../../overview/data-hub.md#dec-dh-40).

## Rising and dropping

| Level | Reached when | Drops when |
| --- | --- | --- |
| 1 Available | Registered, description incomplete | – |
| 2 Described | The view and every column have a description | A description is missing: to Available |
| 3 Confirmed | The owner confirms (the first publication is the first confirmation) | Structural change: to Described |
| 4 Explored | An EDA document is linked | The EDA document disappears: to Confirmed |
| 5 Monitored | At least one active check | The last active check is switched off: to Explored |

## Requirements

<a id="fr-mr-01"></a>
### FR-MR-01 · Described: the view and every column have a description

**Status:** Specified · **Confluence:** MO-01

Described requires a description of the view and of every column.

<a id="fr-mr-02"></a>
### FR-MR-02 · Confirmed: the owner confirms, from Described

**Status:** Specified · **Confluence:** MO-02

Confirmed requires a confirmation by the owner, from Described.

<a id="fr-mr-03"></a>
### FR-MR-03 · Explored: a linked EDA document

**Status:** Specified · **Confluence:** MO-03

Explored requires a linked EDA document, on top of Confirmed.

<a id="fr-mr-04"></a>
### FR-MR-04 · Monitored: at least one active check

**Status:** Specified · **Confluence:** MO-04

Monitored requires at least one active check, on top of Explored.

<a id="fr-mr-05"></a>
### FR-MR-05 · A structural change resets the level to Described

**Status:** Specified · **Confluence:** MO-05

A structural change (hash of the structure) puts the resource back to Described, whatever its level. Type and logic changes only notify the owner.

<a id="fr-mr-06"></a>
### FR-MR-06 · A failing check does not lower the level

**Status:** Specified · **Confluence:** MO-06

A failing check does not lower the level and is logged as an incident.

<a id="fr-mr-07"></a>
### FR-MR-07 · Drop when the last check or the EDA document goes

**Status:** Specified · **Confluence:** MO-07

If the last active check is switched off, the resource drops to Explored. If the EDA document disappears, it drops to Confirmed.

<a id="fr-mr-08"></a>
### FR-MR-08 · A confirmation does not expire

**Status:** Specified · **Confluence:** MO-08

A confirmation stays valid as long as there is no drop. There is no expiry date or reminder.

<a id="fr-mr-09"></a>
### FR-MR-09 · Log every rise and drop, and alert the owner on a drop

**Status:** Specified · **Confluence:** MO-09

Every rise and drop goes into the log, and every drop gives the owner an alert.

<a id="fr-mr-10"></a>
### FR-MR-10 · The level restricts nothing and is shown everywhere

**Status:** Specified · **Confluence:** MO-10

The level restricts no access or channel. It is shown everywhere, also by Claude.

## Open points

- [ ] <a id="op-mr-01"></a>**OP-MR-01** · Work out a new domain, [EDA](15-eda.md): how an exploration runs and is linked to a resource (builds on the [EDA framework](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168), Confluence, Dutch).
- [ ] <a id="op-mr-02"></a>**OP-MR-02** · Work out the domain [Checks and monitoring](08-checks-and-monitoring.md): kinds of checks, incidents and alerts.

Raised during the migration to this repository; not on the Confluence page:

- [ ] <a id="op-mr-03"></a>**OP-MR-03** · Align the definition of Described. [DEC-DH-34](../../overview/data-hub.md#dec-dh-34) requires, at a minimum, a description on the table and on every column plus `model_type` and `grain` in `meta`. [DEC-MR-01](#dec-mr-01) and [FR-MR-01](#fr-mr-01) only require the descriptions.
- [ ] <a id="op-mr-04"></a>**OP-MR-04** · Complete the drop causes in [Rising and dropping](#rising-and-dropping). Two drops defined elsewhere are not in the table: removal from a collection drops a resource to Described ([FR-CO-08](03-collections.md#fr-co-08)), and an owner unit that empties should make its resources drop, with this domain to define how ([EC-UM-01](02-user-management.md#ec-um-01), [EC-CO-01](03-collections.md#ec-co-01)).

Raised during the review of the migration; not on the Confluence page:

- [ ] <a id="op-mr-05"></a>**OP-MR-05** · Clarify which part of the fingerprint makes a resource drop to Described. [DEC-DH-35](../../overview/data-hub.md#dec-dh-35) says any deviation of the schema from the fingerprint taken at confirmation drops it, and [FR-SR-08](04-stacks-and-resources.md#fr-sr-08) includes a hash of the types in the fingerprint. [DEC-DH-26](../../overview/data-hub.md#dec-dh-26) and [FR-MR-05](#fr-mr-05) say a type change does not lower the level; only the structure hash does.

## Builds on

- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [Stacks and resources](04-stacks-and-resources.md)
- [Artifact registry](01-artifact-registry.md)
