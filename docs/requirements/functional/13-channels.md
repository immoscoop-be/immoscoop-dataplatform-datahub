# Channels

| | |
| --- | --- |
| Domain | 13 of Data Hub · code `CH` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Kanalen) |

**Scope:** Data Hub itself, Claude as an MCP App, Excel and HTML reports.

*Functional domain 13 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Decisions

- <a id="dec-ch-01"></a>**DEC-CH-01** · The web app of Data Hub carries every asset, in every screen designed in [`docs/design/`](../../design/README.md): how each is used there follows from those screens. *Decided on 2026-10-28, by Max ([OP-DH-12](../../overview/open-themes.md#op-dh-12)).*
- <a id="dec-ch-02"></a>**DEC-CH-02** · Claude, through the MCP of Data Hub, comes in version 2. Then every endpoint the services make available is gone over, to decide how the MCP answers it. Until then, what is written for Claude is kept, marked *Could, not in v1* ([Could: not in v1](../README.md#could-not-in-v1)). *Decided on 2026-10-28, by Max ([OP-DH-12](../../overview/open-themes.md#op-dh-12)).*
- <a id="dec-ch-03"></a>**DEC-CH-03** · Excel gets only the result of Lenses: data, never a visual, with the Parameters at their default values, worked out at every refresh ([DEC-DH-46](../../overview/data-hub.md#dec-dh-46)). Resources, queries and Reports do not go to Excel. *Decided on 2026-10-28, by Max ([OP-DH-12](../../overview/open-themes.md#op-dh-12)).*

- <a id="dec-ch-04"></a>**DEC-CH-04** · The documentation of how to use Data Hub is the Learning Cards it provides itself, in the Learning Centre. The web app links to the right card in context, with the marker on its system text ([FR-LR-33](16-learning.md#fr-lr-33), [FR-LR-37](16-learning.md#fr-lr-37)); no separate guide is written. *Decided on 2026-10-28, by Max ([OP-CH-01](#op-ch-01)), given as the answer to [OP-DH-28](../../overview/open-themes.md#op-dh-28), where it did not fit.*

- <a id="dec-ch-05"></a>**DEC-CH-05** · The HTML report is not a channel of version 1. It comes with Reports and their visualisations ([DEC-LE-08](09-lenses.md#dec-le-08)). *Decided on 2026-10-28, by Max ([OP-CH-03](#op-ch-03)).*

## Channels per asset

| Asset | Data Hub, the web app | Claude, through the MCP | Excel | HTML report |
| --- | --- | --- | --- | --- |
| Resource | Every screen ([DEC-CH-01](#dec-ch-01)) | Version 2 ([DEC-CH-02](#dec-ch-02)) | No ([DEC-CH-03](#dec-ch-03)) | No |
| Query | Query ([FR-SR-41](04-stacks-and-resources.md#fr-sr-41)) | Version 2 | No | No |
| Lens | Its page, a table ([DEC-LE-08](09-lenses.md#dec-le-08)) | Version 2 | Its result as data, default Parameters ([DEC-CH-03](#dec-ch-03)) | Not in v1 ([DEC-CH-05](#dec-ch-05)) |
| Report | When [Reports](10-reports.md) are specified | Version 2 | No | Not in v1 ([DEC-CH-05](#dec-ch-05)) |
| Learning Card | Its page and the floating window ([DEC-LR-08](16-learning.md#dec-lr-08)) | Version 2 | No | No |

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- Lenses and Reports as an MCP App in Claude: [DEC-DH-15](../../overview/data-hub.md#dec-dh-15)
- The steps of a Learning Card as an MCP App in Claude: [DEC-LR-08](16-learning.md#dec-lr-08), [FR-LR-26](16-learning.md#fr-lr-26)
- Excel through Power Query: [DEC-DH-46](../../overview/data-hub.md#dec-dh-46), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)
- Free SQL via Claude: [FR-SR-26](04-stacks-and-resources.md#fr-sr-26), [FR-SR-27](04-stacks-and-resources.md#fr-sr-27)
- Messages in Slack and through the MCP server, from the texts of the [Message catalogue](message-catalogue.md): [FR-CV-15](14-conversations.md#fr-cv-15)
- Open themes: [OP-DH-12](../../overview/open-themes.md#op-dh-12) (channels per asset), [OP-DH-36](../../overview/open-themes.md#op-dh-36) (Excel pilot)

## Requirements

*The requirements below come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md). They are proposals, still to be validated, and therefore Proposed.*

<a id="fr-ch-01"></a>
### FR-CH-01 · No high-volume or frequent exports through Data Hub

**Status:** Proposed · **Source:** [REQ-DH-EXPORT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-export) · **Screens:** [lens](../../design/screens/lens.html)

Large or frequent, structural exports do not run through Data Hub: not through the interface, not through the Excel or ODBC connection and not through Claude. Every export has a row limit.

*Note of 2026-10-29: the Preview of a Resource has no tile for an export ([DEC-UX-120](../../design/principles.md#dec-ux-120)).*

<a id="fr-ch-02"></a>
### FR-CH-02 · A structural export goes to the Data Team

**Status:** Proposed · **Source:** [REQ-DH-EXPORT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-export)

*Note of 2026-10-29: the Preview of a Resource no longer points to this route with a tile; which screen does is open with the Message Centre ([DEC-UX-120](../../design/principles.md#dec-ux-120)).*

Structural exports are for data from Level 2, Described. When business wants to export a Lens, a new concept, structurally, that goes back to the Data Team, which sets up the export from dbt or the Domain Model ([DEC-DH-44](../../overview/data-hub.md#dec-dh-44)). Above the row limit, Data Hub shows a clear message that points to that route.

<a id="fr-ch-03"></a>
### FR-CH-03 · Claude works through the MCP of Data Hub only

**Status:** Proposed · **Source:** [REQ-DH-MCP-SCOPE](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-mcp-scope)

Claude works with data through the MCP of Data Hub, not through an open BigQuery connector. The MCP sees only the Resources, Collections and Lenses the User has access to, with the same Pre-flights, thresholds and Query Log as Data Hub itself.

*Could, not in v1: set on 2026-10-28, by Max; Claude comes in version 2 ([DEC-CH-02](#dec-ch-02)).*

<a id="fr-ch-04"></a>
### FR-CH-04 · Documentation built into the interface and the MCP

**Status:** Proposed · **Source:** [REQ-DH-DOCS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-docs)

The repository of Data Hub holds documentation that explains how everything works: assets, Levels, Collections and notifications. It is part of the interface: the web app and the MCP server refer to it in context, so that you get to know Data Hub by working with it.

*Note of 2026-10-28: the part for Claude comes in version 2 ([DEC-CH-02](#dec-ch-02)).*

*Note of 2026-10-28: that documentation is the Learning Cards ([DEC-CH-04](#dec-ch-04)).*

<a id="fr-ch-05"></a>
### FR-CH-05 · Every feature updates the documentation

**Status:** Proposed · **Source:** [REQ-DH-DOCS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-docs)

Updating that documentation is part of every feature.

## Open points

- [x] <a id="op-ch-01"></a>**OP-CH-01** · Decide where the documentation of [FR-CH-04](#fr-ch-04) lives and how it is served: as part of `docs/`, which describes what Data Hub must do, or as a guide of its own; and how the web app and the MCP server link to the right passage. *Raised while taking in the workshop of 2026-10-22.* *Decided on 2026-10-28, by Max: the Learning Cards in Data Hub are the documentation ([DEC-CH-04](#dec-ch-04)).*
- [x] <a id="op-ch-03"></a>**OP-CH-03** · Decide whether the HTML report is a channel of v1, and for which assets. Proposal: not in v1; it comes with Reports and their visualisations ([DEC-LE-08](09-lenses.md#dec-le-08)). *Raised on 2026-10-28, in the review of Max, which named Data Hub, Claude and Excel.* *Decided on 2026-10-28, by Max: not in v1 ([DEC-CH-05](#dec-ch-05)).*
- [ ] <a id="op-ch-02"></a>**OP-CH-02** · Design a page that tells a User how to connect Claude to Data Hub: the address of the MCP server, the steps in Claude, and what Claude can then do ([FR-CH-03](#fr-ch-03), [FR-CH-04](#fr-ch-04)). Today the address has to be asked for. *Raised on 2026-10-24, while checking the screens against the requirements.* *Could, not in v1: set on 2026-10-28, by Max; Claude comes in version 2 ([DEC-CH-02](#dec-ch-02)).*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
