# User management: technical requirements

| | |
| --- | --- |
| Realises | [User management](../functional/02-user-management.md) |
| Status | Specified |
| Source of truth | This file |

Sign-in, the Access Token and the check of the account at every renewal are platform requirements: [TR-PF-24](00-platform.md#tr-pf-24) to [TR-PF-26](00-platform.md#tr-pf-26). This file holds how the Groups kept in Data Hub are built ([DEC-UM-10](../functional/02-user-management.md#dec-um-10)).

## Requirements

<a id="tr-um-01"></a>
### TR-UM-01 · Groups, their members and their history in the database of identity

**Status:** Specified · **Realises:** [FR-UM-12](../functional/02-user-management.md#fr-um-12), [FR-UM-15](../functional/02-user-management.md#fr-um-15), [FR-UM-17](../functional/02-user-management.md#fr-um-17)

identity keeps three tables, in migration `0008-groups`:

- `groups`: the identifier, a random UUID for a new Group and the Google ID for one moved from Google ([TR-UM-04](#tr-um-04)); its name, its sentence, `managed_by`, the identifier of the Group that manages it, which may be its own; who made it and when; `deleted_at` and who deleted it. A deleted Group keeps its row, so that its identifier is never reused and its history stays.
- `group_members`: a Group and the address of a member, in lowercase, with who added them and when. A member is kept by address, not by Google ID, so that a colleague who has not signed in yet can be one; they are in the Group from their first sign-in, as their address is then the address of a User.
- `group_log`: what happened to a Group, with who and when: `made`, `renamed`, `sentence`, `managedBy`, `added`, `removed`, `moved` and `deleted`, with what changed as JSON.

A User also gets the column `active`, true from a sign-in and false once the directory says the account is no longer active ([DEC-UM-12](../functional/02-user-management.md#dec-um-12)). It replaces the empty list of Groups that marked such a User before.

<a id="tr-um-02"></a>
### TR-UM-02 · The routes of Groups

**Status:** Specified · **Realises:** [FR-UM-13](../functional/02-user-management.md#fr-um-13), [FR-UM-14](../functional/02-user-management.md#fr-um-14), [FR-UM-15](../functional/02-user-management.md#fr-um-15), [FR-UM-16](../functional/02-user-management.md#fr-um-16), [FR-UM-18](../functional/02-user-management.md#fr-um-18)

identity serves the Groups behind the Access Token:

- `GET /me/groups`: the Groups the User is in or manages, each with its name, its sentence, the Group that manages it, its number of members, and whether the User is in it and manages it.
- `GET /groups`: every Group, for a User with `groups.all.manage`, or with `collections.make` for any Group ([FR-CO-35](../functional/03-collections.md#fr-co-35)); `?q=` narrows it by name.
- `GET /groups/:id`: one Group for any signed-in User, with its members (address, name, whether they signed in and can still sign in, who added them and when), the Groups it manages, its history, and whether the User may change it.
- `POST /groups`, with `groups.manage`: name, sentence and `managedBy`, a Group the User is in or `itself`; with `groups.all.manage`, any Group. The maker is its first member.
- `PATCH /groups/:id`: name, sentence and `managedBy`. `PUT /groups/:id/members` adds an address of an own Workspace domain; `DELETE /groups/:id/members/:email` takes one out. `DELETE /groups/:id` deletes it.
- `GET /people?q=`: the Users whose name or address holds the text, to suggest while adding a member.

Whoever changes a Group is in the Group that manages it, or has `groups.all.manage`; otherwise 403. A Group cannot be deleted while it manages another Group, or while catalogue says it is the Owner Unit of a Collection ([TR-UM-05](#tr-um-05)): 409 with what it still owns and manages.

<a id="tr-um-03"></a>
### TR-UM-03 · The claim `groups` holds the Groups of Data Hub

**Status:** Specified · **Realises:** [FR-UM-19](../functional/02-user-management.md#fr-um-19)

At sign-in, at every renewal and at the exchange of an Excel key, identity puts in the claim `groups` of the Access Token the identifiers of the Groups whose members hold the address of the User, read from its own database. It no longer reads groups from the Cloud Identity Groups API. The services keep checking ownership against the claim, as before, and identity keeps the list on the User for the people catalogue asks for ([TR-LN-02](07-log-and-notifications.md#tr-ln-02)), updated at once when the members of a Group change. The web app renews its Access Token after a change to the Groups of its User.

<a id="tr-um-04"></a>
### TR-UM-04 · The Owner Units move from Google once

**Status:** Specified · **Realises:** [FR-UM-20](../functional/02-user-management.md#fr-um-20)

identity keeps, on every User, the Google groups it last read for them (`workspace_groups`, copied in migration `0008-groups`). At its start, catalogue sends identity the Owner Units of its Collections, at `POST /internal/groups/move` with its Google ID token for identity's address. For each that is not a Group yet, identity makes one with the Google ID as identifier, its name, managing itself, and as members the Users whose `workspace_groups` hold it, noted as `moved` in its history. It changes nothing for a Group that already exists, so that the call can repeat at every start.

<a id="tr-um-05"></a>
### TR-UM-05 · What a Group owns, from catalogue

**Status:** Specified · **Realises:** [FR-UM-16](../functional/02-user-management.md#fr-um-16), [FR-UM-18](../functional/02-user-management.md#fr-um-18)

catalogue answers identity, at `GET /internal/owner-units/:id` with identity's Google ID token for catalogue's address, how many Collections a Group is the Owner Unit of, and their names, before identity deletes it. For the page of a Group, catalogue serves `GET /owner-units/:id/collections` behind the Access Token: the Collections of that Owner Unit the User may see.

<a id="tr-um-06"></a>
### TR-UM-06 · The way back into Admin is a list in Terraform

**Status:** Specified · **Realises:** [EC-PL-03](../functional/12-permissions-and-library-cards.md#ec-pl-03), [FR-PL-08](../functional/12-permissions-and-library-cards.md#fr-pl-08)

The Terraform variable `break_glass_admins`, per environment, lists the addresses that get Admin when no User of Admin can still sign in. identity reads it from `DATAHUB_BREAK_GLASS_ADMINS`, a list separated by commas. It replaces the membership of `datahub-datateam@`.

<a id="tr-um-07"></a>
### TR-UM-07 · Notifications to an Owner Unit go to each member

**Status:** Specified · **Realises:** [FR-UM-21](../functional/02-user-management.md#fr-um-21)

catalogue asks identity at `POST /internal/people` for the members of the Owner Units it notifies, also who has not signed in yet, who come with their address only. Each member gets an e-mail of their own, in their language, Dutch for who has not signed in, and a Slack direct message once Data Hub knows them; who wrote the Message gets neither. The e-mail to the Data Team still goes to the address of `datahub-datateam@`.

## Open points

- [ ] <a id="op-um-09"></a>**OP-UM-09** · Give every User an identifier of Data Hub's own, so that the move to Entra keeps their Collections, queries, progress and Messages ([DEC-UM-11](../functional/02-user-management.md#dec-um-11)). Today the services know a User by their Google ID. *Raised on 2026-11-10, while building the Groups: a part of its own, after this one.*
