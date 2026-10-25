# Collections: technical requirements

| | |
| --- | --- |
| Realises | [Collections](../functional/03-collections.md) |
| Status | Implemented: Collections, their Log, and their Resources ([Stacks and resources](04-stacks-and-resources.md)) |
| Source of truth | This file |

How Collections are kept and guarded, in the service [catalogue](../../architecture/services/catalogue.md), with the Groups of the User from [identity](../../architecture/services/identity.md).

## Requirements

<a id="tr-co-01"></a>
### TR-CO-01 · Collections live in the schema of catalogue

**Status:** Implemented · **Realises:** [FR-CO-02](../functional/03-collections.md#fr-co-02), [FR-CO-03](../functional/03-collections.md#fr-co-03), [FR-CO-04](../functional/03-collections.md#fr-co-04), [FR-CO-05](../functional/03-collections.md#fr-co-05), [FR-CO-16](../functional/03-collections.md#fr-co-16), [DEC-CO-07](../functional/03-collections.md#dec-co-07), [DEC-CO-13](../functional/03-collections.md#dec-co-13), [DEC-CO-14](../functional/03-collections.md#dec-co-14)

The table `collections` holds one row per Collection: a UUID as its ID, the name, the description, the colour, the Owner Unit, whether it is public, who created it and when, and when it was dissolved.

- The name has 1 to 80 characters and is unique without regard to case among the Collections that are not dissolved: a unique index on `lower(name)` where `dissolved_at` is null. A name already in use is refused with `409 name_taken`.
- The description has 1 to 500 characters.
- The colour is the name of a colour from the palette in lower case, such as `rose`; a database check refuses any other value. The names and their hex codes live in `@datahub/contracts`, so that catalogue and the web app use one list.
- The icon is optional: the name of an outline icon of Tabler Icons that is not the logo of a brand ([DEC-CO-13](../functional/03-collections.md#dec-co-13), [DEC-CO-14](../functional/03-collections.md#dec-co-14)), such as `building-estate`; any other name is refused with `400`. The list is `@datahub/contracts/collection-icons`, generated from `@tabler/icons` by `pnpm icons:build`, with each icon's category and search words; a test fails when it no longer matches the installed version. An icon that a later version of Tabler no longer has is returned as `null`, so the web app never asks for a drawing that is gone. The web app serves each icon as its own file, `icons/<name>.svg`, and draws it as a CSS mask in the colour around it, so its build holds no icon; the list to search through is a separate script it loads when the form opens.
- The Owner Unit is kept by its fixed Google ID ([FR-UM-08](../functional/02-user-management.md#fr-um-08)), with its address and name at the moment it was chosen, to show them ([TR-CO-03](#tr-co-03)).
- Dissolving sets `dissolved_at`. The row stays, so that its Log keeps its subject; a dissolved Collection is no longer listed or found, and its name is free again.

<a id="tr-co-02"></a>
### TR-CO-02 · The routes of Collections, and who may do what

**Status:** Implemented · **Realises:** [FR-CO-12](../functional/03-collections.md#fr-co-12), [FR-CO-13](../functional/03-collections.md#fr-co-13), [FR-CO-16](../functional/03-collections.md#fr-co-16), [FR-CO-17](../functional/03-collections.md#fr-co-17), [DEC-CO-08](../functional/03-collections.md#dec-co-08), [DEC-CO-10](../functional/03-collections.md#dec-co-10), [DEC-CO-11](../functional/03-collections.md#dec-co-11)

Every route needs an Access Token. catalogue decides from the token alone: the `groups` claim holds the fixed Google IDs of every group of the User ([TR-PF-02](00-platform.md#tr-pf-02)), and the role `datateam` comes from the Role Group of the Data Team.

| Route | What | Who |
| --- | --- | --- |
| `GET /collections` | The Collections the User sees, by name | Everyone; the list holds only what they see |
| `POST /collections` | Create a Collection | Everyone, with one of their own groups as Owner Unit |
| `GET /collections/{id}` | One Collection, with whether the User may manage it | Whoever sees it |
| `PATCH /collections/{id}` | Change name, description, colour, icon, Owner Unit or visibility; an icon of `null` takes it away | The Owner Unit and the Data Team |
| `DELETE /collections/{id}` | Dissolve it | The Owner Unit and the Data Team |
| `GET /collections/{id}/log` | Its Log, newest first | Whoever sees it |

A User sees a Collection when it is public, when its Owner Unit is among the groups of their token, or when they have the role `datateam`. A Collection someone does not see, or that is dissolved, is answered with `404`, the same as one that never existed ([FR-CO-17](../functional/03-collections.md#fr-co-17)). Changing or dissolving a Collection someone sees but does not manage is answered with `403`.

Dissolving a Collection that still holds Resources, withdrawn ones included, is refused with `409 not_empty` ([FR-CO-10](../functional/03-collections.md#fr-co-10)).

<a id="tr-co-03"></a>
### TR-CO-03 · The Owner Unit is chosen from the groups identity reads

**Status:** Implemented · **Realises:** [FR-CO-15](../functional/03-collections.md#fr-co-15), [FR-UM-11](../functional/02-user-management.md#fr-um-11), [DEC-CO-09](../functional/03-collections.md#dec-co-09), [DEC-UM-07](../functional/02-user-management.md#dec-um-07)

identity answers `GET /me/groups` with the groups the User is in, nested ones included, read from Workspace at that moment as at a login: the fixed Google ID, the address and the name of each group of the own Workspace domain, sorted by name. The web app offers them when a User chooses an Owner Unit.

When a Collection is created, or handed to another Owner Unit, catalogue asks identity's `GET /me/groups` with the Access Token of the User, and accepts only a group from that answer: whoever chooses an Owner Unit is in it at that moment. catalogue keeps the fixed ID, and the address and name of that moment to show them. A group renamed in Workspace keeps its old name in Data Hub until its Owner Unit is chosen again ([OP-CO-08](#op-co-08)).

<a id="tr-co-04"></a>
### TR-CO-04 · The Log of a Collection is append-only

**Status:** Implemented · **Realises:** [FR-CO-11](../functional/03-collections.md#fr-co-11), [FR-SR-11](../functional/04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](../functional/04-stacks-and-resources.md#fr-sr-12), [DEC-SR-09](../functional/04-stacks-and-resources.md#dec-sr-09)

The table `collection_log` holds the Log Entries of Collections: the Log ID, the Collection, the parameters as JSON, the actor by fixed Google ID with their name at that moment, and the timestamp. A Log Entry is written in the same transaction as the change it records. A trigger refuses every update and delete of the table, also by the service itself.

The Log IDs are `COL-001` to `COL-005` of the [Log catalogue](../functional/log-catalogue.md): created, a field changed (the name, description, colour or icon, with `none` for no icon), the Owner Unit changed, made public or private, dissolved. catalogue builds the text from the template when the Log is read, and returns it with the Log ID and the parameters. Adding and removing a Resource writes `COL-006` or `COL-007` in the Log of the Collection, and `COL-030` or `COL-031` in the Log of the Resource ([TR-SR-04](04-stacks-and-resources.md#tr-sr-04)).

## Open points

- [x] <a id="op-co-08"></a>**OP-CO-08** · Keep the address and name of an Owner Unit up to date when the group changes in Workspace, for example with the Synchronisation ([FR-UM-07](../functional/02-user-management.md#fr-um-07)). *Raised on 2026-10-19.* *Decided on 2026-10-25, by Max: by hand, in the form to edit the Collection: choosing the group again brings its name and address up to date, which its Owner Unit and the Data Team can do ([FR-CO-35](../functional/03-collections.md#fr-co-35), [DEC-CO-18](../functional/03-collections.md#dec-co-18)). The Synchronisation ([FR-UM-07](../functional/02-user-management.md#fr-um-07)) can take it over later.*
