# Permissions and Excel keys

| | |
| --- | --- |
| Domain | 12 of Data Hub · code `PL` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Rechten en lezerskaarten) |

**Scope:** roles, access and personal keys.

*Functional domain 12 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- [Permissions and user/group management](../../overview/open-themes.md#2-permissions-and-usergroup-management): [OP-DH-22](../../overview/open-themes.md#op-dh-22) to [OP-DH-25](../../overview/open-themes.md#op-dh-25)
- The Excel key for Excel: [DEC-DH-46](../../overview/data-hub.md#dec-dh-46), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)
- All channels from one Google identity: [DEC-UM-02](02-user-management.md#dec-um-02)
- Role Groups: the [Naming Convention](02-user-management.md#naming-convention) in User management

## Requirements

<a id="fr-pl-01"></a>
### FR-PL-01 · A User makes an Excel key on My page, and sees it once

**Status:** Implemented · **Source:** Max, 2026-10-28 ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) · [design](../../design/principles.md#my-page) · **Screens:** [my-page](../../design/screens/my-page.html)

On My page, a User makes an Excel key and gives it a name that says where it is used, such as "Excel on my laptop". Data Hub shows the key once, to copy, with how to use it in Power Query. identity keeps only its hash ([TR-PF-07](../technical/00-platform.md#tr-pf-07)): nobody can show it again.

*Note of 2026-10-31: built as [TR-PL-01](../technical/12-permissions-and-library-cards.md#tr-pl-01); the page of a Lens has "Open in Excel" with its address ([DEC-UX-159](../../design/principles.md#dec-ux-159)).*

<a id="fr-pl-02"></a>
### FR-PL-02 · My page lists the Excel keys of its User, and revokes one

**Status:** Implemented · **Source:** Max, 2026-10-28 ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) · [design](../../design/principles.md#my-page) · **Screens:** [my-page](../../design/screens/my-page.html)

My page lists every Excel key of its User: its name, when it was made, when it was last used and when it expires. Revoking one stops it at once, after a confirmation; the list keeps it, marked revoked. Renewing a key is revoking it and making a new one.

<a id="fr-pl-03"></a>
### FR-PL-03 · An Excel key lasts a year, and stops with its User

**Status:** Implemented · **Source:** Max, 2026-10-28 ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) · **Screens:** [admin-keys](../../design/screens/admin-keys.html), [my-page](../../design/screens/my-page.html)

An Excel key expires a year after it was made; a month before, its User gets a notification. It stops at once when its User can no longer sign in with Google, for example after leaving. The Data Team can revoke any key, and its User gets a notification of that.

*Note of 2026-10-31: built as [TR-PL-01](../technical/12-permissions-and-library-cards.md#tr-pl-01) and [TR-PL-02](../technical/12-permissions-and-library-cards.md#tr-pl-02), the notifications as [MSG-KEY-01](message-catalogue.md#msg-key-01) and [MSG-KEY-02](message-catalogue.md#msg-key-02). The Data Team revokes a key on the page Excel keys in Admin ([admin-keys](../../design/screens/admin-keys.html)).*

## The permissions, proposed

*Proposed on 2026-11-06, for review with Max ([OP-PL-02](#op-pl-02)); not requirements yet. Once the list is agreed, each part becomes requirements of this domain, and the permission groups to start with are decided.*

A permission group holds every permission below. A permission is yes or no; while it is yes, its values say how far it goes, of the kinds a Parameter has ([DEC-UX-71](../../design/principles.md#dec-ux-71)): a whole number with its unit, a choice, several choices, yes or no, a text ([DEC-UX-186](../../design/principles.md#dec-ux-186)). Where a permission reaches "those of their Owner Units", the Owner Units of the User, still Workspace groups, say which ([DEC-UX-187](../../design/principles.md#dec-ux-187)). The Data Team has every permission, at its widest ([DEC-UX-188](../../design/principles.md#dec-ux-188)).

Each permission has a key, the name the services use; the columns Today and Default say what every User who is not of the Data Team can do now, so that the default permission group, at the start, changes nothing for anyone.

### Collections and Resources

| Key | Permission: what it allows | Values | Today | Data Team | Default |
| --- | --- | --- | --- | --- | --- |
| `catalogue.seeAll` | See everything: every Collection, the private ones of other Owner Units included, the Resources without a Collection, and those withdrawn | – | Data Team ([DEC-CO-11](03-collections.md#dec-co-11)) | yes | no |
| `collections.make` | Make a Collection | Its Owner Unit (choice): a group they are in, or any group of the domain | Every User, with a group they are in; the Data Team, any group ([FR-CO-35](03-collections.md#fr-co-35)) | yes, any group | yes, a group they are in |
| `collections.manage` | Change a Collection: its details, who sees it, its folders and what they hold; dissolve it | Which (choice): those of their Owner Units, or every Collection | Its Owner Unit and the Data Team | every | their Owner Units |
| `resources.assign` | Add Resources to a Collection, move and remove them, and set their grain and relations: the work of a Data Admin | – | Data Team | yes | no |
| `resources.describe` | Describe a Resource: the Business Descriptions of it and its fields, its intended use and pitfalls, its Known Gaps and Q&A; mark its changes seen | Which (choice): those of their Owner Units, or every Resource | The Owner Unit of its Collection and the Data Team | every | their Owner Units |
| `resources.publish` | Publish a Resource, its first Confirmation, always as its Owner: only those of their Owner Units | – | The Owner Unit of its Collection | yes | yes |
| `resources.deprecate` | Deprecate a Resource, and undo it | Which (choice): those of their Owner Units, or every Resource | The Owner Unit of its Collection and the Data Team | every | their Owner Units |

### Query

| Key | Permission: what it allows | Values | Today | Data Team | Default |
| --- | --- | --- | --- | --- | --- |
| `resources.preview` | Preview a Resource, on its page and in Claude | – | Every User who sees it | yes | yes |
| `queries.make` | Make and run queries, in Query and through Claude | – | Every User | yes | yes |
| `runs.ranges` | How much one run of a query or a Preview may read: always on, only its values change | Runs freely up to (whole number, MB); runs once they approve, up to (whole number, GB); above that (choice): a Request to the Data Team, or it cannot run | 100 MB, 1 GB, a Request, for everyone ([DEC-SR-29](04-stacks-and-resources.md#dec-sr-29)) | 100 MB, 1 GB, a Request | 100 MB, 1 GB, a Request |
| `queries.seeOthers` | See the queries of others, with who ran them | Which (choice): those on the Resources of their Owner Units, or every query | The Owner of a Resource sees the queries on it; the Data Team lists every query ([DEC-CL-12](17-claude.md#dec-cl-12)) | every | on their Owner Units |
| `requests.decide` | Decide on a Request: accept or refuse a query, a Preview or a Lens that reads more than the ranges allow | – | Data Team | yes | no |

### Lenses

| Key | Permission: what it allows | Values | Today | Data Team | Default |
| --- | --- | --- | --- | --- | --- |
| `lenses.make` | Make a query a Lens, in a Collection of their Owner Units ([DEC-CO-20](03-collections.md#dec-co-20)), and send a large one to the Data Team | – | Who made the query | yes | yes |
| `lenses.manage` | Change, update and delete a Lens | Which (choice): those in the Collections of their Owner Units, or every Lens | The Owner Unit of its Collection and the Data Team ([DEC-LE-21](09-lenses.md#dec-le-21)) | every | their Owner Units |

### Messages

| Key | Permission: what it allows | Values | Today | Data Team | Default |
| --- | --- | --- | --- | --- | --- |
| `messages.write` | Write a Question, a Remark or a Signal, and reply | – | Every User | yes | yes |
| `messages.dataTeam` | Get the Messages for the Data Team and answer as the Data Team: Requests, Resources that wait for a Collection, Messages on Learning Cards; close and reopen any Question or Signal | – | Data Team | yes | no |

### Claude, through the MCP

| Key | Permission: what it allows | Values | Today | Data Team | Default |
| --- | --- | --- | --- | --- | --- |
| `claude.use` | Work with Data Hub in Claude | What Claude reads of a result or a Preview (choice): the rows, the shape without the values, or nothing ([OP-DH-49](../../overview/backlog.md#op-dh-49)); writes through Claude (several choices): Business Descriptions, Messages, deprecations, changes marked seen; a note for Claude (text) | Every User; Claude reads the rows ([DEC-CL-06](17-claude.md#dec-cl-06)) and writes what the User may | yes, the rows, everything | yes, the rows, everything, no note |

### Excel

| Key | Permission: what it allows | Values | Today | Data Team | Default |
| --- | --- | --- | --- | --- | --- |
| `excel.keys` | Make Excel keys on My page, to fetch the result of a Lens in Excel | Keys at most (whole number; empty for no limit); a key lasts (whole number, days) | Every User, no limit, a year ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) | yes, no limit, 365 days | yes, no limit, 365 days |

### Admin

| Key | Permission: what it allows | Values | Today | Data Team | Default |
| --- | --- | --- | --- | --- | --- |
| `admin.open` | Open Admin, with the tools chosen | Tools (several choices): Webhooks, with the Source Jobs, the deliveries and reprocessing a run; Excel keys, to see and revoke every key; Users, to see every User, change their permission group and end their sessions ([TR-PF-25](../technical/00-platform.md#tr-pf-25)); Permission groups | Data Team | all four | none |

### What stays without a permission

Who sees what stays with Collections and Owner Units ([DEC-DH-77](../../overview/data-hub.md#dec-dh-77)), and what is a User's own stays theirs, whatever their permission group: who sees a Lens runs it; a query is its maker's own; everyone reads the Learning Cards and Charts; a User revokes their own Excel keys and closes their own Question. A Data Admin, in the words of the requirements, becomes a User whose permission group has `resources.assign`.

## Open points

- [ ] <a id="op-pl-01"></a>**OP-PL-01** · Work out confidentiality as a concept first, on Confluence, before it becomes requirements here. The starting points of the workshop ([REQ-DH-CONF](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-conf)): next to its maturity, every Resource gets a level of confidentiality, set in dbt (`meta`), only ever lowered downstream, and taken at its highest by a Lens or a Report, with a matrix of levels against who may do what. Settle as well how it relates to the access classification on the Resource Card ([The Resource Card](../../overview/data-hub.md#the-resource-card)) and to the access axis of [OP-DH-22](../../overview/open-themes.md#op-dh-22). *Decided on 2026-10-22: a concept to work out first, not yet requirements.* *Could, not in v1: set on 2026-10-28, by Max; confidentiality is out of the scope of version 1.*
- [ ] <a id="op-pl-02"></a>**OP-PL-02** · List the permissions of Data Hub, each with what it allows, its values and their kinds, and the permission groups to start with, as requirements of this domain, once the design of [Users and Permission groups](../../design/principles.md#admin) is final ([OP-UX-55](../../design/principles.md#op-ux-55) to [OP-UX-61](../../design/principles.md#op-ux-61)). With them: how every service applies the permissions of a User from the moment they sign in, in the web app, in Claude and in Excel, in the place of the roles of today ([FR-UM-11](02-user-management.md#fr-um-11), [DEC-DH-78](../../overview/data-hub.md#dec-dh-78)). *Raised on 2026-11-06, by Max: design first, then the permissions in the requirements, then the build.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
