# Permissions and Excel keys

| | |
| --- | --- |
| Domain | 12 of Data Hub · code `PL` |
| Status | Excel keys and Permission groups implemented; My page showing a User their own Permission group is still to draw ([FR-PL-13](#fr-pl-13)) |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Rechten en lezerskaarten) |

**Scope:** what each User may do, through their Permission group, and the personal keys for Excel.

*Functional domain 12 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- [Permissions and user/group management](../../overview/open-themes.md#2-permissions-and-usergroup-management): [OP-DH-22](../../overview/open-themes.md#op-dh-22) to [OP-DH-25](../../overview/open-themes.md#op-dh-25)
- The Excel key for Excel: [DEC-DH-46](../../overview/data-hub.md#dec-dh-46), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)
- All channels from one Google identity: [DEC-UM-02](02-user-management.md#dec-um-02)
- Role Groups: the [Naming Convention](02-user-management.md#naming-convention) in User management

## Decisions

- <a id="dec-pl-01"></a>**DEC-PL-01** · What a User may do comes from their Permission group, given to them in Data Hub; which Collections, and so which Resources and Lenses, are theirs still comes from their Owner Units in Workspace ([DEC-UX-186](../../design/principles.md#dec-ux-186), [DEC-UX-187](../../design/principles.md#dec-ux-187)). The Permissions of Data Hub are those under [The Permissions](#the-permissions). *Decided on 2026-11-06, by Max: "We're moving away from the fact that these are derived from the groups. They should simply be assigned to a user."*
- <a id="dec-pl-02"></a>**DEC-PL-02** · What a User sees is a choice of three: only theirs, public, or all (`catalogue.see`). *Decided on 2026-11-06, by Max: "I need 'see only mine', 'see public', 'see all'".*
- <a id="dec-pl-03"></a>**DEC-PL-03** · Describing a Resource is set attribute by attribute: description and columns, Known Behaviour, pitfalls, available since, Known Gaps, key fields and important Parameters, and Entity mapping; one choice says on which Resources, for all of them (`resources.describe`). *Decided on 2026-11-06, by Max: "each of the different attributes should be manageable"; one choice of Resources "is enough".*
- <a id="dec-pl-04"></a>**DEC-PL-04** · Messages are set by kind: which of Questions, Remarks and Signals a User writes; and whether they reply to the Messages of others, and close and reopen their Questions and Signals, on the assets in their control or on every asset. A User always handles their own Questions and Signals. *Decided on 2026-11-06, by Max.*
- <a id="dec-pl-05"></a>**DEC-PL-05** · How the result of a query, a Preview or a Lens reaches Claude is a Permission of its own: in Claude, in a card only, or not in Claude (`claude.results`). In a card only, the User sees the rows in the MCP App, and Claude reads the shape of the result without its values, the values of the choices of a Preview included. [DEC-CL-06](17-claude.md#dec-cl-06) holds for those whose Permission group says in Claude. *Decided on 2026-11-06, by Max: "for claude, very important … I want certain users to only view results in a card".*
- <a id="dec-pl-06"></a>**DEC-PL-06** · Publishing stays the act of the Owner: a User publishes only a Resource of their Owner Units, in their own name, also in the Permission group Admin. *Decided on 2026-11-06, by Max: "owner only".*
- <a id="dec-pl-07"></a>**DEC-PL-07** · Three Permission groups to start with. **Admin:** the Data Admins of today, every Permission at its widest, locked. **Business analyst:** what every other User can do today. **Lens user:** only Lenses: they find and run them, write Questions and Signals but no Remarks, reply to no Messages of others, take a result to Excel, and see a result of Claude in a card only. Lens user is the default for new Users; at the start, the members of `datahub-datateam@` get Admin and every other User Business analyst, so that nothing changes for anyone. *Decided on 2026-11-06, by Max: "admin (data-admin today), business-analist (what is currently available …) and a new user role with only lens usage"; on the default, "ok"; on the Lens user, "correct".*

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

<a id="fr-pl-04"></a>
### FR-PL-04 · A User is in one Permission group, and a new User gets the default

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-186](../../design/principles.md#dec-ux-186), [DEC-UX-190](../../design/principles.md#dec-ux-190)) · [design](../../design/principles.md#admin) · **Screens:** [admin-users](../../design/screens/admin-users.html)

Every User is in one Permission group. One Permission group is the default: a User who signs in for the first time gets it. A User keeps their Permission group while they cannot sign in, and has it again when they sign in again.

<a id="fr-pl-05"></a>
### FR-PL-05 · A Permission group holds every Permission, each with its values

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-PL-01](#dec-pl-01), [DEC-UX-186](../../design/principles.md#dec-ux-186)) · [design](../../design/principles.md#admin) · **Screens:** [admin-permission-groups](../../design/screens/admin-permission-groups.html)

A Permission group has a name, a sentence that says what it allows, and a value for every Permission under [The Permissions](#the-permissions). A Permission is yes or no, or always on; while it is yes, its values say how far it goes, each of a kind a Parameter has: a whole number with its unit, a choice, several choices, yes or no, or a text. Where a Permission reaches "their Owner Units" or "the assets in their control", the Owner Units of the User say which. The same Permissions hold in the web app, in Claude and in Excel.

<a id="fr-pl-06"></a>
### FR-PL-06 · Users lists every User, with their Permission group

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-190](../../design/principles.md#dec-ux-190)) · [design](../../design/principles.md#admin) · **Screens:** [admin-users](../../design/screens/admin-users.html)

With `admin.open` for Users, Admin has Users: everyone who signed in to the environment, with their Permission group, their Owner Units, what they use (the web app, Claude, Excel) and when they last signed in. A search finds a User by name or address; a filter shows one Permission group, each with its count. A User who can no longer sign in stays listed, greyed, with their Permission group.

<a id="fr-pl-07"></a>
### FR-PL-07 · The Permission group of a User is changed after seeing what it changes

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-186](../../design/principles.md#dec-ux-186), [DEC-UX-189](../../design/principles.md#dec-ux-189)) · [design](../../design/principles.md#admin) · **Screens:** [admin-users](../../design/screens/admin-users.html)

A User opened on Users shows in a sheet who they are, since when, what they use, their Owner Units read-only as they come from Workspace, their Permission group as a choice of every group, and the history of their Permission group: who changed it, from what to what, and when. Choosing another group shows, before it is saved, what the User gains and loses, and that their Owner Units stay.

<a id="fr-pl-08"></a>
### FR-PL-08 · Nobody locks Data Hub out

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-188](../../design/principles.md#dec-ux-188), [DEC-PL-07](#dec-pl-07)) · [design](../../design/principles.md#admin) · **Screens:** [admin-users](../../design/screens/admin-users.html), [admin-permission-groups](../../design/screens/admin-permission-groups.html)

Nobody changes their own Permission group. The Permission group Admin has every Permission at its widest; its Permissions cannot be changed, it cannot be deleted, and it keeps at least one User: the last User of Admin cannot be moved to another group.

<a id="fr-pl-09"></a>
### FR-PL-09 · Permission groups shows each group with its Permissions, and changes them all at once

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-PL-01](#dec-pl-01), [DEC-UX-186](../../design/principles.md#dec-ux-186)) · [design](../../design/principles.md#admin) · **Screens:** [admin-permission-groups](../../design/screens/admin-permission-groups.html)

With `admin.open` for Permission groups, Admin has Permission groups: every group with its sentence, its number of Users and which is the default. One opened shows its Permissions by part of Data Hub, in the order of the rail, each with its values while it is yes; Admin shows its own locked. A change is marked until it is saved; an edit bar counts the changes, says for how many Users they take effect, and saves or discards them all at once.

<a id="fr-pl-10"></a>
### FR-PL-10 · A Permission group is made, renamed, made the default and deleted

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-186](../../design/principles.md#dec-ux-186), [DEC-UX-190](../../design/principles.md#dec-ux-190)) · [design](../../design/principles.md#admin) · **Screens:** [admin-permission-groups](../../design/screens/admin-permission-groups.html)

A new Permission group starts as a copy of another, or with every Permission no, and without Users; "Duplicate" copies one. Its name and sentence change in place. One Permission group is the default at a time: making another the default takes it from the first. Deleting a Permission group asks which group its Users go to, Admin excepted; when it was the default, that group becomes the default.

<a id="fr-pl-11"></a>
### FR-PL-11 · A change takes effect within 15 minutes, everywhere

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-189](../../design/principles.md#dec-ux-189)) · [design](../../design/principles.md#admin) · **Screens:** [admin-users](../../design/screens/admin-users.html), [admin-permission-groups](../../design/screens/admin-permission-groups.html)

Another Permission group for a User, or a change of the Permissions of a group, takes effect for each User concerned when their Access Token is renewed, within 15 minutes, in the web app, in Claude and in Excel. The sheet of a User and the edit bar of a group say so.

<a id="fr-pl-12"></a>
### FR-PL-12 · A User is told when their Permission group changes for them

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-192](../../design/principles.md#dec-ux-192)) · [design](../../design/principles.md#admin)

A User gets a Message when the Data Team moves them to another Permission group, and when their Permission group is deleted, with what changed for them. A change of the Permissions of their whole group sends none: the Data Team announces it itself.

<a id="fr-pl-13"></a>
### FR-PL-13 · My page shows a User their own Permission group

**Status:** Proposed · **Source:** Max, 2026-11-06 ([DEC-UX-191](../../design/principles.md#dec-ux-191)) · [design](../../design/principles.md#admin)

My page shows a User the name of their Permission group and what it allows, read-only, so that they know why something is not there for them. *Its place on My page is still to be drawn.*

<a id="fr-pl-14"></a>
### FR-PL-14 · Every channel applies the Permissions of the User from their sign-in

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-PL-01](#dec-pl-01)) · [design](../../design/principles.md#admin)

From the moment a User signs in, every service knows their Permissions. Every service refuses what the User may not do, whatever the channel: the web app, Claude or Excel. The web app shows a section of the rail, a page or an action only when the User may use it, from what the services say, never from a role: Query, for example, only to a User who may make queries or Preview a Resource, and Admin only to a User with `admin.open`. No service decides by a role any more.

<a id="fr-pl-15"></a>
### FR-PL-15 · Permission groups replace the Role Groups

**Status:** Implemented · **Source:** Max, 2026-11-06 ([DEC-UX-187](../../design/principles.md#dec-ux-187), [DEC-PL-07](#dec-pl-07)) · [design](../../design/principles.md#admin)

At the start, Data Hub makes the three Permission groups of [DEC-PL-07](#dec-pl-07): the members of `datahub-datateam@` get Admin, every other User Business analyst, and Lens user is the default for new Users. From then on no Group gives a role: a Role Group gives nothing, and what was done for the Data Team is done for the Users whose Permission group allows it, such as the Messages for the Data Team (`messages.dataTeam`) and the decisions on Requests (`requests.decide`).

<a id="the-permissions"></a>
## The Permissions

*Proposed on 2026-11-06 and reviewed with Max the same day ([OP-PL-02](#op-pl-02)); agreed as [DEC-PL-01](#dec-pl-01) to [DEC-PL-07](#dec-pl-07). The requirements above say how Permission groups hold them; this list says what each Permission allows.*

A Permission group holds every Permission below. A Permission is yes or no; while it is yes, its values say how far it goes, of the kinds a Parameter has ([DEC-UX-71](../../design/principles.md#dec-ux-71)): a whole number with its unit, a choice, several choices, yes or no, a text ([DEC-UX-186](../../design/principles.md#dec-ux-186)). A Permission marked always on has no yes or no, only its values. Where a Permission reaches "their Owner Units", or "the assets in their control", the Owner Units of the User, still Workspace groups, say which Collections, and so which Resources and Lenses, are theirs ([DEC-UX-187](../../design/principles.md#dec-ux-187)).

Each Permission has a key, the name the services use. The column Today says who can do it now; the next three say what each group to start with gets:

- **Admin,** the Data Admins of today, the members of `datahub-datateam@`: every Permission, at its widest, and locked ([DEC-UX-188](../../design/principles.md#dec-ux-188)).
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

Who sees a Lens runs it, with its Parameters, on its page, in Claude and in Excel: that needs no Permission.

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `lenses.make` | Make a query a Lens, in a Collection of their Owner Units ([DEC-CO-20](03-collections.md#dec-co-20)), and send a large one to the Data Team | – | Who made the query | yes | yes | no |
| `lenses.manage` | Change, update and delete a Lens | Which (choice): those in the Collections of their Owner Units, or every Lens | The Owner Unit of its Collection and the Data Team ([DEC-LE-21](09-lenses.md#dec-le-21)) | every | their Owner Units | no |

### Monitoring

*Added on 2026-11-07 with [Checks and monitoring](08-checks-and-monitoring.md) ([DEC-CM-01](08-checks-and-monitoring.md#dec-cm-01)); not in the catalogue of Permissions yet: they come with its build.*

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `monitors.manage` | Build and change the Monitor of a Resource: its Segments, Metrics from the templates, Rules and schedule; mark its Findings useful or noise | Which (choice): those of their Owner Units, or every Resource | Nobody: Monitors are new | every | their Owner Units | no |
| `monitors.sql` | Add a SQL Metric to a Monitor ([FR-CM-05](08-checks-and-monitoring.md#fr-cm-05)) | – | Nobody: Monitors are new | yes | no | no |

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
| `claude.use` | Work with Data Hub in Claude | Writes through Claude (several choices), within what their other Permissions allow: Business Descriptions, Messages, deprecations, changes marked seen; a note for Claude (text), which Claude gets with the how-to-use | Every User, and Claude writes what the User may | yes, everything | yes, everything | yes, Messages |
| `claude.results` | How a result reaches Claude, for a query, a Preview and a Lens, always on | Where the result shows (choice): **in Claude**, Claude reads the rows and works on them; **in a card only**, the User sees the rows in the MCP App, and Claude reads the shape without the values, the values of the choices of a Preview included ([OP-DH-49](../../overview/backlog.md#op-dh-49)); **not in Claude**, Claude offers "Open in Data Hub" | In Claude, for every User ([DEC-CL-06](17-claude.md#dec-cl-06)) | in Claude | in Claude | in a card only |

"In a card only" keeps the rows out of the conversation as long as Claude hides the tools that only the MCP App calls, as Claude does; the User can still paste them in, and the rows still pass through Anthropic on their way to the card.

### Excel

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `excel.keys` | Make Excel keys on My page, to fetch the result of a Lens in Excel | Keys at most (whole number; empty for no limit); a key lasts (whole number, days) | Every User, no limit, a year ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) | yes, no limit, 365 days | yes, no limit, 365 days | yes, no limit, 365 days |

### Admin

| Key | Permission: what it allows | Values | Today | Admin | Business analyst | Lens user |
| --- | --- | --- | --- | --- | --- | --- |
| `admin.open` | Open Admin, with the tools chosen | Tools (several choices): Webhooks, with the Source Jobs, the deliveries and reprocessing a run; Excel keys, to see and revoke every key; Users, to see every User, change their Permission group and end their sessions ([TR-PF-25](../technical/00-platform.md#tr-pf-25)); Permission groups | Data Team | all four | none | none |

### What stays without a Permission

Within what `catalogue.see` allows, who sees what still follows from Collections and Owner Units: a private Collection only to its Owner Unit, a public one to whoever sees public Collections. [DEC-DH-77](../../overview/data-hub.md#dec-dh-77) notes it. What is a User's own stays theirs, whatever their Permission group: who sees a Lens runs it; a query is its maker's own; everyone reads the Learning Cards and Charts; a User revokes their own Excel keys, and replies in and closes their own Questions and Signals. A Data Admin, in the words of the requirements, becomes a User whose Permission group has `resources.assign`.

## Edge cases

<a id="ec-pl-01"></a>
### EC-PL-01 · A User loses a Permission while a page offers it

**Status:** Implemented · **Source:** proposed on 2026-11-06, with the requirements of Permission groups

The service refuses the action, and says which Permission it needs; the page says that what the User may do changed, and shows what they may do now. At the latest when their Access Token is renewed, the web app, Claude and Excel follow the new Permissions ([FR-PL-11](#fr-pl-11)).

<a id="ec-pl-02"></a>
### EC-PL-02 · A User sees less than before

**Status:** Implemented · **Source:** proposed on 2026-11-06, with [DEC-PL-02](#dec-pl-02)

When `catalogue.see` of a User narrows, what they no longer see answers as anything they may not see ([FR-CO-32](03-collections.md#fr-co-32)): a Lens on it is not found, also from Excel; their own queries on such Resources stay theirs but cannot run until they see them again.

<a id="ec-pl-03"></a>
### EC-PL-03 · Admin has no User who can still sign in

**Status:** Implemented · **Source:** Max, 2026-11-06, as proposed with [FR-PL-08](#fr-pl-08)

When every User of Admin can no longer sign in, for example after leaving, nobody can manage Data Hub. Then, and only then, a member of `datahub-datateam@` who signs in gets Admin, so that the Role Group stays a way back in, and the Data Team gets a Message that it happened.

<a id="ec-pl-04"></a>
### EC-PL-04 · A User has more Excel keys than their Permission group now allows

**Status:** Implemented · **Source:** proposed on 2026-11-06, with `excel.keys`

Lowering the number of keys stops none: a User keeps their keys until they expire or are revoked, and makes a new one only below the number. A shorter life counts for keys made from then on. Without `excel.keys`, Excel gets nothing with their keys until they have it again.

## Open points

- [ ] <a id="op-pl-01"></a>**OP-PL-01** · Work out confidentiality as a concept first, on Confluence, before it becomes requirements here. The starting points of the workshop ([REQ-DH-CONF](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-conf)): next to its maturity, every Resource gets a level of confidentiality, set in dbt (`meta`), only ever lowered downstream, and taken at its highest by a Lens or a Report, with a matrix of levels against who may do what. Settle as well how it relates to the access classification on the Resource Card ([The Resource Card](../../overview/data-hub.md#the-resource-card)) and to the access axis of [OP-DH-22](../../overview/open-themes.md#op-dh-22). *Decided on 2026-10-22: a concept to work out first, not yet requirements.* *Could, not in v1: set on 2026-10-28, by Max; confidentiality is out of the scope of version 1.*
- [x] <a id="op-pl-02"></a>**OP-PL-02** · List the Permissions of Data Hub, each with what it allows, its values and their kinds, and the Permission groups to start with, as requirements of this domain, once the design of [Users and Permission groups](../../design/principles.md#admin) is final ([OP-UX-55](../../design/principles.md#op-ux-55) to [OP-UX-61](../../design/principles.md#op-ux-61)). With them: how every service applies the Permissions of a User from the moment they sign in, in the web app, in Claude and in Excel, in the place of the roles of today ([FR-UM-11](02-user-management.md#fr-um-11), [DEC-DH-78](../../overview/data-hub.md#dec-dh-78)). *Raised on 2026-11-06, by Max: design first, then the Permissions in the requirements, then the build.* *Done on 2026-11-06: the Permissions under [The Permissions](#the-permissions), [DEC-PL-01](#dec-pl-01) to [DEC-PL-07](#dec-pl-07), [FR-PL-04](#fr-pl-04) to [FR-PL-15](#fr-pl-15), and their technical requirements, [TR-PL-03](../technical/12-permissions-and-library-cards.md#tr-pl-03) to [TR-PL-09](../technical/12-permissions-and-library-cards.md#tr-pl-09).*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
