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
| 1 | [Artifact registry](01-artifact-registry.md) | `AR` | Fetching the dbt Artifacts, storing them, processing them into searchable tables, and detecting and propagating Changes | Specified |
| 2 | [User management](02-user-management.md) | `UM` | Who uses Data Hub: logging in with Google, Groups and Owner Units from Google Workspace, and how people join and leave | Specified |
| 3 | [Collections](03-collections.md) | `CO` | The functional domains of Immoscoop in which Resources sit together, each with one Owner Unit, managed by the Data Team | Specified |
| 4 | [Resources](04-stacks-and-resources.md) | `SR` | Registering a Resource in Data Hub: Key, Display Name, Collection, initial Level, Fingerprint, and a Log with fixed Log IDs | Specified |
| 5 | [Resource card](05-resource-card.md) | `RC` | What Data Hub derives about a Resource and keeps itself, with Known Behaviour and Anomalies | To be specified |
| 6 | [Maturity and release](06-maturity-and-release.md) | `MR` | Deriving Levels, confirming by publishing, visibility in two steps | Specified ¹ |
| 7 | [Log and notifications](07-log-and-notifications.md) | `LN` | The Log Catalogue across all domains, the Message Centre, who gets which notification when, and through which channel | To be specified |
| 8 | [Checks and monitoring](08-checks-and-monitoring.md) | `CM` | Automatic checks after a Change, derived from the EDA, and the monitors of an Owner | To be specified |
| 9 | [Lenses](09-lenses.md) | `LE` | Lens types, Parameters and their Level | To be specified |
| 10 | [Reports](10-reports.md) | `RP` | Bundling Lenses around a question, with text and shared Parameters | To be specified |
| 11 | [Beta and promotion](11-beta-and-promotion.md) | `BP` | Concepts that business defines itself, and how they are hardened into a Resource | To be specified |
| 12 | [Permissions and library cards](12-permissions-and-library-cards.md) | `PL` | Roles, access and personal keys | To be specified |
| 13 | [Channels](13-channels.md) | `CH` | Data Hub itself, Claude as an MCP App, Excel and HTML reports | To be specified |
| 14 | [Conversations](14-conversations.md) | `CV` | Questions, Remarks and margin notes on an object | To be specified |
| 15 | [EDA](15-eda.md) | `ED` | How an exploration runs and is linked to a Resource | To be specified ² |
| 16 | [Learning](16-learning.md) | `LR` | The Learning Centre: a page for every Learning Card of the master learning plan, by Learning Level and section, in five steps; links to cards anywhere; a silent count of the cards seen | To be specified ³ |

¹ The Confluence overview still listed this domain as "to be described", but its page already holds six decisions and ten rules.
² Not in the Confluence overview; proposed in [OP-MR-01](06-maturity-and-release.md#op-mr-01).
³ Not in the Confluence overview; asked for by Max on 2026-10-24 ([DEC-LR-01](16-learning.md#dec-lr-01)).

The number of requirements per domain and status is in the [traceability matrix](../traceability.md).

Shared across domains: the [Log catalogue](log-catalogue.md) and the [Message catalogue](message-catalogue.md), generated from the source code.

## Every domain file follows the same structure

Goal, terms, flow, functional requirements with their own numbering per domain (such as `FR-AR-01` for the Artifact registry, `FR-UM-01` for User management, `FR-CO-01` for Collections and `FR-SR-01` for Resources), edge cases, what falls outside the domain, open points as tasks, and "Builds on". Decisions that touch only the domain are at the top (on Confluence, as a decision macro).

Domain status is either Specified (Confluence: "Beschreven") or To be specified (Confluence: "Nog te beschrijven"). The word Described is avoided here because it is a maturity level of a Resource. The ID scheme and the format are in the [requirements conventions](../README.md); a new domain starts from the [functional domain template](../_templates/functional-domain.md).

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
