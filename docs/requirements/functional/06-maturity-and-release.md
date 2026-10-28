# Maturity and release

| | |
| --- | --- |
| Domain | 6 of Data Hub · code `MR` (Confluence: `MO`, Maturiteit en ontsluiting) |
| Status | Specified; open points remain |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Maturiteit en ontsluiting](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1373274123) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17. The Confluence page has no properties table, and the domain overview still listed it as "to be described". |

**In one sentence:** the Level of a Resource rises through demonstrable steps and drops only when a trace it rests on goes, never for a change to its schema; it is information for everyone, while the Publication determines who has access.

*Functional domain 6 of Data Hub. Overview: [Functional domains](README.md). The ladder itself: [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch); the Level names are in the [definitions](../../definitions.md#maturity-levels).*

## Decisions

- <a id="dec-mr-01"></a>**DEC-MR-01** · Fully described means measurable: the view has a description and every column has one. The Owner judges length and quality when confirming.
- <a id="dec-mr-02"></a>**DEC-MR-02** · Explored: an EDA document is linked to the Resource.
- <a id="dec-mr-03"></a>**DEC-MR-03** · Monitored: at least one active check runs on the Resource.
- <a id="dec-mr-04"></a>**DEC-MR-04** · A failing check does not lower the Level: that is the monitoring doing its job. It becomes an incident in the Log.
- <a id="dec-mr-05"></a>**DEC-MR-05** · A Confirmation does not expire. There is no expiry date and no reminder.
- <a id="dec-mr-06"></a>**DEC-MR-06** · The Level is information only and restricts nothing. The Publication determines access. The Level is visible in search results, on the Resource Card and on every Lens and Report, and Claude mentions it when it uses a Resource.
- <a id="dec-mr-07"></a>**DEC-MR-07** · A Confirmation is business confirming what a Resource is and what it stands for, as its descriptions say. It has no link to the data inside it: no control figures, no checks on values. Exploring the data belongs to the EDA, Level 4, Explored, where far more is learned about a Resource than a Confirmation can carry. *Decided on 2026-10-26, by Max.*
- <a id="dec-mr-08"></a>**DEC-MR-08** · A change to the schema of a Resource never lowers its Level, and asks for no new Confirmation. A field added, removed, renamed or retyped since the last Confirmation gives a warning on the Resource, to everyone who sees it, and the Owner a Message; the warning stays until the Owner or the Data Team marks it seen. The Level still follows its traces: a missing description, a removed EDA document or the last check switched off still lower it ([DEC-DH-31](../../overview/data-hub.md#dec-dh-31)). *Decided on 2026-10-26, by Max.*
- <a id="dec-mr-09"></a>**DEC-MR-09** · Described is done by the Data Team: a Resource is Described as soon as dbt has a description of the table and of every field. A Business Description does not count towards it. Where dbt has none, the Owner may jump over Described: once a Business Description covers every field, and the table, without a description in dbt, the Owner can publish and confirm. The Resource is then Confirmed, marked as confirmed without every description in dbt; the mark goes once dbt has them. *Decided on 2026-10-26, by Max ([OP-RC-20](05-resource-card.md#op-rc-20)).* *Note of 2026-10-28: the jump over Described is withdrawn: a Resource the Data Team has not described in dbt stays at Available ([DEC-MR-10](#dec-mr-10)).*
- <a id="dec-mr-10"></a>**DEC-MR-10** · Only the Data Team describes a Resource into Described, in dbt. A Resource without its descriptions from dbt stays at 1 · Available: its Owner cannot write Business Descriptions on it and cannot publish it. A yaml next to the model is not required for a table to be a Resource ([FR-SR-32](04-stacks-and-resources.md#fr-sr-32)), but without its descriptions it cannot leave Available. Business Descriptions are written from Described on. This replaces the jump over Described of [DEC-MR-09](#dec-mr-09). *Decided on 2026-10-28, by Max ([OP-DH-05](../../overview/open-themes.md#op-dh-05)).*

The overarching decisions on how the Level is determined and on the two-step Release are in the overview: [DEC-DH-31](../../overview/data-hub.md#dec-dh-31) to [DEC-DH-37](../../overview/data-hub.md#dec-dh-37) and [DEC-DH-38](../../overview/data-hub.md#dec-dh-38) to [DEC-DH-40](../../overview/data-hub.md#dec-dh-40).

## Rising and dropping

| Level | Reached when | Drops when |
| --- | --- | --- |
| 1 Available | Registered, description incomplete | – |
| 2 Described | The view and every column have a description | A description is missing: to Available |
| 3 Confirmed | The Owner confirms (the first Publication is the first Confirmation), from Described only ([DEC-MR-10](#dec-mr-10)) | – (a change to the schema gives a warning, [DEC-MR-08](#dec-mr-08)) |
| 4 Explored | An EDA document is linked | The EDA document disappears: to Confirmed |
| 5 Monitored | At least one active check | The last active check is switched off: to Explored |

## Requirements

<a id="fr-mr-01"></a>
### FR-MR-01 · Described: the view and every column have a description

**Status:** Specified · **Confluence:** MO-01

Described requires a description of the view and of every column.

*Note of 2026-10-26: only the descriptions from dbt count; a Business Description does not ([DEC-MR-09](#dec-mr-09)).* *Note of 2026-10-28: and without them a Resource cannot leave Available ([DEC-MR-10](#dec-mr-10)).*

<a id="fr-mr-02"></a>
### FR-MR-02 · Confirmed: the Owner confirms, from Described

**Status:** Specified · **Confluence:** MO-02

Confirmed requires a Confirmation by the Owner, from Described.

*Note of 2026-10-26: or over Described, where Business Descriptions cover every description dbt lacks ([DEC-MR-09](#dec-mr-09), [FR-MR-13](#fr-mr-13)).* *Note of 2026-10-28: no longer over Described; from Described only ([DEC-MR-10](#dec-mr-10)).*

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

**Status:** Withdrawn · **Confluence:** MO-05

A structural Change (hash of the structure) puts the Resource back to Described, whatever its Level. Type and logic Changes only notify the Owner.

*Note of 2026-10-26: withdrawn by Max. A change to the schema no longer lowers the Level; it gives a warning ([DEC-MR-08](#dec-mr-08), [FR-MR-12](#fr-mr-12)).*

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

*Note of 2026-10-26: a change to the schema is no drop any more ([DEC-MR-08](#dec-mr-08)), so a Confirmation stays valid through it.*

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

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#publishing-and-confirming)

When the Owner confirms a Resource again after a drop ([FR-SR-20](04-stacks-and-resources.md#fr-sr-20)), Data Hub shows why it dropped and what changed, who confirmed it last and when ([FR-RC-12](05-resource-card.md#fr-rc-12)), and what the Owner confirms: what the Resource is and what it stands for ([DEC-MR-07](#dec-mr-07)). The new Confirmation is kept with the Fingerprint of that moment, next to the earlier ones. It changes nothing about the Publication.

*Note of 2026-10-26: the control figures are left out; a Confirmation makes no claim about the data ([DEC-MR-07](#dec-mr-07)).*

*Note of 2026-10-26: withdrawn by Max. There is no reconfirmation: a change to the schema gives a warning, which the Owner marks seen ([DEC-MR-08](#dec-mr-08), [FR-MR-12](#fr-mr-12)). When a Level that dropped for another cause comes back, the earlier Confirmation still holds.*

<a id="fr-mr-12"></a>
### FR-MR-12 · A change since the last Confirmation gives a warning

**Status:** Specified · **Source:** Max, 2026-10-26 ([OP-MR-05](#op-mr-05))

When a field of a Resource is added, removed, renamed or gets another type after its last Confirmation, Data Hub shows a warning on the Resource to everyone who sees it, with what changed and when, and tells the Owner in the Message Centre. The Level and the Publication stay as they are. The Owner or the Data Team marks the warning seen; it then goes, and the change stays in the History. Changes that come before it is seen show together in the same warning.

<a id="fr-mr-13"></a>
### FR-MR-13 · Jumping over Described with Business Descriptions

**Status:** Withdrawn · **Source:** Max, 2026-10-26 ([OP-RC-20](05-resource-card.md#op-rc-20))

When the table or fields of a Resource have no description in dbt, its Owner can still publish and confirm it, once a Business Description covers each of them ([FR-RC-16](05-resource-card.md#fr-rc-16)). The Resource is then Confirmed, and its Level carries a mark that it was confirmed without every description in dbt, naming what is missing. The mark goes by itself once dbt has the descriptions. A description that later goes missing in dbt lowers the Level only when no Business Description covers it.


*Withdrawn on 2026-10-28, by Max: a Resource without its descriptions from dbt stays at Available and cannot be published ([DEC-MR-10](#dec-mr-10)).*
## Open points

- [ ] <a id="op-mr-01"></a>**OP-MR-01** · Work out a new domain, [EDA](15-eda.md): how an exploration runs and is linked to a Resource (builds on the [EDA framework](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168), Confluence, Dutch).
- [ ] <a id="op-mr-02"></a>**OP-MR-02** · Work out the domain [Checks and monitoring](08-checks-and-monitoring.md): kinds of checks, incidents and alerts.

Raised during the migration to this repository; not on the Confluence page:

- [ ] <a id="op-mr-03"></a>**OP-MR-03** · Align the definition of Described. [DEC-DH-34](../../overview/data-hub.md#dec-dh-34) requires, at a minimum, a description on the table and on every column plus `model_type` and `grain` in `meta`. [DEC-MR-01](#dec-mr-01) and [FR-MR-01](#fr-mr-01) only require the descriptions.
- [ ] <a id="op-mr-04"></a>**OP-MR-04** · Complete the drop causes in [Rising and dropping](#rising-and-dropping). Two drops defined elsewhere are not in the table: removal from a Collection drops a Resource to Described ([FR-CO-08](03-collections.md#fr-co-08)), and an Owner Unit that empties should make its Resources drop, with this domain to define how ([EC-UM-01](02-user-management.md#ec-um-01), [EC-CO-01](03-collections.md#ec-co-01)). *Note of 2026-10-26: a structural Change is no longer a cause of a drop ([DEC-MR-08](#dec-mr-08)); the causes named here remain to complete.*

Raised during the review of the migration; not on the Confluence page:

- [x] <a id="op-mr-05"></a>**OP-MR-05** · Clarify which part of the Fingerprint makes a Resource drop to Described. [DEC-DH-35](../../overview/data-hub.md#dec-dh-35) says any deviation of the schema from the Fingerprint taken at Confirmation drops it, and [FR-SR-08](04-stacks-and-resources.md#fr-sr-08) includes a hash of the types in the Fingerprint. [DEC-DH-26](../../overview/data-hub.md#dec-dh-26) and [FR-MR-05](#fr-mr-05) say a type Change does not lower the Level; only the structure hash does. *Decided on 2026-10-26, by Max: no part of the Fingerprint makes a Resource drop; a change to the schema gives a warning ([DEC-MR-08](#dec-mr-08)).*

## Builds on

- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [Stacks and resources](04-stacks-and-resources.md)
- [Artifact registry](01-artifact-registry.md)
