# Collections: technical requirements

| | |
| --- | --- |
| Realises | [Collections](../functional/03-collections.md) |
| Status | Implemented: Collections, their Log, their Resources ([Resources](04-stacks-and-resources.md)), and the groups of the domain for the Data Team |
| Source of truth | This file |

How Collections are kept and guarded, in the service [catalogue](../../architecture/services/catalogue.md), with the Groups of the User from [identity](../../architecture/services/identity.md).

## Requirements

<a id="tr-co-01"></a>
### TR-CO-01 · Collections live in the schema of catalogue

**Status:** Implemented · **Realises:** [FR-CO-02](../functional/03-collections.md#fr-co-02), [FR-CO-03](../functional/03-collections.md#fr-co-03), [FR-CO-16](../functional/03-collections.md#fr-co-16), [DEC-CO-19](../functional/03-collections.md#dec-co-19), [DEC-CO-23](../functional/03-collections.md#dec-co-23), [DEC-CO-25](../functional/03-collections.md#dec-co-25)

The table `collections` holds one row per Collection: a UUID as its ID, the name, the description, the icon, the Owner Unit, whether it is public, who created it (by fixed Google ID, with their name at that moment) and when, and when it was dissolved. A Collection has no colour ([DEC-CO-23](../functional/03-collections.md#dec-co-23)).

- The name has 1 to 80 characters and is unique without regard to case among the Collections that are not dissolved: a unique index on `lower(name)` where `dissolved_at` is null. A name already in use is refused with `409 name_taken`.
- The description has 1 to 500 characters.
- The icon is required ([DEC-CO-25](../functional/03-collections.md#dec-co-25)): the name of an icon of Phosphor that is not the logo of a brand ([DEC-CO-19](../functional/03-collections.md#dec-co-19)), such as `house-line`, drawn in the light weight; any other name, and none, is refused with `400`. The list is `@datahub/contracts/collection-icons`, generated from `@phosphor-icons/core` by `pnpm icons:build`, with each icon's search words; a test fails when it no longer matches the installed version. An icon that a later version of Phosphor no longer has is returned as `null`, so the web app never asks for a drawing that is gone. The web app takes the drawing of each icon apart into its build and loads it only where it shows one; the list to search through is a separate script it loads when the form opens.
- The Owner Unit is kept by its fixed Google ID ([FR-UM-08](../functional/02-user-management.md#fr-um-08)), with its address and name at the moment it was chosen, to show them ([TR-CO-03](#tr-co-03)).
- Dissolving sets `dissolved_at`. The row stays, so that its Log keeps its subject; a dissolved Collection is no longer listed or found, and its name is free again.

*Note of 2026-10-28: the Collections started afresh for the rebuild ([DEC-DH-76](../../overview/data-hub.md#dec-dh-76)), without colour and with a required icon of Phosphor; no icon of Tabler was carried over ([OP-CO-16](../functional/03-collections.md#op-co-16)), and every Resource waits for a Collection again.*

<a id="tr-co-02"></a>
### TR-CO-02 · The routes of Collections, and who may do what

**Status:** Implemented · **Realises:** [FR-CO-12](../functional/03-collections.md#fr-co-12), [FR-CO-13](../functional/03-collections.md#fr-co-13), [FR-CO-16](../functional/03-collections.md#fr-co-16), [FR-CO-17](../functional/03-collections.md#fr-co-17), [FR-CO-26](../functional/03-collections.md#fr-co-26), [DEC-CO-08](../functional/03-collections.md#dec-co-08), [DEC-CO-10](../functional/03-collections.md#dec-co-10), [DEC-CO-11](../functional/03-collections.md#dec-co-11), [DEC-CO-18](../functional/03-collections.md#dec-co-18)

Every route needs an Access Token. catalogue decides from the token alone: the `groups` claim holds the fixed Google IDs of every group of the User ([TR-PF-02](00-platform.md#tr-pf-02)), and the role `datateam` comes from the Role Group of the Data Team.

| Route | What | Who |
| --- | --- | --- |
| `GET /collections` | The Collections the User sees, by name, each as below | Everyone; the list holds only what they see |
| `POST /collections` | Create a Collection, with its name, description, icon, Owner Unit and visibility | Everyone, with one of their own groups as Owner Unit; the Data Team with any group of the domain |
| `GET /collections/{id}` | One Collection, with whether the User may manage it | Whoever sees it |
| `PATCH /collections/{id}` | Change name, description, icon, Owner Unit or visibility | The Owner Unit and the Data Team |
| `DELETE /collections/{id}` | Dissolve it | The Owner Unit and the Data Team |
| `GET /collections/{id}/log` | Its Log, newest first | Whoever sees it |

A Collection comes with who created it, the Resources in it that the User sees, each with its Display Name, Level and whether it is published or withdrawn, and the latest entry of its Log since it was created that the User sees: what the panel, the start screen and the page of the Collection show ([FR-CO-18](../functional/03-collections.md#fr-co-18), [FR-CO-26](../functional/03-collections.md#fr-co-26)). Who sees a Resource is [TR-SR-05](04-stacks-and-resources.md#tr-sr-05); the entries about a Resource in the Log of a Collection follow it: while no Resource is published, only the Owner Unit and the Data Team see them.

A User sees a Collection when it is public, when its Owner Unit is among the groups of their token, or when they have the role `datateam`. A Collection someone does not see, or that is dissolved, is answered with `404`, the same as one that never existed ([FR-CO-17](../functional/03-collections.md#fr-co-17)). Changing or dissolving a Collection someone sees but does not manage is answered with `403`.

Dissolving a Collection that still holds Resources, withdrawn ones included, is refused with `409 not_empty` ([FR-CO-10](../functional/03-collections.md#fr-co-10)).

<a id="tr-co-03"></a>
### TR-CO-03 · The Owner Unit is chosen from the groups identity reads

**Status:** Implemented · **Realises:** [FR-CO-15](../functional/03-collections.md#fr-co-15), [FR-CO-35](../functional/03-collections.md#fr-co-35), [FR-UM-11](../functional/02-user-management.md#fr-um-11), [DEC-CO-09](../functional/03-collections.md#dec-co-09), [DEC-UM-07](../functional/02-user-management.md#dec-um-07)

identity answers `GET /me/groups` with the groups the User is in, nested ones included, read from Workspace at that moment as at a login: the fixed Google ID, the address and the name of each group of the own Workspace domains, sorted by name. The web app offers them when a User chooses an Owner Unit.

For the Data Team, identity answers `GET /groups` with every group of the own Workspace domains, in the same form ([FR-CO-35](../functional/03-collections.md#fr-co-35)); anyone else gets `403`. It lists the groups of the Workspace of the User who asks with the Groups API of Cloud Identity (`groups.list` of the customer, which both domains share), so that their IDs are those of `GET /me/groups`, and keeps the list five minutes. The web app offers them to the Data Team when it chooses an Owner Unit.

When a Collection is created, or handed to another Owner Unit, catalogue asks identity with the Access Token of the User, `GET /me/groups`, or `GET /groups` for the Data Team, and accepts only a group from that answer: whoever chooses an Owner Unit is in it at that moment, or is of the Data Team and chooses a group of the domain. catalogue keeps the fixed ID, and the address and name of that moment to show them. A group renamed in Workspace keeps its old name in Data Hub until its Owner Unit is chosen again ([OP-CO-08](#op-co-08)).

<a id="tr-co-04"></a>
### TR-CO-04 · The Log of a Collection is append-only

**Status:** Implemented · **Realises:** [FR-CO-11](../functional/03-collections.md#fr-co-11), [FR-SR-11](../functional/04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](../functional/04-stacks-and-resources.md#fr-sr-12), [DEC-SR-09](../functional/04-stacks-and-resources.md#dec-sr-09)

The table `collection_log` holds the Log Entries of Collections: the Log ID, the Collection, the parameters as JSON, the actor by fixed Google ID with their name at that moment, and the timestamp. A Log Entry is written in the same transaction as the change it records. A trigger refuses every update and delete of the table, also by the service itself.

The Log IDs are `COL-001` to `COL-005` of the [Log catalogue](../functional/log-catalogue.md): created, a field changed (the name, description or icon), the Owner Unit changed, made public or private, dissolved. catalogue builds the text from the template when the Log is read, and returns it with the Log ID and the parameters. Adding and removing a Resource writes `COL-006` or `COL-007` in the Log of the Collection, and `COL-030` or `COL-031` in the Log of the Resource ([TR-SR-04](04-stacks-and-resources.md#tr-sr-04)).

## Open points

- [x] <a id="op-co-08"></a>**OP-CO-08** · Keep the address and name of an Owner Unit up to date when the group changes in Workspace, for example with the Synchronisation ([FR-UM-07](../functional/02-user-management.md#fr-um-07)). *Raised on 2026-10-19.* *Decided on 2026-10-25, by Max: by hand, in the form to edit the Collection: choosing the group again brings its name and address up to date, which its Owner Unit and the Data Team can do ([FR-CO-35](../functional/03-collections.md#fr-co-35), [DEC-CO-18](../functional/03-collections.md#dec-co-18)). The Synchronisation ([FR-UM-07](../functional/02-user-management.md#fr-um-07)) can take it over later.*
- [x] <a id="op-co-18"></a>**OP-CO-18** · Decide how the Data Team finds every group of the domain to hand a Collection to ([FR-CO-35](../functional/03-collections.md#fr-co-35)): identity lists only the groups of the User today (`GET /me/groups`). Proposal: an endpoint in identity that searches the groups of the domain, for the Data Team only. *Raised on 2026-10-25, while recording the decision.* *Decided on 2026-10-28, by Max, with the plan of part 3 of the [build order](../../design/build-order.md): an endpoint in identity for the Data Team only, `GET /groups`, which lists every group of the domain for the list of Owner Units ([TR-CO-03](#tr-co-03)).*
