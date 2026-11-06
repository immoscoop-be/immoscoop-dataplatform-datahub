# Permissions and Excel keys: technical requirements

| | |
| --- | --- |
| Realises | [Permissions and Excel keys](../functional/12-permissions-and-library-cards.md) |
| Status | Under way |
| Source of truth | This file |

## Requirements

<a id="tr-pl-01"></a>
### TR-PL-01 · identity keeps Excel keys as hashes, each for a year

**Status:** Implemented · **Realises:** [FR-PL-01](../functional/12-permissions-and-library-cards.md#fr-pl-01), [FR-PL-02](../functional/12-permissions-and-library-cards.md#fr-pl-02), [FR-PL-03](../functional/12-permissions-and-library-cards.md#fr-pl-03), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)

identity keeps the Excel keys in the table `excel_keys` (migration `0005-excel-keys`): per key its User, its name of 1 to 80 characters, the SHA-256 hash of the key, when it was made, last used, expires, and, once revoked, when and by whom. A key is `dhx_` followed by 24 random bytes in base64url; identity answers it once, to `POST /me/excel-keys`, with `Cache-Control: no-store`, and never again. It expires 365 days after it was made.

`GET /me/excel-keys` lists the keys of the User, newest first, revoked ones included; `DELETE /me/excel-keys/{id}` revokes one of their own. For the Data Team, `GET /excel-keys` lists every key with its User, and `DELETE /excel-keys/{id}` revokes any key. A revoked key stays, so that the list can show it.

`POST /internal/excel-keys/exchange` takes a key in its body, only from query, with its Google ID token for identity's address (`DATAHUB_QUERY_SERVICE_ACCOUNT`). A key that is not known, revoked or expired, or whose User Workspace no longer knows as active, is refused with 401. Otherwise identity reads the Groups of the User from Workspace, applies the [Naming Convention](../functional/02-user-management.md#naming-convention), and answers an Access Token of the User with them, as at a sign-in ([TR-PF-07](00-platform.md#tr-pf-07)). It notes when the key was last used, at most once a minute.

<a id="tr-pl-02"></a>
### TR-PL-02 · The User of a key hears that it expires, or that the Data Team revoked it

**Status:** Implemented · **Realises:** [FR-PL-03](../functional/12-permissions-and-library-cards.md#fr-pl-03), [MSG-KEY-01](../functional/message-catalogue.md#msg-key-01), [MSG-KEY-02](../functional/message-catalogue.md#msg-key-02)

Cloud Scheduler calls `POST /internal/excel-keys/expiring` of identity once a day, at 07:43 in Brussels, with the Google ID token of `datahub-scheduler` for identity's address (`DATAHUB_SCHEDULER_SERVICE_ACCOUNT`). identity marks every key that is not revoked and expires within 30 days, once, and tells catalogue of each one with [MSG-KEY-01](../functional/message-catalogue.md#msg-key-01). When the Data Team revokes the key of another User, identity tells catalogue with [MSG-KEY-02](../functional/message-catalogue.md#msg-key-02), once per key; the key is revoked whether or not catalogue answers.

identity tells catalogue at `POST /internal/excel-keys/notices` (`DATAHUB_CATALOGUE_URL`), with its Google ID token for catalogue's address, which catalogue checks (`DATAHUB_IDENTITY_SERVICE_ACCOUNT`). catalogue writes the Message on the key (subject `excelKey`, migration `0016-excel-key-messages`), which only the User of the key sees, and notifies them as its author.

<a id="tr-pl-03"></a>
### TR-PL-03 · One catalogue of Permissions, in contracts

**Status:** Proposed · **Realises:** [FR-PL-05](../functional/12-permissions-and-library-cards.md#fr-pl-05), [DEC-PL-01](../functional/12-permissions-and-library-cards.md#dec-pl-01)

`@datahub/contracts` holds the Permissions as data: per Permission its key, its part of Data Hub, whether it is yes or no or always on, and its values, each with its name, its kind (`number` with its unit, `choice` and `several` with their options, `yesno`, `text`) and its widest value; and the values of the three Permission groups to start with. identity checks every Permission group it saves against it; the services, the web app and the MCP server take the keys and values from it, typed, so that a key that is not in it does not compile.

<a id="tr-pl-04"></a>
### TR-PL-04 · identity keeps the Permission groups and the group of every User

**Status:** Proposed · **Realises:** [FR-PL-04](../functional/12-permissions-and-library-cards.md#fr-pl-04), [FR-PL-05](../functional/12-permissions-and-library-cards.md#fr-pl-05), [FR-PL-08](../functional/12-permissions-and-library-cards.md#fr-pl-08), [FR-PL-10](../functional/12-permissions-and-library-cards.md#fr-pl-10)

A migration of identity adds `permission_groups`: per group its id, name, sentence, its Permissions as JSON by key, whether it is the default (a partial unique index keeps one default), whether it is locked (Admin), and when and by whom it last changed. `users` gets `permission_group_id`, never empty: a User who signs in for the first time gets the default. `permission_group_log` keeps every move of a User and every change of a group: who, when, from what to what. identity refuses to change the group of the User who asks, to change or delete a locked group, and to move the last User out of Admin.

<a id="tr-pl-05"></a>
### TR-PL-05 · The Access Token carries the Permissions of the User

**Status:** Proposed · **Realises:** [FR-PL-11](../functional/12-permissions-and-library-cards.md#fr-pl-11), [FR-PL-14](../functional/12-permissions-and-library-cards.md#fr-pl-14)

The claims of an Access Token get `permissionGroup`, its id and name, and `permissions`, the values of the Permission group by key, in the place of `roles`. identity reads them from its database at a sign-in, at every renewal of an Access Token and at the exchange of an Excel key ([TR-PL-01](#tr-pl-01)). An Access Token lasts 15 minutes, so that a change reaches every channel within 15 minutes; no service asks identity again within that time.

<a id="tr-pl-06"></a>
### TR-PL-06 · Every service checks a Permission, never a role

**Status:** Proposed · **Realises:** [FR-PL-14](../functional/12-permissions-and-library-cards.md#fr-pl-14), [DEC-PL-01](../functional/12-permissions-and-library-cards.md#dec-pl-01)

`@datahub/auth` gives every service `can(user, key)`, `reach(user, key)`, such as `theirs` or `every`, and `value(user, key, name)`, from the claims. Every check of `roles.includes('datateam')` and of the Data Team in catalogue, query, registry, identity and the MCP server becomes a check of the Permission that covers it, with the Owner Units of the User where its reach says "their Owner Units". A route that refuses answers 403 with the key of the Permission it needs. The web app reads the Permissions of the User from `GET /me` once, at the start, and shows the sections of the rail and the actions from them and from the flags the services send per object (`canEdit`, `canPublish`), never from a role.

<a id="tr-pl-07"></a>
### TR-PL-07 · identity serves Users and Permission groups to Admin

**Status:** Proposed · **Realises:** [FR-PL-06](../functional/12-permissions-and-library-cards.md#fr-pl-06), [FR-PL-07](../functional/12-permissions-and-library-cards.md#fr-pl-07), [FR-PL-09](../functional/12-permissions-and-library-cards.md#fr-pl-09), [FR-PL-10](../functional/12-permissions-and-library-cards.md#fr-pl-10), [FR-PL-12](../functional/12-permissions-and-library-cards.md#fr-pl-12)

With `admin.open` for Users: `GET /users`, every User with their Permission group, their Groups, what they used (from their sessions, by client) and their last sign-in; `PUT /users/{googleId}/permission-group`; and the history of their group. With `admin.open` for Permission groups: `GET`, `POST`, `PATCH` and `DELETE /permission-groups`, `PUT /permission-groups/{id}/default`, and the number of Users of each. When it moves a User, or deletes a group, identity tells catalogue, which writes the Message to the User ([FR-PL-12](../functional/12-permissions-and-library-cards.md#fr-pl-12)), a new type in the Message catalogue.

<a id="tr-pl-08"></a>
### TR-PL-08 · The switch from Role Groups

**Status:** Proposed · **Realises:** [FR-PL-15](../functional/12-permissions-and-library-cards.md#fr-pl-15), [DEC-PL-07](../functional/12-permissions-and-library-cards.md#dec-pl-07)

A migration of identity makes Admin (locked, every Permission at its widest), Business analyst and Lens user (the default) from the catalogue of [TR-PL-03](#tr-pl-03), and puts every known User in Admin when their last-read roles hold `datateam`, else in Business analyst. From then on the [Naming Convention](../functional/02-user-management.md#naming-convention) gives no role, and `roles` leaves the Access Token. catalogue sends the Messages for the Data Team to the Users with `messages.dataTeam`, from identity, and to the address of the Data Team (`DATAHUB_DATA_TEAM_EMAIL`), as today.

<a id="tr-pl-09"></a>
### TR-PL-09 · The MCP server follows the Permissions of the User

**Status:** Proposed · **Realises:** [FR-PL-14](../functional/12-permissions-and-library-cards.md#fr-pl-14), [DEC-PL-05](../functional/12-permissions-and-library-cards.md#dec-pl-05), [FR-CL-28](../functional/17-claude.md#fr-cl-28)

The MCP server makes its tools per request, for its User: it registers only the tools the User may use, and the how-to-use says what they may do, with the note for Claude of their Permission group. `claude.results` decides what a result answers to Claude: in Claude, the rows as today; in a card only, the head of the result without its rows, and the values of the choices of a Preview left out, while the MCP App reads the rows through a tool only it calls; not in Claude, the link to Data Hub. In a card only, the MCP App does not pass the rows on to Claude when the User approves a run.
