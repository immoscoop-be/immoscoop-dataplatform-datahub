# Technical requirements

How Data Hub is built. Every technical requirement realises one or more [functional requirements](../functional/README.md), so the question "how is this rule built?" always has an answer that can be traced both ways.

| | |
| --- | --- |
| Status | [Platform](00-platform.md) specified; [Artifact registry](01-artifact-registry.md), [Collections](03-collections.md), [Resources](04-stacks-and-resources.md), [Log and notifications](07-log-and-notifications.md), [Lenses](09-lenses.md) and [Conversations](14-conversations.md) under way; the other domains follow |
| Source of truth | This folder |

## Structure

- One file per functional domain, with the same number and name as its functional counterpart, for example `technical/01-artifact-registry.md`.
- Technical requirements reuse the code of the domain: `TR-AR-01`, `TR-AR-02` and so on.
- Every technical requirement has a `**Realises:**` line linking the functional requirements it realises. The [traceability matrix](../traceability.md) turns those links around, so that each functional requirement shows which technical requirements realise it.
- Technical choices that are not tied to one domain, such as the runtime or the database, go in `technical/00-platform.md` with code `PF`.

Start a new file from the [technical requirements template](../_templates/technical-domain.md). The ID scheme, statuses and commit conventions are in the [requirements conventions](../README.md).

## Starting points

The architecture that follows from the [platform decisions](00-platform.md) is described in [`docs/architecture/`](../../architecture/README.md), with one page per service.

Many technical decisions were already taken on Confluence. They are in the [Data Hub overview](../../overview/data-hub.md) and are the natural starting point for the technical requirements of each domain:

| Topic | Decisions |
| --- | --- |
| Fetching and processing the dbt Artifacts | [DEC-DH-19](../../overview/data-hub.md#dec-dh-19) to [DEC-DH-25](../../overview/data-hub.md#dec-dh-25) |
| How the Level is determined | [DEC-DH-31](../../overview/data-hub.md#dec-dh-31) to [DEC-DH-37](../../overview/data-hub.md#dec-dh-37) |
| Infrastructure: GCP, Cloud Run, Node.js with TypeScript | [DEC-DH-48](../../overview/data-hub.md#dec-dh-48) to [DEC-DH-54](../../overview/data-hub.md#dec-dh-54) |
| Storage: Postgres on Cloud SQL, migrations | [DEC-DH-55](../../overview/data-hub.md#dec-dh-55) to [DEC-DH-59](../../overview/data-hub.md#dec-dh-59) |
| Authentication and Groups | [DEC-UM-01](../functional/02-user-management.md#dec-um-01) to [DEC-UM-05](../functional/02-user-management.md#dec-um-05) |
| Search in Postgres | [DEC-SR-10](../functional/04-stacks-and-resources.md#dec-sr-10) and the [search table](../functional/04-stacks-and-resources.md#search) |
| Log with fixed Log IDs | [DEC-SR-09](../functional/04-stacks-and-resources.md#dec-sr-09) and the [Log catalogue](../functional/log-catalogue.md) |
