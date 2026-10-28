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
- The Message to the Data Team on every Registration: [FR-SR-10](04-stacks-and-resources.md#fr-sr-10), [OP-SR-04](04-stacks-and-resources.md#op-sr-04)
- Completing the Log Catalogue: [OP-SR-02](04-stacks-and-resources.md#op-sr-02)
- Channel and rhythm of notifications: [OP-DH-20](../../overview/open-themes.md#op-dh-20)
- Every type of Message, who gets a notification of it, and its texts: the [Message catalogue](message-catalogue.md) ([DEC-CV-07](14-conversations.md#dec-cv-07))

## Decisions

- <a id="dec-ln-01"></a>**DEC-LN-01** · Data Hub keeps its own Query Log of every query it executes, with the Query ID, the SQL, who ran it, when, the bytes processed, the Resources beneath it and the ID of the job in BigQuery. It does not rely on the job log of BigQuery, which keeps 180 days, so that a Report or a screenshot can be traced back for as long as it exists. Because SQL can hold values, the Query Log is readable only by the Data Team and by whoever ran the query. This replaces [DEC-SR-18](04-stacks-and-resources.md#dec-sr-18). *Decided on 2026-10-22, after the workshop ([OP-LN-01](#op-ln-01)).* *Note of 2026-10-26: the Owner Unit of a Resource also reads the SQL of the queries on it ([DEC-SR-31](04-stacks-and-resources.md#dec-sr-31)).*

- <a id="dec-ln-02"></a>**DEC-LN-02** · A notification goes out immediately, never as a digest. It reaches the User in Data Hub, always, and by e-mail. Slack is preferred too, if a connection with Slack is possible ([OP-LN-04](#op-ln-04)). *Note of 2026-10-28: it is, in version 1 ([DEC-LN-05](#dec-ln-05)).* Every channel takes its text from the Message Catalogue ([FR-CV-15](14-conversations.md#fr-cv-15)). *Decided on 2026-10-28, by Max ([OP-DH-20](../../overview/open-themes.md#op-dh-20)).*
- <a id="dec-ln-03"></a>**DEC-LN-03** · A notification to an Owner Unit goes by e-mail to the address of its Google group, so that every member gets it, also those who never signed in to Data Hub ([DEC-UM-08](02-user-management.md#dec-um-08)). In Data Hub it reaches the members Data Hub knows. *Decided on 2026-10-28, by Max ([OP-LN-05](#op-ln-05)).*
- <a id="dec-ln-04"></a>**DEC-LN-04** · A logic Change notifies the Owner of a Resource both when it is in the Node of the Resource itself and when it is in a Node further upstream, which the artifact registry follows down the lineage ([FR-AR-12](01-artifact-registry.md#fr-ar-12)). The Message names the Node and how far upstream it is. One Message per Resource and Artifact Set. *Decided on 2026-10-28, by Max ([OP-LN-03](#op-ln-03)).*
- <a id="dec-ln-05"></a>**DEC-LN-05** · Data Hub sends notifications in Slack in version 1, through one Slack app of Immoscoop, as direct messages only, never in channels. The app has a bot token with the scopes `chat:write`, `im:write` and `users:read.email`, kept in Secret Manager. Data Hub finds a User in Slack by the e-mail address of their Google account; a User who is not in Slack gets e-mail alone. *Decided on 2026-10-28, by Max ([OP-LN-04](#op-ln-04)).*
- <a id="dec-ln-06"></a>**DEC-LN-06** · The Data Team owns the Slack app of Data Hub; a Slack admin installs it in the workspace once. *Decided on 2026-10-28, by Max ([OP-LN-06](#op-ln-06)).*

## Requirements

*The requirements below come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md). They are proposals, still to be validated, and therefore Proposed; those on the Query Log are Specified by [DEC-LN-01](#dec-ln-01).*

<a id="fr-ln-01"></a>
### FR-LN-01 · A notification to an Owner reaches its whole Owner Unit

**Status:** Proposed · **Source:** [REQ-DH-OWNERS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-owners)

A notification to the Owner of a Collection or a Resource reaches every member of its Owner Unit, so that a Collection always potentially has several owners.

<a id="fr-ln-02"></a>
### FR-LN-02 · The Owner can notify the Consumers of a structural Change

**Status:** Proposed · **Source:** [REQ-DH-NOTIFY-SCHEMA](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-notify-schema)

When a field of a Resource changes and its Owner gets the warning ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)), the Owner can notify the Consumers of the Resource from Data Hub.

<a id="fr-ln-03"></a>
### FR-LN-03 · Data Hub knows the Consumers of a Resource

**Status:** Proposed · **Source:** [REQ-DH-NOTIFY-SCHEMA](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-notify-schema)

Data Hub knows the Consumers of a Resource, the Users of the Lenses and Reports built on it, through the lineage of those Lenses and Reports.

<a id="fr-ln-04"></a>
### FR-LN-04 · The Owner hears when a Lens on their Resource becomes public

**Status:** Proposed · **Source:** [REQ-DH-NOTIFY-LENS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-notify-lens)

When a Lens that builds on a Resource is made public, the Owner of that Resource gets a notification. Before the Lens is public, there is no notification.

*Note of 2026-10-28: public means published in a public Collection, available to the entire company, as for a Resource ([DEC-LE-09](09-lenses.md#dec-le-09)).*

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
- [x] <a id="op-ln-03"></a>**OP-LN-03** · Decide which logic Changes notify the Owner of a Resource ([DEC-DH-27](../../overview/data-hub.md#dec-dh-27)): only a Change in the Node of the Resource itself, or also one further upstream, which the artifact registry follows into the Log of every Resource downstream ([FR-AR-12](01-artifact-registry.md#fr-ar-12)). Proposal: as for descriptions ([FR-RC-17](05-resource-card.md#fr-rc-17)), only the Node of the Resource itself; a Change further upstream stays an entry in the Log. The catalogue names the Node and how far upstream it is ([MSG-RES-04](message-catalogue.md#msg-res-04)). *Raised on 2026-10-28, while making the Message Catalogue.* *Decided on 2026-10-28, by Max: also a Change further upstream ([DEC-LN-04](#dec-ln-04)).*
- [x] <a id="op-ln-04"></a>**OP-LN-04** · Find out whether Data Hub can send notifications in Slack, and what it requires ([DEC-LN-02](#dec-ln-02)). What is known: a Slack app of Immoscoop, installed in the workspace by a Slack admin, with a bot token of the scopes `chat:write`, `im:write` and `users:read.email`. Data Hub finds a User in Slack by the e-mail address of their Google account, and sends a direct message from the app; the token lives in Secret Manager, as other secrets do. Proposal: one app, direct messages only, no channels; a User who is not in Slack gets e-mail alone. Decide whether Slack is in v1, and who installs and owns the app. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-28, by Max: as proposed, in v1 ([DEC-LN-05](#dec-ln-05)); who installs and owns the app is [OP-LN-06](#op-ln-06).*
- [x] <a id="op-ln-06"></a>**OP-LN-06** · Decide who installs and owns the Slack app of Data Hub ([DEC-LN-05](#dec-ln-05)). Proposal: the Data Team owns it; a Slack admin installs it once. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-28, by Max: as proposed ([DEC-LN-06](#dec-ln-06)).*
- [x] <a id="op-ln-05"></a>**OP-LN-05** · Decide how a notification to an Owner Unit reaches members who never signed in, now that Data Hub knows the members of a Group only from their sign-in ([DEC-UM-08](02-user-management.md#dec-um-08), [FR-LN-01](#fr-ln-01)). Proposal: the e-mail goes to the address of the Google group itself. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-28, by Max: the e-mail goes to the address of the Google group ([DEC-LN-03](#dec-ln-03)).*
- [x] <a id="op-ln-02"></a>**OP-LN-02** · Work out what making a Lens public means, on which [FR-LN-04](#fr-ln-04) depends: Lenses have no visibility of their own yet ([OP-CO-07](03-collections.md#op-co-07)). *Raised while taking in the workshop of 2026-10-22.* *Decided on 2026-10-28, by Max: the same as for a Resource, available to the entire company ([DEC-LE-09](09-lenses.md#dec-le-09)).*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
