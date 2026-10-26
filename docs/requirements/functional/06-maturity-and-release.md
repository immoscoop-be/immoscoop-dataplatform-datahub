# Maturity and release

| | |
| --- | --- |
| Domain | 6 of Data Hub · code `MR` (Confluence: `MO`, Maturiteit en ontsluiting) |
| Status | Specified; open points remain |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Maturiteit en ontsluiting](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1373274123) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17. The Confluence page has no properties table, and the domain overview still listed it as "to be described". |

**In one sentence:** the Level of a Resource rises through demonstrable steps and drops only for concrete causes; it is information for everyone, while the Publication determines who has access.

*Functional domain 6 of Data Hub. Overview: [Functional domains](README.md). The ladder itself: [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch); the Level names are in the [definitions](../../definitions.md#maturity-levels).*

## Decisions

- <a id="dec-mr-01"></a>**DEC-MR-01** · Fully described means measurable: the view has a description and every column has one. The Owner judges length and quality when confirming.
- <a id="dec-mr-02"></a>**DEC-MR-02** · Explored: an EDA document is linked to the Resource.
- <a id="dec-mr-03"></a>**DEC-MR-03** · Monitored: at least one active check runs on the Resource.
- <a id="dec-mr-04"></a>**DEC-MR-04** · A failing check does not lower the Level: that is the monitoring doing its job. It becomes an incident in the Log.
- <a id="dec-mr-05"></a>**DEC-MR-05** · A Confirmation does not expire. There is no expiry date and no reminder.
- <a id="dec-mr-06"></a>**DEC-MR-06** · The Level is information only and restricts nothing. The Publication determines access. The Level is visible in search results, on the Resource Card and on every Lens and Report, and Claude mentions it when it uses a Resource.
- <a id="dec-mr-07"></a>**DEC-MR-07** · A Confirmation is business confirming what a Resource is and what it stands for, as its descriptions say. It has no link to the data inside it: no control figures, no checks on values. Exploring the data belongs to the EDA, Level 4, Explored, where far more is learned about a Resource than a Confirmation can carry. *Decided on 2026-10-26, by Max.*

The overarching decisions on how the Level is determined and on the two-step Release are in the overview: [DEC-DH-31](../../overview/data-hub.md#dec-dh-31) to [DEC-DH-37](../../overview/data-hub.md#dec-dh-37) and [DEC-DH-38](../../overview/data-hub.md#dec-dh-38) to [DEC-DH-40](../../overview/data-hub.md#dec-dh-40).

## Rising and dropping

| Level | Reached when | Drops when |
| --- | --- | --- |
| 1 Available | Registered, description incomplete | – |
| 2 Described | The view and every column have a description | A description is missing: to Available |
| 3 Confirmed | The Owner confirms (the first Publication is the first Confirmation) | Structural Change: to Described |
| 4 Explored | An EDA document is linked | The EDA document disappears: to Confirmed |
| 5 Monitored | At least one active check | The last active check is switched off: to Explored |

## Requirements

<a id="fr-mr-01"></a>
### FR-MR-01 · Described: the view and every column have a description

**Status:** Specified · **Confluence:** MO-01

Described requires a description of the view and of every column.

<a id="fr-mr-02"></a>
### FR-MR-02 · Confirmed: the Owner confirms, from Described

**Status:** Specified · **Confluence:** MO-02

Confirmed requires a Confirmation by the Owner, from Described.

<a id="fr-mr-03"></a>
### FR-MR-03 · Explored: a linked EDA document

**Status:** Specified · **Confluence:** MO-03

Explored requires a linked EDA document, on top of Confirmed.

<a id="fr-mr-04"></a>
### FR-MR-04 · Monitored: at least one active check

**Status:** Specified · **Confluence:** MO-04

Monitored requires at least one active check, on top of Explored.

<a id="fr-mr-05"></a>
### FR-MR-05 · A structural Change resets the Level to Described

**Status:** Specified · **Confluence:** MO-05

A structural Change (hash of the structure) puts the Resource back to Described, whatever its Level. Type and logic Changes only notify the Owner.

<a id="fr-mr-06"></a>
### FR-MR-06 · A failing check does not lower the Level

**Status:** Specified · **Confluence:** MO-06

A failing check does not lower the Level and is logged as an incident.

<a id="fr-mr-07"></a>
### FR-MR-07 · Drop when the last check or the EDA document goes

**Status:** Specified · **Confluence:** MO-07

If the last active check is switched off, the Resource drops to Explored. If the EDA document disappears, it drops to Confirmed.

<a id="fr-mr-08"></a>
### FR-MR-08 · A Confirmation does not expire

**Status:** Specified · **Confluence:** MO-08

A Confirmation stays valid as long as there is no drop. There is no expiry date or reminder.

<a id="fr-mr-09"></a>
### FR-MR-09 · Log every rise and drop, and alert the Owner on a drop

**Status:** Specified · **Confluence:** MO-09

Every rise and drop goes into the Log, and every drop gives the Owner an alert.

<a id="fr-mr-10"></a>
### FR-MR-10 · The Level restricts nothing and is shown everywhere

**Status:** Specified · **Confluence:** MO-10

The Level restricts no access or channel. It is shown everywhere, also by Claude.


<a id="fr-mr-11"></a>
### FR-MR-11 · Confirming again shows what changed

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#publishing-and-confirming)

When the Owner confirms a Resource again after a drop ([FR-SR-20](04-stacks-and-resources.md#fr-sr-20)), Data Hub shows why it dropped and what changed, who confirmed it last and when ([FR-RC-12](05-resource-card.md#fr-rc-12)), and what the Owner confirms: what the Resource is and what it stands for ([DEC-MR-07](#dec-mr-07)). The new Confirmation is kept with the Fingerprint of that moment, next to the earlier ones. It changes nothing about the Publication.

*Note of 2026-10-26: the control figures are left out; a Confirmation makes no claim about the data ([DEC-MR-07](#dec-mr-07)).*

## Open points

- [ ] <a id="op-mr-01"></a>**OP-MR-01** · Work out a new domain, [EDA](15-eda.md): how an exploration runs and is linked to a Resource (builds on the [EDA framework](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168), Confluence, Dutch).
- [ ] <a id="op-mr-02"></a>**OP-MR-02** · Work out the domain [Checks and monitoring](08-checks-and-monitoring.md): kinds of checks, incidents and alerts.

Raised during the migration to this repository; not on the Confluence page:

- [ ] <a id="op-mr-03"></a>**OP-MR-03** · Align the definition of Described. [DEC-DH-34](../../overview/data-hub.md#dec-dh-34) requires, at a minimum, a description on the table and on every column plus `model_type` and `grain` in `meta`. [DEC-MR-01](#dec-mr-01) and [FR-MR-01](#fr-mr-01) only require the descriptions.
- [ ] <a id="op-mr-04"></a>**OP-MR-04** · Complete the drop causes in [Rising and dropping](#rising-and-dropping). Two drops defined elsewhere are not in the table: removal from a Collection drops a Resource to Described ([FR-CO-08](03-collections.md#fr-co-08)), and an Owner Unit that empties should make its Resources drop, with this domain to define how ([EC-UM-01](02-user-management.md#ec-um-01), [EC-CO-01](03-collections.md#ec-co-01)).

Raised during the review of the migration; not on the Confluence page:

- [ ] <a id="op-mr-05"></a>**OP-MR-05** · Clarify which part of the Fingerprint makes a Resource drop to Described. [DEC-DH-35](../../overview/data-hub.md#dec-dh-35) says any deviation of the schema from the Fingerprint taken at Confirmation drops it, and [FR-SR-08](04-stacks-and-resources.md#fr-sr-08) includes a hash of the types in the Fingerprint. [DEC-DH-26](../../overview/data-hub.md#dec-dh-26) and [FR-MR-05](#fr-mr-05) say a type Change does not lower the Level; only the structure hash does.

## Builds on

- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [Stacks and resources](04-stacks-and-resources.md)
- [Artifact registry](01-artifact-registry.md)
