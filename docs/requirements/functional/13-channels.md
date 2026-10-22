# Channels

| | |
| --- | --- |
| Domain | 13 of Data Hub · code `CH` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Kanalen) |

**Scope:** Data Hub itself, Claude as an MCP App, Excel and HTML reports.

*Functional domain 13 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- Lenses and Reports as an MCP App in Claude: [DEC-DH-15](../../overview/data-hub.md#dec-dh-15)
- Excel through Power Query: [DEC-DH-46](../../overview/data-hub.md#dec-dh-46), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)
- Free SQL via Claude: [FR-SR-26](04-stacks-and-resources.md#fr-sr-26), [FR-SR-27](04-stacks-and-resources.md#fr-sr-27)
- Open themes: [OP-DH-12](../../overview/open-themes.md#op-dh-12) (channels per asset), [OP-DH-36](../../overview/open-themes.md#op-dh-36) (Excel pilot)

## Requirements

*The requirements below come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md). They are proposals, still to be validated, and therefore Proposed.*

<a id="fr-ch-01"></a>
### FR-CH-01 · No high-volume or frequent exports through Data Hub

**Status:** Proposed · **Source:** [REQ-DH-EXPORT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-export)

Large or frequent, structural exports do not run through Data Hub: not through the interface, not through the Excel or ODBC connection and not through Claude. Every export has a row limit.

<a id="fr-ch-02"></a>
### FR-CH-02 · A structural export goes to the Data Team

**Status:** Proposed · **Source:** [REQ-DH-EXPORT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-export)

Structural exports are for data from Level 2, Described. When business wants to export a Lens, a new concept, structurally, that goes back to the Data Team, which sets up the export from dbt or the Domain Model ([DEC-DH-44](../../overview/data-hub.md#dec-dh-44)). Above the row limit, Data Hub shows a clear message that points to that route.

<a id="fr-ch-03"></a>
### FR-CH-03 · Claude works through the MCP of Data Hub only

**Status:** Proposed · **Source:** [REQ-DH-MCP-SCOPE](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-mcp-scope)

Claude works with data through the MCP of Data Hub, not through an open BigQuery connector. The MCP sees only the Resources, Collections and Lenses the User has access to, with the same Pre-flights, thresholds and Query Log as Data Hub itself.

<a id="fr-ch-04"></a>
### FR-CH-04 · Documentation built into the interface and the MCP

**Status:** Proposed · **Source:** [REQ-DH-DOCS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-docs)

The repository of Data Hub holds documentation that explains how everything works: assets, Levels, Collections and notifications. It is part of the interface: the web app and the MCP server refer to it in context, so that you get to know Data Hub by working with it.

<a id="fr-ch-05"></a>
### FR-CH-05 · Every feature updates the documentation

**Status:** Proposed · **Source:** [REQ-DH-DOCS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-docs)

Updating that documentation is part of every feature.

## Open points

- [ ] <a id="op-ch-01"></a>**OP-CH-01** · Decide where the documentation of [FR-CH-04](#fr-ch-04) lives and how it is served: as part of `docs/`, which describes what Data Hub must do, or as a guide of its own; and how the web app and the MCP server link to the right passage. *Raised while taking in the workshop of 2026-10-22.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
