# Functional domains

| | |
| --- | --- |
| Type | Navigation |
| Tags | navigation, context |
| Area | Tooling, Technical |
| Status | Under construction |
| Source of truth | The file of each functional domain; overarching decisions are in the [Data Hub overview](../../overview/data-hub.md) |
| Migrated from | [ptditt - Tooling - Data Hub - Functionele domeinen](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371078664) (Confluence, Dutch), last modified 2026-10-15, migrated 2026-10-17 |

**In one sentence:** this page divides Data Hub into functional domains; each domain gets its own file, with what it does, according to which rules, and what is still open.

*Overarching decisions are in the [Data Hub overview](../../overview/data-hub.md); decisions that touch only one domain are in the domain file itself. The domain files translate everything into functional rules that can be built and tested. They grow domain by domain; the division is a proposal, and adjusting it is allowed. The Confluence pages are in Dutch; here, as in the app itself, everything is in English.*

## Overview

| # | Domain | Code | What it is about | Status |
| --- | --- | --- | --- | --- |
| 1 | [Artifact registry](01-artifact-registry.md) | `AR` | Fetching the dbt artifacts, storing them, processing them into searchable tables, and detecting and propagating changes | Specified |
| 2 | [User management](02-user-management.md) | `UM` | Who uses Data Hub: logging in with Google, groups and owner units from Google Workspace, and how people join and leave | Specified |
| 3 | [Collections](03-collections.md) | `CO` | The functional domains of Immoscoop in which resources sit together, each with one owner unit, managed by the data team | Specified |
| 4 | [Stacks and resources](04-stacks-and-resources.md) | `SR` | Registering a resource in Data Hub: key, display name, collection, initial level, fingerprint, and a log with fixed log IDs | Specified |
| 5 | [Resource card](05-resource-card.md) | `RC` | What Data Hub derives about a resource and keeps itself, with known behaviour and anomalies | To be described |
| 6 | [Maturity and release](06-maturity-and-release.md) | `MR` | Deriving levels, confirming by publishing, visibility in two steps | Specified ¹ |
| 7 | [Log and notifications](07-log-and-notifications.md) | `LN` | The log catalogue across all domains, the message centre, who gets which notification when, and through which channel | To be described |
| 8 | [Checks and monitoring](08-checks-and-monitoring.md) | `CM` | Automatic checks after a change, derived from the EDA, and the monitors of an owner | To be described |
| 9 | [Lenses](09-lenses.md) | `LE` | Lens types, parameters and their level | To be described |
| 10 | [Reports](10-reports.md) | `RP` | Bundling lenses around a question, with text and shared parameters | To be described |
| 11 | [Beta and promotion](11-beta-and-promotion.md) | `BP` | Concepts that business defines itself, and how they are hardened into a resource | To be described |
| 12 | [Permissions and library cards](12-permissions-and-library-cards.md) | `PL` | Roles, access and personal keys | To be described |
| 13 | [Channels](13-channels.md) | `CH` | Data Hub itself, Claude as an MCP App, Excel and HTML reports | To be described |
| 14 | [Conversations](14-conversations.md) | `CV` | Questions, remarks and margin notes on an object | To be described |
| 15 | [EDA](15-eda.md) | `ED` | How an exploration runs and is linked to a resource | To be described ² |

¹ The Confluence overview still listed this domain as "to be described", but its page already holds six decisions and ten rules.
² Not in the Confluence overview; proposed in [OP-MR-01](06-maturity-and-release.md#op-mr-01).

The number of requirements per domain and status is in the [traceability matrix](../traceability.md).

Shared across domains: the [log catalogue](log-catalogue.md).

## Every domain file follows the same structure

Goal, terms, flow, functional requirements with their own numbering per domain (such as `FR-AR-01` for the Artifact registry), edge cases, what falls outside the domain, open points as tasks, and "Builds on". Decisions that touch only the domain are at the top. The ID scheme and the format are in the [requirements conventions](../README.md); a new domain starts from the [functional domain template](../_templates/functional-domain.md).

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
