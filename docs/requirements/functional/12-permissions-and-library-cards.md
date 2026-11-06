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

*Proposed on 2026-11-06, for review with Max ([OP-PL-02](#op-pl-02)); not requirements yet. Changed the same day at the request of Max: what a User sees is a choice of three (`catalogue.see`); describing a Resource is set attribute by attribute (`resources.describe`); Messages are set by kind, and replying and closing by where (`messages.*`); how a result reaches Claude is a permission of its own (`claude.results`); and the groups to start with are Admin, Business analyst and Lens user. Once the list is agreed, each part becomes requirements of this domain.*

A permission group holds every permission below. A permission is yes or no; while it is yes, its values say how far it goes, of the kinds a Parameter has ([DEC-UX-71](../../design/principles.md#dec-ux-71)): a whole number with its unit, a choice, several choices, yes or no, a text ([DEC-UX-186](../../design/principles.md#dec-ux-186)). A permission marked always on has no yes or no, only its values. Where a permission reaches "their Owner Units", or "the assets in their control", the Owner Units of the User, still Workspace groups, say which Collections, and so which Resources and Lenses, are theirs ([DEC-UX-187](../../design/principles.md#dec-ux-187)).

Each permission has a key, the name the services use. The column Today says who can do it now; the next three say what each group to start with gets:

- **Admin,** the Data Admins of today, the members of `datahub-datateam@`: every permission, at its widest, and locked ([DEC-UX-188](../../design/principles.md#dec-ux-188)).
- **Business analyst:** everything a User who is not of the Data Team can do today, so that nothing changes for them.
- **Lens user:** a new group that only uses Lenses: finds and runs them, asks about them, takes their result to Excel, and sees results of Claude in a card only.

### Collections and Resources

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `catalogue.see` | What they see of the catalogue, and so of everything built on it, always on. A Lens shows only to who sees every Resource beneath it ([DEC-CO-16](03-collections.md#dec-co-16)), and a query reads only Resources its maker sees, so this reaches search, Lenses, queries, Claude and Excel alike | What they see (choice): **only theirs**, the Collections of their Owner Units, private and public, with what is in them; **public**, those and every public Collection; **all**, everything, the private Collections of other Owner Units, the Resources without a Collection and those withdrawn included | Public for every User ([DEC-DH-77](../../overview/data-hub.md#dec-dh-77)); all for the Data Team ([DEC-CO-11](03-collections.md#dec-co-11)) | all | public | public |
| `collections.make` | Make a Collection | Its Owner Unit (choice): a group they are in, or any group of the domain | Every User, with a group they are in; the Data Team, any group ([FR-CO-35](03-collections.md#fr-co-35)) | yes, any group | yes, a group they are in | no |
| `collections.manage` | Change a Collection: its details, who sees it, its folders and what they hold; dissolve it | Which (choice): those of their Owner Units, or every Collection | Its Owner Unit and the Data Team | every | their Owner Units | no |
| `resources.assign` | Add Resources to a Collection, move and remove them, and set their grain and model type: the work of a Data Admin | – | Data Team | yes | no | no |
| `resources.describe` | Describe a Resource, attribute by attribute | Which (choice): those of their Owner Units, or every Resource. What (several choices): **description and columns**, the Business Description of the Resource and of its fields, and marking their changes in dbt seen; **Known Behaviour**, its intended use and its Anomalies; **pitfalls**; **available since**, the day since when it is reliable; **Known Gaps**; **key fields and important Parameters**; **Entity mapping**, which Entity of the Domain Model each field refers to | Every attribute but the Entity mapping for the Owner Unit of its Collection and the Data Team; the Entity mapping only the Data Team ([DEC-UX-107](../../design/principles.md#dec-ux-107)) | every, all seven | their Owner Units, all but the Entity mapping | no |
| `resources.publish` | Publish a Resource, its first Confirmation: in their own name, as its Owner, so only a Resource of their Owner Units | – | The Owner Unit of its Collection | yes | yes | no |
| `resources.deprecate` | Deprecate a Resource, and undo it | Which (choice): those of their Owner Units, or every Resource | The Owner Unit of its Collection and the Data Team | every | their Owner Units | no |

### Query

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `resources.preview` | Preview a Resource, on its page and in Claude | – | Every User who sees it | yes | yes | no |
| `queries.make` | Make and run queries, in Query and through Claude | – | Every User | yes | yes | no |
| `runs.ranges` | How much one run of a query or a Preview may read, always on | Runs freely up to (whole number, MB); runs once they approve, up to (whole number, GB); above that (choice): a Request to the Data Team, or it cannot run | 100 MB, 1 GB, a Request, for everyone ([DEC-SR-29](04-stacks-and-resources.md#dec-sr-29)) | 100 MB, 1 GB, a Request | 100 MB, 1 GB, a Request | – |
| `queries.seeOthers` | See the queries of others, with who ran them | Which (choice): those on the Resources of their Owner Units, or every query | The Owner of a Resource sees the queries on it; the Data Team lists every query ([DEC-CL-12](17-claude.md#dec-cl-12)) | every | on their Owner Units | no |
| `requests.decide` | Decide on a Request: accept or refuse a query, a Preview or a Lens that reads more than the ranges allow | – | Data Team | yes | no | no |

### Lenses

Who sees a Lens runs it, with its Parameters, on its page, in Claude and in Excel: that needs no permission.

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `lenses.make` | Make a query a Lens, in a Collection of their Owner Units ([DEC-CO-20](03-collections.md#dec-co-20)), and send a large one to the Data Team | – | Who made the query | yes | yes | no |
| `lenses.manage` | Change, update and delete a Lens | Which (choice): those in the Collections of their Owner Units, or every Lens | The Owner Unit of its Collection and the Data Team ([DEC-LE-21](09-lenses.md#dec-le-21)) | every | their Owner Units | no |

### Messages

A User always replies in, closes and reopens their own Questions and Signals. The assets in their control are the Collections of their Owner Units and the Resources and Lenses in them.

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `messages.write` | Write a Message on what they see | Kinds (several choices): Questions, Remarks, Signals | Every kind, for every User | all three | all three | Questions and Signals |
| `messages.reply` | Reply to the Messages of others | Where (choice): on the assets in their control, or on every asset they see | Every User, on every Message they see | every asset | every asset | no |
| `messages.close` | Close and reopen the Questions and Signals of others | Where (choice): on the assets in their control, or on every asset they see | The Owner Unit of its object and the Data Team | every asset | assets in their control | no |
| `messages.dataTeam` | Get the Messages for the Data Team and answer as the Data Team: Requests, Resources that wait for a Collection, Messages on Learning Cards | – | Data Team | yes | no | no |

### Claude, through the MCP

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `claude.use` | Work with Data Hub in Claude | Writes through Claude (several choices), within what their other permissions allow: Business Descriptions, Messages, deprecations, changes marked seen; a note for Claude (text), which Claude gets with the how-to-use | Every User, and Claude writes what the User may | yes, everything | yes, everything | yes, Messages |
| `claude.results` | How a result reaches Claude, for a query, a Preview and a Lens, always on | Where the result shows (choice): **in Claude**, Claude reads the rows and works on them; **in a card only**, the User sees the rows in the MCP App, and Claude reads the shape without the values, the values of the choices of a Preview included ([OP-DH-49](../../overview/backlog.md#op-dh-49)); **not in Claude**, Claude offers "Open in Data Hub" | In Claude, for every User ([DEC-CL-06](17-claude.md#dec-cl-06)) | in Claude | in Claude | in a card only |

"In a card only" keeps the rows out of the conversation as long as Claude hides the tools that only the MCP App calls, as Claude does; the User can still paste them in, and the rows still pass through Anthropic on their way to the card.

### Excel

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `excel.keys` | Make Excel keys on My page, to fetch the result of a Lens in Excel | Keys at most (whole number; empty for no limit); a key lasts (whole number, days) | Every User, no limit, a year ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) | yes, no limit, 365 days | yes, no limit, 365 days | yes, no limit, 365 days |

### Admin

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `admin.open` | Open Admin, with the tools chosen | Tools (several choices): Webhooks, with the Source Jobs, the deliveries and reprocessing a run; Excel keys, to see and revoke every key; Users, to see every User, change their permission group and end their sessions ([TR-PF-25](../technical/00-platform.md#tr-pf-25)); Permission groups | Data Team | all four | none | none |

### What stays without a permission

Within what `catalogue.see` allows, who sees what still follows from Collections and Owner Units: a private Collection only to its Owner Unit, a public one to whoever sees public Collections. That changes [DEC-DH-77](../../overview/data-hub.md#dec-dh-77), where it follows from Collections and Owner Units alone, once this list becomes requirements. What is a User's own stays theirs, whatever their permission group: who sees a Lens runs it; a query is its maker's own; everyone reads the Learning Cards and Charts; a User revokes their own Excel keys, and replies in and closes their own Questions and Signals. A Data Admin, in the words of the requirements, becomes a User whose permission group has `resources.assign`.

## Open points

- [ ] <a id="op-pl-01"></a>**OP-PL-01** · Work out confidentiality as a concept first, on Confluence, before it becomes requirements here. The starting points of the workshop ([REQ-DH-CONF](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-conf)): next to its maturity, every Resource gets a level of confidentiality, set in dbt (`meta`), only ever lowered downstream, and taken at its highest by a Lens or a Report, with a matrix of levels against who may do what. Settle as well how it relates to the access classification on the Resource Card ([The Resource Card](../../overview/data-hub.md#the-resource-card)) and to the access axis of [OP-DH-22](../../overview/open-themes.md#op-dh-22). *Decided on 2026-10-22: a concept to work out first, not yet requirements.* *Could, not in v1: set on 2026-10-28, by Max; confidentiality is out of the scope of version 1.*
- [ ] <a id="op-pl-02"></a>**OP-PL-02** · List the permissions of Data Hub, each with what it allows, its values and their kinds, and the permission groups to start with, as requirements of this domain, once the design of [Users and Permission groups](../../design/principles.md#admin) is final ([OP-UX-55](../../design/principles.md#op-ux-55) to [OP-UX-61](../../design/principles.md#op-ux-61)). With them: how every service applies the permissions of a User from the moment they sign in, in the web app, in Claude and in Excel, in the place of the roles of today ([FR-UM-11](02-user-management.md#fr-um-11), [DEC-DH-78](../../overview/data-hub.md#dec-dh-78)). *Raised on 2026-11-06, by Max: design first, then the permissions in the requirements, then the build.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
