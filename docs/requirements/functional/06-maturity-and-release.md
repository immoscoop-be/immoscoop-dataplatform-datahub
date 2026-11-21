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

- <a id="dec-mr-01"></a>**DEC-MR-01** · Fully described means measurable: the view has a description and every column has one. The Owner judges length and quality when confirming. *Note of 2026-10-28: replaced by [DEC-MR-11](#dec-mr-11): the table and at least one field, with `model_type` and `grain`.*
- <a id="dec-mr-02"></a>**DEC-MR-02** · Explored: an EDA document is linked to the Resource. *Note of 2026-11-21: replaced by [DEC-MR-21](#dec-mr-21): the EDA document became the EDA of a Resource, and Explored means its EDA-Setup is complete.*
- <a id="dec-mr-03"></a>**DEC-MR-03** · Monitored: at least one active check runs on the Resource. *Note of 2026-10-28: in version 2 ([DEC-MR-13](#dec-mr-13)).* *Note of 2026-11-07: an active check is an active Rule of the Monitor of the Resource ([DEC-CM-12](08-checks-and-monitoring.md#dec-cm-12)); Monitored no longer waits for version 2 ([DEC-CM-13](08-checks-and-monitoring.md#dec-cm-13)).*
- <a id="dec-mr-04"></a>**DEC-MR-04** · A failing check does not lower the Level: that is the monitoring doing its job. It becomes an incident in the Log.
- <a id="dec-mr-05"></a>**DEC-MR-05** · A Confirmation does not expire. There is no expiry date and no reminder.
- <a id="dec-mr-06"></a>**DEC-MR-06** · The Level is information only and restricts nothing. The Publication determines access. The Level is visible in search results, on the Resource Card and on every Lens and Report, and Claude mentions it when it uses a Resource.
- <a id="dec-mr-07"></a>**DEC-MR-07** · A Confirmation is business confirming what a Resource is and what it stands for, as its descriptions say. It has no link to the data inside it: no control figures, no checks on values. Exploring the data belongs to the EDA, Level 4, Explored, where far more is learned about a Resource than a Confirmation can carry. *Decided on 2026-10-26, by Max.*
- <a id="dec-mr-08"></a>**DEC-MR-08** · A change to the schema of a Resource never lowers its Level, and asks for no new Confirmation. A field added, removed, renamed or retyped since the last Confirmation gives a warning on the Resource, to everyone who sees it, and the Owner a Message; the warning stays until the Owner or the Data Team marks it seen. The Level still follows its traces: a missing description, a removed EDA document or the last check switched off still lower it ([DEC-DH-31](../../overview/data-hub.md#dec-dh-31)). *Decided on 2026-10-26, by Max.*
- <a id="dec-mr-09"></a>**DEC-MR-09** · Described is done by the Data Team: a Resource is Described as soon as dbt has a description of the table and of every field. A Business Description does not count towards it. Where dbt has none, the Owner may jump over Described: once a Business Description covers every field, and the table, without a description in dbt, the Owner can publish and confirm. The Resource is then Confirmed, marked as confirmed without every description in dbt; the mark goes once dbt has them. *Decided on 2026-10-26, by Max ([OP-RC-20](05-resource-card.md#op-rc-20)).* *Note of 2026-10-28: the jump over Described is withdrawn: a Resource the Data Team has not described in dbt stays at Available ([DEC-MR-10](#dec-mr-10)).* *Note of 2026-10-28: what Described asks is now [DEC-MR-11](#dec-mr-11).*
- <a id="dec-mr-10"></a>**DEC-MR-10** · Only the Data Team describes a Resource into Described, in dbt. A Resource without its descriptions from dbt stays at 1 · Available: its Owner cannot write Business Descriptions on it and cannot publish it. A yaml next to the model is not required for a table to be a Resource ([FR-SR-32](04-stacks-and-resources.md#fr-sr-32)), but without its descriptions it cannot leave Available. Business Descriptions are written from Described on. This replaces the jump over Described of [DEC-MR-09](#dec-mr-09). *Decided on 2026-10-28, by Max ([OP-DH-05](../../overview/open-themes.md#op-dh-05)).*
- <a id="dec-mr-11"></a>**DEC-MR-11** · A Resource is Described as soon as dbt has a description of its table and of at least one of its fields, and the `meta` of its model holds `model_type` and `grain`. Business Descriptions start from there, at the level of the whole Resource: then its Owner and the Data Team can write one for the table and for every field, also a field dbt does not describe ([DEC-MR-10](#dec-mr-10)). The Owner judges whether it is described well enough when confirming. This replaces "every column" of [DEC-MR-01](#dec-mr-01) and [DEC-DH-34](../../overview/data-hub.md#dec-dh-34). *Decided on 2026-10-28, by Max ([OP-MR-03](#op-mr-03)).* *Note of 2026-10-28: `model_type` and `grain` are no longer asked of dbt ([DEC-MR-12](#dec-mr-12)).*
- <a id="dec-mr-12"></a>**DEC-MR-12** · Described asks of dbt only the descriptions: of the table and of at least one field. `model_type` and `grain` are not standard fields of dbt, so they are not read from its `meta`: Data Hub defines them, by the Data Admin ([DEC-RC-09](05-resource-card.md#dec-rc-09)), and they do not count towards Described. This replaces that part of [DEC-MR-11](#dec-mr-11). *Decided on 2026-10-28, by Max ([OP-MR-06](#op-mr-06)).*
- <a id="dec-mr-13"></a>**DEC-MR-13** · In v1 a Resource cannot reach 5 · Monitored: the ladder stops at 4 · Explored. Monitored comes in version 2, with the automatic checks from the EDA and the monitors ([OP-DH-19](../../overview/open-themes.md#op-dh-19)). *Decided on 2026-10-28, by Max ([OP-MR-07](#op-mr-07)).* *Note of 2026-11-07: replaced by [DEC-CM-13](08-checks-and-monitoring.md#dec-cm-13): monitoring is built as the next part after the launch, and 5 · Monitored becomes reachable.*
- <a id="dec-mr-14"></a>**DEC-MR-14** · In v1 Data Hub links no EDA document to a Resource yet: no screen is designed for it. A Resource therefore reaches at most 3 · Confirmed; its ladder shows 4 · Explored as the next step, out of reach, until the link is designed. *Decided on 2026-10-28, by Max ([OP-MR-08](#op-mr-08)).* *Note of 2026-11-21: the EDA document became the EDA ([DEC-MR-21](#dec-mr-21)). Later the same day, Max decided to build the EDA now ([DEC-ED-26](15-eda.md#dec-ed-26)): a Resource can reach 4 · Explored once its EDA-Setup is complete, so this no longer holds.*
- <a id="dec-mr-15"></a>**DEC-MR-15** · Whether a Resource is ready to be published has one definition, in one place: the catalogue refuses a Publication while a step required to publish is open, and the publication in Data Hub, the publication in Claude and the Owner Journey show the same list of what is done and what is open. It replaces the rule that 2 · Described alone makes a Resource ready ([DEC-MR-10](#dec-mr-10)), which stays the first condition. *Decided on 2026-11-15, by Max, choosing "Everywhere, enforced" from the options Claude proposed for the Owner Journey ([OP-CL-12](17-claude.md#op-cl-12)).* *Note of 2026-11-20: in Data Hub the steps still open show in the warning of Publish and in the [Flow Box](../../definitions.md#flow-box); the publication opens once every step is done ([DEC-MR-20](#dec-mr-20)).*
- <a id="dec-mr-16"></a>**DEC-MR-16** · A step towards Publication is marked in one of three ways. **Required to publish:** the Business Description; the Key Fields, each with a Business Description; the intended use; the pitfalls; the Known Gaps and the date the data is reliable since; and reading the card back. **Needed for the EDA,** shown but not blocking the Publication: the table type and the grain, which a Data Admin records, and from which the [EDA](15-eda.md) starts, as it does from the Key Fields ([DEC-ED-07](15-eda.md#dec-ed-07), [OP-ED-03](15-eda.md#op-ed-03)). **Advised:** the Business Descriptions of the other fields, the Parameters, the mappings, and the open Questions and Signals. For the pitfalls, the Known Gaps and the Parameters, "none" is an answer: who gave it, and when, is kept. *Decided on 2026-11-15, by Max, choosing "Three marks" from the options Claude proposed ([OP-CL-12](17-claude.md#op-cl-12)).* *Note of 2026-11-20: the Known Gaps and the date the data is reliable since are two required steps ([DEC-MR-18](#dec-mr-18)).* *Note of 2026-11-20: the advised step Parameters is gone, as Parameters folded into the Key Fields ([DEC-RC-34](05-resource-card.md#dec-rc-34)).*
- <a id="dec-mr-17"></a>**DEC-MR-17** · The Owner accepts a text with a yes in the conversation, step by step, and Claude writes it only then ([DEC-CL-07](17-claude.md#dec-cl-07)). The publication reads the whole card back, as a colleague will see it, and its declaration, now kept with the Confirmation, accepts every text on the card, also those written before, by a colleague or an earlier conversation: reading back and publishing are one window. *Decided on 2026-11-15, by Max, choosing "Yes in chat; declaration covers all" from the options Claude proposed ([OP-CL-12](17-claude.md#op-cl-12)).*
- <a id="dec-mr-18"></a>**DEC-MR-18** · [Reliable Since](../../definitions.md#reliable-since) and the Known Gaps are two steps required to publish, each done or open on its own, with its own line and its own way to the Known Gaps part: in Maturity, in the publication in Data Hub and in Claude, and in the Owner Journey, which has thirteen steps ([DEC-RC-29](05-resource-card.md#dec-rc-29)). Which comes first is [OP-MR-09](#op-mr-09). *Decided on 2026-11-20, by Max: "if you look at the maturity, there's one item saying 'describe the known gaps and the reliable since' … it needs to be split up into two."*
- <a id="dec-mr-19"></a>**DEC-MR-19** · Reliable Since comes before the Known Gaps, in Maturity, in both publications and in the Owner Journey, where it is step 7 and the Known Gaps step 8 ([OP-MR-09](#op-mr-09)). *Decided on 2026-11-20, by Max, approving the design as proposed: "Brilliant, this is perfect. You may commit everything and then start building, please."*
- <a id="dec-mr-20"></a>**DEC-MR-20** · Publish in Data Hub opens the publication only once every step required to publish is done. While one is open, it warns that the Resource is not ready to publish yet, names each open step with the way to it, and offers to take the Owner through them in the [Flow Box](../../definitions.md#flow-box) ([DEC-UX-302](../../design/principles.md#dec-ux-302)); the publication itself therefore no longer lists what is open. *Decided on 2026-11-20, by Max, agreeing with the proposal Claude made while reading his description of the flow box: "Agree."*
- <a id="dec-mr-21"></a>**DEC-MR-21** · A Resource is 4 · Explored once the EDA-Setup of its EDA is complete: every EDA-Probe its model type must have is added and set on its fields ([DEC-ED-01](15-eda.md#dec-ed-01), [DEC-ED-12](15-eda.md#dec-ed-12), [DEC-ED-17](15-eda.md#dec-ed-17)). It drops to 3 · Confirmed only when its EDA goes. An EDA-Rerun, a result that reads badly or a Key Field marked later lowers nothing: an EDA does not go out of date, and a Key Field it does not cover gives a warning ([DEC-ED-06](15-eda.md#dec-ed-06), [DEC-ED-07](15-eda.md#dec-ed-07)). It replaces [DEC-MR-02](#dec-mr-02). *Decided on 2026-11-21, by Max, aligning Maturity with the EDA ([OP-ED-08](15-eda.md#op-ed-08)).*

The overarching decisions on how the Level is determined and on the two-step Release are in the overview: [DEC-DH-31](../../overview/data-hub.md#dec-dh-31) to [DEC-DH-37](../../overview/data-hub.md#dec-dh-37) and [DEC-DH-38](../../overview/data-hub.md#dec-dh-38) to [DEC-DH-40](../../overview/data-hub.md#dec-dh-40).

## Rising and dropping

| Level | Reached when | Drops when |
| --- | --- | --- |
| 1 Available | Registered, description incomplete | – |
| 2 Described | The table and at least one field have a description in dbt ([DEC-MR-12](#dec-mr-12)) | The description of the table, or the last one of a field, is missing: to Available |
| 3 Confirmed | The Owner confirms (the first Publication is the first Confirmation), from Described only ([DEC-MR-10](#dec-mr-10)) | – (a change to the schema gives a warning, [DEC-MR-08](#dec-mr-08)) |
| 4 Explored | Its EDA-Setup is complete ([DEC-MR-21](#dec-mr-21)) | Its EDA goes: to Confirmed |
| 5 Monitored | At least one active Rule of its Monitor ([DEC-CM-12](08-checks-and-monitoring.md#dec-cm-12)) | The last active Rule is switched off: to Explored |

## Requirements

<a id="fr-mr-01"></a>
### FR-MR-01 · Described: the view and every column have a description

**Status:** Withdrawn · **Confluence:** MO-01

Described requires a description of the view and of every column.

*Note of 2026-10-26: only the descriptions from dbt count; a Business Description does not ([DEC-MR-09](#dec-mr-09)).* *Note of 2026-10-28: and without them a Resource cannot leave Available ([DEC-MR-10](#dec-mr-10)).*

*Withdrawn on 2026-10-28, by Max: replaced by [FR-MR-14](#fr-mr-14): the table and at least one field, with `model_type` and `grain` ([DEC-MR-11](#dec-mr-11)).*

<a id="fr-mr-02"></a>
### FR-MR-02 · Confirmed: the Owner confirms, from Described

**Status:** Implemented · **Confluence:** MO-02 · **Screens:** [resource-publish](../../design/screens/resource-publish.html)

Confirmed requires a Confirmation by the Owner, from Described.

*Note of 2026-10-26: or over Described, where Business Descriptions cover every description dbt lacks ([DEC-MR-09](#dec-mr-09), [FR-MR-13](#fr-mr-13)).* *Note of 2026-10-28: no longer over Described; from Described only ([DEC-MR-10](#dec-mr-10)).*

<a id="fr-mr-03"></a>
### FR-MR-03 · Explored: a linked EDA document

**Status:** Withdrawn · **Confluence:** MO-03

Explored requires a linked EDA document, on top of Confirmed.

*Could, not in v1: set on 2026-10-28, by Max; no screen links an EDA document yet ([DEC-MR-14](#dec-mr-14)).*

*Withdrawn on 2026-11-21, by Max: replaced by [FR-MR-22](#fr-mr-22): Explored is a complete EDA-Setup ([DEC-MR-21](#dec-mr-21)).*

<a id="fr-mr-04"></a>
### FR-MR-04 · Monitored: at least one active check

**Status:** Specified · **Confluence:** MO-04

Monitored requires at least one active check, on top of Explored.

*Note of 2026-11-07: no longer left out of version 1; Monitored and its Rules come with [Checks and monitoring](08-checks-and-monitoring.md), the next part after the launch ([DEC-CM-13](08-checks-and-monitoring.md#dec-cm-13)).*

<a id="fr-mr-05"></a>
### FR-MR-05 · A structural Change resets the Level to Described

**Status:** Withdrawn · **Confluence:** MO-05

A structural Change (hash of the structure) puts the Resource back to Described, whatever its Level. Type and logic Changes only notify the Owner.

*Note of 2026-10-26: withdrawn by Max. A change to the schema no longer lowers the Level; it gives a warning ([DEC-MR-08](#dec-mr-08), [FR-MR-12](#fr-mr-12)).*

<a id="fr-mr-06"></a>
### FR-MR-06 · A failing check does not lower the Level

**Status:** Specified · **Confluence:** MO-06

A failing check does not lower the Level and is logged as an incident.

*Note of 2026-11-07: no longer left out of version 1; Monitored and its Rules come with [Checks and monitoring](08-checks-and-monitoring.md), the next part after the launch ([DEC-CM-13](08-checks-and-monitoring.md#dec-cm-13)).*

<a id="fr-mr-07"></a>
### FR-MR-07 · Drop when the last check or the EDA goes

**Status:** Specified · **Confluence:** MO-07

If the last active check is switched off, the Resource drops to Explored. If its EDA goes, it drops to Confirmed.

*Note of 2026-11-07: no longer left out of version 1; Monitored and its Rules come with [Checks and monitoring](08-checks-and-monitoring.md), the next part after the launch ([DEC-CM-13](08-checks-and-monitoring.md#dec-cm-13)).*

<a id="fr-mr-08"></a>
### FR-MR-08 · A Confirmation does not expire

**Status:** Implemented · **Confluence:** MO-08 · **Screens:** [resource-publish](../../design/screens/resource-publish.html)

A Confirmation stays valid as long as there is no drop. There is no expiry date or reminder.

*Note of 2026-10-26: a change to the schema is no drop any more ([DEC-MR-08](#dec-mr-08)), so a Confirmation stays valid through it.*

<a id="fr-mr-09"></a>
### FR-MR-09 · Log every rise and drop, and alert the Owner on a drop

**Status:** Implemented · **Confluence:** MO-09

Every rise and drop goes into the Log, and every drop gives the Owner an alert.

*Note of 2026-10-28, on building it: the Level follows dbt with every new Current Version; the alert is the Message [MSG-RES-05](message-catalogue.md#msg-res-05), which the Message Centre shows with part 7 of the [build order](../../design/build-order.md).*

<a id="fr-mr-10"></a>
### FR-MR-10 · The Level restricts nothing and is shown everywhere

**Status:** Implemented · **Confluence:** MO-10 · **Screens:** [collection-add-resources](../../design/screens/collection-add-resources.html), [collection-overview](../../design/screens/collection-overview.html), [resource-detail](../../design/screens/resource-detail.html), [resource-lineage](../../design/screens/resource-lineage.html), [resource-unassigned](../../design/screens/resource-unassigned.html)

The Level restricts no access or channel. It is shown everywhere, also by Claude.

*Note of 2026-10-31, on checking what was built: the Level shows in the panel, on every list and on every page; Claude shows it from version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-mr-11"></a>
### FR-MR-11 · Confirming again shows what changed

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#publishing-and-confirming)

When the Owner confirms a Resource again after a drop ([FR-SR-20](04-stacks-and-resources.md#fr-sr-20)), Data Hub shows why it dropped and what changed, who confirmed it last and when ([FR-RC-12](05-resource-card.md#fr-rc-12)), and what the Owner confirms: what the Resource is and what it stands for ([DEC-MR-07](#dec-mr-07)). The new Confirmation is kept with the Fingerprint of that moment, next to the earlier ones. It changes nothing about the Publication.

*Note of 2026-10-26: the control figures are left out; a Confirmation makes no claim about the data ([DEC-MR-07](#dec-mr-07)).*

*Note of 2026-10-26: withdrawn by Max. There is no reconfirmation: a change to the schema gives a warning, which the Owner marks seen ([DEC-MR-08](#dec-mr-08), [FR-MR-12](#fr-mr-12)). When a Level that dropped for another cause comes back, the earlier Confirmation still holds.*

<a id="fr-mr-12"></a>
### FR-MR-12 · A change since the last Confirmation gives a warning

**Status:** Implemented · **Source:** Max, 2026-10-26 ([OP-MR-05](#op-mr-05)) · **Screens:** [messages](../../design/screens/messages.html), [resource-detail](../../design/screens/resource-detail.html)

When a field of a Resource is added, removed, renamed or gets another type after its last Confirmation, Data Hub shows a warning on the Resource to everyone who sees it, with what changed and when, and tells the Owner in the Message Centre. The Level and the Publication stay as they are. The Owner or the Data Team marks the warning seen; it then goes, and the change stays in the History. Changes that come before it is seen show together in the same warning.

*Note of 2026-10-28, on building it: a rename shows as a field removed and one added. The changes are kept for the History, which comes with its tab; the Message [MSG-RES-03](message-catalogue.md#msg-res-03) shows in the Message Centre with part 7 of the [build order](../../design/build-order.md) ([TR-SR-13](../technical/04-stacks-and-resources.md#tr-sr-13)).*

<a id="fr-mr-13"></a>
### FR-MR-13 · Jumping over Described with Business Descriptions

**Status:** Withdrawn · **Source:** Max, 2026-10-26 ([OP-RC-20](05-resource-card.md#op-rc-20))

When the table or fields of a Resource have no description in dbt, its Owner can still publish and confirm it, once a Business Description covers each of them ([FR-RC-16](05-resource-card.md#fr-rc-16)). The Resource is then Confirmed, and its Level carries a mark that it was confirmed without every description in dbt, naming what is missing. The mark goes by itself once dbt has the descriptions. A description that later goes missing in dbt lowers the Level only when no Business Description covers it.


*Withdrawn on 2026-10-28, by Max: a Resource without its descriptions from dbt stays at Available and cannot be published ([DEC-MR-10](#dec-mr-10)).*

<a id="fr-mr-14"></a>
### FR-MR-14 · Described: the table, a field, its model type and grain

**Status:** Withdrawn · **Source:** Max, 2026-10-28 ([DEC-MR-11](#dec-mr-11))

Data Hub derives Described from the Current Version of the dbt project: the table has a description, at least one field has one, and the `meta` of the model holds `model_type` and `grain` ([OP-MR-06](#op-mr-06)). Only what is in dbt counts; a Business Description does not. When one of these goes missing, the Level drops to Available.

*Withdrawn on 2026-10-28, by Max: replaced by [FR-MR-15](#fr-mr-15): `model_type` and `grain` are not read from dbt ([DEC-MR-12](#dec-mr-12)).*

<a id="fr-mr-15"></a>
### FR-MR-15 · Described: the table and a field, described in dbt

**Status:** Implemented · **Source:** Max, 2026-10-28 ([DEC-MR-12](#dec-mr-12)) · **Screens:** [resource-publish](../../design/screens/resource-publish.html)

Data Hub derives Described from the Current Version of the dbt project: the table has a description, and at least one field has one. Only what is in dbt counts; a Business Description does not, nor what the Data Admin sets in Data Hub. When the description of the table, or the last one of a field, goes missing, the Level drops to Available.
<a id="fr-mr-16"></a>
### FR-MR-16 · The Overview explains every Level, passed or what it takes

**Status:** Implemented · **Source:** Max, 2026-11-04 ([DEC-UX-175](../../design/principles.md#dec-ux-175)) · **Screens:** [resource-overview](../../design/screens/resource-overview.html)

Beside the ladder of a Resource, its Overview explains every Level from 1 · Available to 5 · Monitored. A Level passed is marked so, with how it was reached: registered through an exposure of a dbt project, the table and how many fields described in dbt ([FR-MR-15](#fr-mr-15)), published and confirmed by whom and when ([FR-SR-49](04-stacks-and-resources.md#fr-sr-49)), with a change since the last Confirmation ([FR-MR-12](#fr-mr-12)). The Level it is at stands out. A Level still to reach says what it takes and who does it: the Data Team describes it in dbt, its Owner publishes it, its Owner completes the EDA-Setup of its EDA ([DEC-MR-21](#dec-mr-21), [DEC-MR-14](#dec-mr-14)), an active check runs on it, which comes in version 2 ([DEC-MR-13](#dec-mr-13)). 0 · Beta is named under them, for concepts. The Publication has no tile of its own.

<a id="fr-mr-17"></a>
### FR-MR-17 · A Publication waits for the steps required to publish

**Status:** Implemented · **Source:** Max, 2026-11-15 ([DEC-MR-15](#dec-mr-15), [DEC-MR-16](#dec-mr-16), [DEC-CL-17](17-claude.md#dec-cl-17)) · **Screens:** [resource-publish](../../design/screens/resource-publish.html), [mcp-resource-publish](../../design/screens/mcp-resource-publish.html), [resource-overview](../../design/screens/resource-overview.html), [flow-box](../../design/screens/flow-box.html)

A Resource can be published once it is Described and every step required to publish is done: its Business Description; its Key Fields, each with a Business Description; its intended use; its pitfalls, or who said there are none; its Known Gaps, or who said there are none, and the day it is reliable since. The catalogue refuses a Publication while one is open, and says which. The publication in Data Hub, the publication in Claude, the Maturity of the Resource and the Owner Journey all show the same list: each required step done or open, each open one with what it misses and the way to its part of the Overview; what the [EDA](15-eda.md) needs later, the table type and the grain; and what is advised, the other fields, the Parameters, the mappings and the open Questions and Signals, which hold nothing up.

*Note of 2026-11-20: Reliable Since and the Known Gaps become two steps, each with its own line ([DEC-MR-18](#dec-mr-18), [FR-RC-31](05-resource-card.md#fr-rc-31)).*

*Note of 2026-11-20: in Data Hub, the list also shows in the [Flow Box](../../definitions.md#flow-box) ([FR-MR-20](#fr-mr-20)), and in the warning of Publish, which opens the publication only once every step is done ([FR-MR-21](#fr-mr-21)).*

**Makes easy:** knowing, in one look and in the same words everywhere, what still stands between a Resource and its Publication, and going straight to it. **Makes hard:** publishing a Resource whose card says nothing of what it is for, where it trips people up and what it does not hold.

<a id="fr-mr-18"></a>
### FR-MR-18 · None is an answer, kept with who gave it and when

**Status:** Implemented · **Source:** Max, 2026-11-15 ([DEC-MR-16](#dec-mr-16)) · **Screens:** [resource-overview](../../design/screens/resource-overview.html)

Where none is an answer, the pitfalls and the Known Gaps in Data Hub, and the Parameters through Claude, whoever may describe the Resource can say there is nothing to add. Data Hub keeps who said so and when, writes it into the Log of the Resource, and shows it in the empty part: "None, according to" whom, on which day, until someone writes one. Claude also records that the Owner went through a step that writes nothing of its own, such as the fields or the open Questions and Signals ([FR-CL-31](17-claude.md#fr-cl-31)).

**Makes easy:** saying, once and for everyone, that a Resource has no pitfall or no Known Gap, so that the next reader trusts the silence. **Makes hard:** an empty part that leaves a reader guessing whether nobody looked or there is nothing to find.

<a id="fr-mr-19"></a>
### FR-MR-19 · The declaration is kept as the Owner ticked it

**Status:** Implemented · **Source:** Max, 2026-11-15 ([DEC-MR-17](#dec-mr-17))

Once every step required to publish is done, the publication reads the whole card back, as a colleague will see it: the Business Description and the description from dbt, the intended use, the pitfalls, the Known Gaps with the day it is reliable since, the Key Fields and the Parameters. Its declaration accepts every text on the card, also those written before, by a colleague or an earlier conversation: "For" the Owner Unit, "I have read this card and confirm that this Resource is correct: what it is and what it stands for, in every text on it." Data Hub keeps the declaration, in the words the Owner ticked, with the Confirmation.

*Note of 2026-11-20: the card read back names Reliable Since on a line of its own, with its Date Field and why not earlier, before the Known Gaps ([FR-RC-31](05-resource-card.md#fr-rc-31)).*

*Note of 2026-11-20: the card read back names the Key Fields, no Parameters ([DEC-RC-34](05-resource-card.md#dec-rc-34)).*

**Makes easy:** knowing later what exactly an Owner confirmed, in their own words. **Makes hard:** confirming a card without reading it, and a declaration that covers less than the card shows.

<a id="fr-mr-20"></a>
### FR-MR-20 · The Flow Box takes the Owner Unit through the steps required to publish

**Status:** Implemented · **Source:** Max, 2026-11-20 ([DEC-UX-299](../../design/principles.md#dec-ux-299), [DEC-UX-300](../../design/principles.md#dec-ux-300), [DEC-UX-301](../../design/principles.md#dec-ux-301), [DEC-UX-302](../../design/principles.md#dec-ux-302), [DEC-UX-303](../../design/principles.md#dec-ux-303), [DEC-UX-304](../../design/principles.md#dec-ux-304), [DEC-UX-305](../../design/principles.md#dec-ux-305), [DEC-UX-306](../../design/principles.md#dec-ux-306), [DEC-UX-307](../../design/principles.md#dec-ux-307), [DEC-UX-308](../../design/principles.md#dec-ux-308)) · **Screens:** [flow-box](../../design/screens/flow-box.html)

While a Resource is not published, whoever may describe it can follow its steps required to publish in a [Flow Box](../../definitions.md#flow-box): the same steps as its Maturity shows, each done or open with what it holds or what it misses, and the step to do now with what it asks, why and how, its Learning Card, and the way to its place in Data Hub, which opens that place for editing. The Flow Box reads the journey of the Resource, as Maturity, the publication and Claude do ([DEC-MR-15](#dec-mr-15)), and ticks a step as soon as it is done; it writes nothing itself and keeps nothing of its own: it opens from the beginning, at the first step still open. There is one at a time. It stays open on every page of Data Hub until it is closed, folds to a strip with Minimize, and comes back with Publish.

**Makes easy:** describing a Resource in Data Hub, one step at a time, with the why of each step at hand, and looking at its data in Query on the way without losing the thread. **Makes hard:** losing track of what is still open, and writing a step without knowing what it is for.

<a id="fr-mr-21"></a>
### FR-MR-21 · Publish warns while a step is open, and offers to guide

**Status:** Implemented · **Source:** Max, 2026-11-20 ([DEC-MR-20](#dec-mr-20)) · **Screens:** [flow-box](../../design/screens/flow-box.html), [resource-publish](../../design/screens/resource-publish.html)

While a step required to publish is open, Publish on a Resource does not open the publication: it says that the Resource is not ready to publish yet, lists each open step with what it misses and a link to its place, and offers "Guide me", which opens the Flow Box at the first open step, and "I'll do it myself". Once every step is done, Publish opens the publication, which reads the whole card back ([FR-MR-19](#fr-mr-19)).

**Makes easy:** learning what still stands between a Resource and its Publication at the moment you want to publish, and being taken there. **Makes hard:** opening a publication that cannot be confirmed yet.

<a id="fr-mr-22"></a>
### FR-MR-22 · Explored: a complete EDA-Setup

**Status:** Specified · **Source:** Max, 2026-11-21 ([DEC-MR-21](#dec-mr-21)) · **Screens:** [resource-detail](../../design/screens/resource-detail.html), [resource-overview](../../design/screens/resource-overview.html), [eda](../../design/screens/eda.html)

A Resource at 3 · Confirmed becomes 4 · Explored once the EDA-Setup of its EDA is complete: every EDA-Probe its model type must have is added and set on its fields, the Key Fields among them ([DEC-ED-12](15-eda.md#dec-ed-12), [DEC-ED-17](15-eda.md#dec-ed-17)). It drops back to 3 · Confirmed only when its EDA goes ([FR-MR-07](#fr-mr-07)). An EDA-Rerun, a result that reads badly, or a Key Field marked after the EDA-Setup lowers nothing; a Key Field the EDA does not cover gives a warning that names it ([DEC-ED-07](15-eda.md#dec-ed-07)).

*Could, not in v1, as FR-MR-03 was: the screens of the EDA are still to draw ([DEC-MR-14](#dec-mr-14), [OP-UX-91](../../design/principles.md#op-ux-91)).*

**Makes easy:** knowing what Explored means and what is still needed to reach it, in the EDA itself. **Makes hard:** a Resource that counts as explored while the EDA-Probes its kind of table needs were never added, or that falls back because its data changed.

## Open points

- [ ] <a id="op-mr-01"></a>**OP-MR-01** · Work out a new domain, [EDA](15-eda.md): how an exploration runs and is linked to a Resource (builds on the [EDA framework](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1352237168), Confluence, Dutch). *Could, not in v1: set on 2026-10-28, by Max; a domain for EDA is not part of version 1.*
- [x] <a id="op-mr-02"></a>**OP-MR-02** · Work out the domain [Checks and monitoring](08-checks-and-monitoring.md): kinds of checks, incidents and alerts. *Could, not in v1: set on 2026-10-28, by Max; checks and monitoring come in version 2 ([DEC-MR-13](#dec-mr-13)).* *Decided on 2026-11-07, by Max: worked out from his brainstorm, as [Checks and monitoring](08-checks-and-monitoring.md).*

Raised during the migration to this repository; not on the Confluence page:

- [x] <a id="op-mr-03"></a>**OP-MR-03** · Align the definition of Described. [DEC-DH-34](../../overview/data-hub.md#dec-dh-34) requires, at a minimum, a description on the table and on every column plus `model_type` and `grain` in `meta`. [DEC-MR-01](#dec-mr-01) and [FR-MR-01](#fr-mr-01) only require the descriptions. *Decided on 2026-10-28, by Max: the table, at least one field, and `model_type` and `grain` in `meta` ([DEC-MR-11](#dec-mr-11), [FR-MR-14](#fr-mr-14)).* *Note of 2026-10-28: `model_type` and `grain` dropped again: only the descriptions ([DEC-MR-12](#dec-mr-12)).*
- [ ] <a id="op-mr-04"></a>**OP-MR-04** · Complete the drop causes in [Rising and dropping](#rising-and-dropping). Two drops defined elsewhere are not in the table: removal from a Collection drops a Resource to Described ([FR-CO-08](03-collections.md#fr-co-08)), and an Owner Unit that empties should make its Resources drop, with this domain to define how ([EC-UM-01](02-user-management.md#ec-um-01), [EC-CO-01](03-collections.md#ec-co-01)). *Note of 2026-10-26: a structural Change is no longer a cause of a drop ([DEC-MR-08](#dec-mr-08)); the causes named here remain to complete.* *Note of 2026-10-28: an Owner Unit that empties no longer drops the Level ([EC-UM-04](02-user-management.md#ec-um-04)).* *Could, not in v1: set on 2026-10-28, by Max; completing the drop causes is not part of version 1.*
- [x] <a id="op-mr-06"></a>**OP-MR-06** · Decide the values of `model_type` and the form of `grain` in the `meta` of a model ([DEC-MR-11](#dec-mr-11)). dbt has no property of its own for either; `meta` is free and holds both. Proposal: `grain` is the list of the columns that together identify a row, as [DEC-RC-07](05-resource-card.md#dec-rc-07) says, such as `[week_start, lead_source]`; `model_type` is one of a short list, such as `event`, `state`, `fact`, `dimension` and `aggregate`. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-28, by Max: neither comes from dbt, as they are not standard fields there; Data Hub defines them ([DEC-MR-12](#dec-mr-12), [DEC-RC-09](05-resource-card.md#dec-rc-09)).*
- [x] <a id="op-mr-07"></a>**OP-MR-07** · Decide whether a Resource can reach 5 · Monitored in v1, now that the automatic checks from the EDA and the monitors are for version 2 ([OP-DH-19](../../overview/open-themes.md#op-dh-19)): Monitored asks for at least one active check. Proposal: the ladder in v1 stops at 4 · Explored; Monitored is shown as the next step, out of reach until the checks come. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-28, by Max: no, it is part of version 2 ([DEC-MR-13](#dec-mr-13)).*

Raised during the review of the migration; not on the Confluence page:

- [x] <a id="op-mr-05"></a>**OP-MR-05** · Clarify which part of the Fingerprint makes a Resource drop to Described. [DEC-DH-35](../../overview/data-hub.md#dec-dh-35) says any deviation of the schema from the Fingerprint taken at Confirmation drops it, and [FR-SR-08](04-stacks-and-resources.md#fr-sr-08) includes a hash of the types in the Fingerprint. [DEC-DH-26](../../overview/data-hub.md#dec-dh-26) and [FR-MR-05](#fr-mr-05) say a type Change does not lower the Level; only the structure hash does. *Decided on 2026-10-26, by Max: no part of the Fingerprint makes a Resource drop; a change to the schema gives a warning ([DEC-MR-08](#dec-mr-08)).*

Raised on 2026-10-28, while mapping the screens to the requirements:

- [x] <a id="op-mr-08"></a>**OP-MR-08** · [FR-MR-07](#fr-mr-07) is a Could as a whole, while its second half, a drop to Confirmed when the EDA document goes, belongs to 4 · Explored, which v1 reaches ([FR-MR-03](#fr-mr-03), [DEC-MR-13](#dec-mr-13)); and no screen links the EDA document of a Resource. Decide whether v1 links an EDA document, and if so, where; then whether that half of FR-MR-07 stays in v1. *Raised on 2026-10-28, while mapping the screens to the requirements.* *Decided on 2026-10-28, by Max: v1 links no EDA document until a screen for it is designed, so FR-MR-07 stays a Could as a whole ([DEC-MR-14](#dec-mr-14)).*
- [x] <a id="op-mr-09"></a>**OP-MR-09** · Decide the order of the two steps Reliable Since and Known Gaps ([DEC-MR-18](#dec-mr-18)). Proposal: Reliable Since first, then the Known Gaps, as a Known Gap is a hole after that day: in Maturity, in both publications, and in the Owner Journey as step 7 Reliable since and step 8 Known Gaps, the steps after them one further. *Raised on 2026-11-20, while designing Reliable Since.* *Decided on 2026-11-20, by Max: as proposed ([DEC-MR-19](#dec-mr-19)).*

## Builds on

- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [Resources](04-stacks-and-resources.md)
- [Artifact registry](01-artifact-registry.md)
