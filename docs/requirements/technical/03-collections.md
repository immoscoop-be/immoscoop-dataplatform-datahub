# Collections: technical requirements

| | |
| --- | --- |
| Realises | [Collections](../functional/03-collections.md) |
| Status | Implemented: Collections, their Log, their Resources ([Resources](04-stacks-and-resources.md)), the groups of the domain for the Data Team, the search of the start screen, folders and the intro |
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

<a id="tr-co-05"></a>
### TR-CO-05 · Adding a Resource records how it is stored, its grain and its mappings

**Status:** Implemented · **Realises:** [FR-CO-33](../functional/03-collections.md#fr-co-33), [FR-CO-34](../functional/03-collections.md#fr-co-34), [FR-AR-17](../functional/01-artifact-registry.md#fr-ar-17), [DEC-RC-05](../functional/05-resource-card.md#dec-rc-05), [DEC-RC-06](../functional/05-resource-card.md#dec-rc-06), [DEC-RC-07](../functional/05-resource-card.md#dec-rc-07), [DEC-RC-09](../functional/05-resource-card.md#dec-rc-09), [DEC-RC-10](../functional/05-resource-card.md#dec-rc-10), [DEC-RC-13](../functional/05-resource-card.md#dec-rc-13), [DEC-RC-14](../functional/05-resource-card.md#dec-rc-14), [DEC-CO-21](../functional/03-collections.md#dec-co-21)

`POST /collections/{id}/resources` takes each Resource by its ID, or as an object with its ID and what the Data Admin recorded at the second step ([FR-CO-33](../functional/03-collections.md#fr-co-33), [FR-CO-34](../functional/03-collections.md#fr-co-34)):

- **how it is stored:** its partition column and the unit of its partitions, or none; at most four cluster columns in their order; and whether a filter on the partition column is required, by BigQuery, by Data Hub or not at all ([DEC-SR-35](../functional/04-stacks-and-resources.md#dec-sr-35));
- **what one row is:** the fields of its grain with a sentence of at most 200 characters, and its model type, one of `event`, `state`, `fact`, `dimension` and `aggregate`, or none ([DEC-RC-07](../functional/05-resource-card.md#dec-rc-07), [DEC-RC-10](../functional/05-resource-card.md#dec-rc-10));
- **where each came from:** dbt, a dbt test, the Domain Model, or the Data Admin;
- **the mapping of every field that has one:** `is` an identity, a relation type towards one, or `performedBy`, with the identity as `entity.identifier` or `entity.action`, the field mapped as `is` it starts from when there is more than one, where it came from (the Domain Model, its name, or the Data Admin), and whether the Domain Model has its Entity ([DEC-RC-05](../functional/05-resource-card.md#dec-rc-05), [DEC-RC-06](../functional/05-resource-card.md#dec-rc-06), [DEC-RC-14](../functional/05-resource-card.md#dec-rc-14), [DEC-CO-21](../functional/03-collections.md#dec-co-21));
- **the release of the Domain Model** the mappings were made with ([FR-AR-17](../functional/01-artifact-registry.md#fr-ar-17)).

catalogue keeps them on the Resource and in `resource_mappings`, one row per mapped field, in the same transaction as the addition, and writes `RES-009` in the Log of the Resource with how many fields are mapped, the grain, the model type and the release. A field the Resource does not have, a field mapped twice, or a relation that starts from a field not mapped as `is` refuses all of them with `400`. The relation types are not checked against the Domain Model: catalogue does not read it, and the step that records them offers only those it has. `GET /resources/{id}` returns them with the Resource; they are kept only in Data Hub ([DEC-RC-09](../functional/05-resource-card.md#dec-rc-09), [DEC-RC-13](../functional/05-resource-card.md#dec-rc-13)).

<a id="tr-co-06"></a>
### TR-CO-06 · The start screen searches Collections, Resources and Lenses by the words of a question

**Status:** Implemented · **Realises:** [FR-CO-37](../functional/03-collections.md#fr-co-37), [DEC-UX-127](../../design/principles.md#dec-ux-127), [FR-SR-48](../functional/04-stacks-and-resources.md#fr-sr-48)

`GET /search?question=…` of catalogue gives the Collections and the Resources the User sees that share words with a question: the Collections as `GET /collections` gives them, and in them the Resources the User sees, without the withdrawn ones. The words are those of the full-text search of Postgres in the configuration `search_words`, English with `unaccent` before the stemmer, made in migration `0010-search-words`, as query finds Lenses ([TR-LE-07](09-lenses.md#tr-le-07)): common words left out, every word by its stem, accents not counted. They are matched against the name and description of a Collection, and the name, description and Business Description of a Resource. Each comes with how many words it shares and its texts in pieces with the shared words marked; a Resource with its Business Description, or else its description from dbt, its Collection and its Level. Those that share most words come first, at most 20 of each. `GET /lenses/search?question=…` of query gives the Lenses the User sees in the same way, at most 20. The web app asks both at once and shows Lenses, then Resources, then Collections. The configuration and its helpers are shared in `@datahub/db`.

<a id="tr-co-07"></a>
### TR-CO-07 · Folders live in the schema of catalogue, and only the Owner Unit and the Data Team change them

**Status:** Implemented · **Realises:** [FR-CO-38](../functional/03-collections.md#fr-co-38), [FR-CO-39](../functional/03-collections.md#fr-co-39), [FR-CO-40](../functional/03-collections.md#fr-co-40), [DEC-CO-26](../functional/03-collections.md#dec-co-26)

Migration `0015-folders` adds two tables. `folders` holds one row per folder: a UUID as its ID, its Collection, the folder it sits in (`parent_id`, null at the top of the Collection), its name of 1 to 80 characters, and who made it and when. `folder_places` holds, for a Resource or a Lens that sits in a folder, its kind, its ID and the folder; without a row it sits at the top. A Lens is kept by query, so its place is kept here by its ID, and catalogue knows it is in the Collection from what query tells about it ([DEC-PF-30](00-platform.md#dec-pf-30)). A Resource that is added to a Collection, or leaves one, has no place: it comes in at the top.

| Route | What | Who |
| --- | --- | --- |
| `POST /collections/{id}/folders` | Make a folder, with its name and the `parentId` of the folder it goes in, or none for the top | The Owner Unit and the Data Team |
| `PATCH /collections/{id}/folders/{folderId}` | Rename it | The Owner Unit and the Data Team |
| `DELETE /collections/{id}/folders/{folderId}` | Delete it, only when it holds nothing: else `409 not_empty`, with how many folders, Resources and Lenses it holds | The Owner Unit and the Data Team |
| `PUT /collections/{id}/places/{kind}/{itemId}` | Put a `resource`, `lens` or `folder` of the Collection in the folder `folderId`, or at the top with `null` | The Owner Unit and the Data Team |

A Collection comes with its folders, each with its name and the folder it sits in, with the folder of each of its Resources, and with the folder of each of its Lenses that sits in one: everyone who sees the Collection sees them, and the web app shows only the Resources and Lenses the User sees. A folder that would go into itself or into a folder inside it is refused with `409 into_itself`; a folder, Resource or Lens that is not in the Collection is answered with `404`. Each change takes a lock on the Collection, so that changes to its folders happen one at a time and no folder is deleted while something moves into it.

Each change goes into the Log of the Collection: `COL-008` to `COL-013` in the [Log Catalogue](../functional/log-catalogue.md). Moving a Resource is an entry about a Resource, seen only by who sees the Resource ([TR-CO-02](#tr-co-02)).

<a id="tr-co-08"></a>
### TR-CO-08 · The intro of a Collection is Markdown, never shown as HTML

**Status:** Specified · **Realises:** [FR-CO-41](../functional/03-collections.md#fr-co-41), [DEC-UX-158](../../design/principles.md#dec-ux-158)

The column `intro` of `collections`, empty by default, holds the intro as its Owner Unit wrote it, at most 10,000 characters, without the white space at its ends; `POST` and `PATCH /collections/{id}` take it as `intro`. A change is logged as `COL-014`, without the text. The web app reads the Markdown itself into headings, paragraphs, lists, bold, italic, code and links, and builds the page from those pieces, as it does for the text of a Message: HTML in the intro shows as the text it is. A link opens only an address with `http`, `https` or `mailto`, or a path within Data Hub; any other address stays text.

## Open points

- [x] <a id="op-co-08"></a>**OP-CO-08** · Keep the address and name of an Owner Unit up to date when the group changes in Workspace, for example with the Synchronisation ([FR-UM-07](../functional/02-user-management.md#fr-um-07)). *Raised on 2026-10-19.* *Decided on 2026-10-25, by Max: by hand, in the form to edit the Collection: choosing the group again brings its name and address up to date, which its Owner Unit and the Data Team can do ([FR-CO-35](../functional/03-collections.md#fr-co-35), [DEC-CO-18](../functional/03-collections.md#dec-co-18)). The Synchronisation ([FR-UM-07](../functional/02-user-management.md#fr-um-07)) can take it over later.*
- [x] <a id="op-co-18"></a>**OP-CO-18** · Decide how the Data Team finds every group of the domain to hand a Collection to ([FR-CO-35](../functional/03-collections.md#fr-co-35)): identity lists only the groups of the User today (`GET /me/groups`). Proposal: an endpoint in identity that searches the groups of the domain, for the Data Team only. *Raised on 2026-10-25, while recording the decision.* *Decided on 2026-10-28, by Max, with the plan of part 3 of the [build order](../../design/build-order.md): an endpoint in identity for the Data Team only, `GET /groups`, which lists every group of the domain for the list of Owner Units ([TR-CO-03](#tr-co-03)).*
