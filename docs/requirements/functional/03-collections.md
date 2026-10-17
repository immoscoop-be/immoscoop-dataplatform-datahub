# Collections

| | |
| --- | --- |
| Domain | 3 of Data Hub · code `CO` |
| Type | Working document |
| Tags | context, decision, governance |
| Area | Tooling, Technical |
| Status | Specified; edge cases and open points remain |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Collecties](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371504655) (Confluence, Dutch), last modified 2026-10-15, migrated 2026-10-17 |

**In one sentence:** a collection is a functional domain of Immoscoop, such as web visits, leads or agencies, in which the resources of that domain sit together under one owner unit.

*Functional domain 3 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: just as a library arranges its shelves into collections, each with a curator who vouches for it, Data Hub arranges its resources into collections, each with an owner unit.

> **Note:** not to be confused with a dataset in BigQuery, such as the stacks themselves. That is why we deliberately speak of a collection.

## Decisions

- <a id="dec-co-01"></a>**DEC-CO-01** · We speak of a collection, not of a dataset or data set, to avoid confusion with the datasets of BigQuery.
- <a id="dec-co-02"></a>**DEC-CO-02** · A collection is a functional domain of Immoscoop, not of the data and not of the domain model. It exists only in Data Hub.
- <a id="dec-co-03"></a>**DEC-CO-03** · Only the data team manages collections: the members of the role group of the data team from [User management](02-user-management.md).
- <a id="dec-co-04"></a>**DEC-CO-04** · Every collection has exactly one owner unit, a group from [User management](02-user-management.md). The owner of a resource is the owner of its collection.
- <a id="dec-co-05"></a>**DEC-CO-05** · A resource is in at most one collection. It can be added and removed, but not moved.
- <a id="dec-co-06"></a>**DEC-CO-06** · When the owner unit of a collection changes, the existing confirmations remain valid.
- <a id="dec-co-07"></a>**DEC-CO-07** · The colour of a collection comes from a researched, colour-blind-safe palette for charts: the "muted" palette by Paul Tol.

## What a collection has

| Field | Required | Explanation |
| --- | --- | --- |
| Name | Yes | Unique within Data Hub |
| Description | Yes | Short: which functional domain of Immoscoop the collection covers |
| Colour | Yes | From the [colour palette](#colour-palette) below |
| Icon | No | From one fixed set of line icons in SVG |
| Owner | Yes | Exactly one owner unit: a Google group following the [convention from User management](02-user-management.md#naming-convention) |

## Colour palette

The "muted" palette by Paul Tol is designed for qualitative series: the colours are easy to tell apart, also for people with a colour vision deficiency. The colour of a collection serves to recognise it in the interface, not as the colour of a series in a chart; for that, the chart language in Figma remains the source.

| Name | Hex |
| --- | --- |
| Rose | `#CC6677` |
| Indigo | `#332288` |
| Sand | `#DDCC77` |
| Green | `#117733` |
| Cyan | `#88CCEE` |
| Wine | `#882255` |
| Teal | `#44AA99` |
| Olive | `#999933` |
| Purple | `#AA4499` |

## Flow

1. **Create.** Someone from the data team creates a collection, with a name, description, colour, optionally an icon, and an owner unit.
2. **Add resources.** The data team adds resources from the stacks. With that, data makes them available to the owner: step one of the release.
3. **Confirm.** The owner publishes the resources to the company, and thereby confirms them.
4. **Remove resources.** The data team can take a resource out of the collection again.
5. **Dissolve.** An empty collection can be dissolved.

## Requirements

<a id="fr-co-01"></a>
### FR-CO-01 · Only the data team manages collections

**Status:** Specified · **Confluence:** CO-01

Only members of the role group of the data team can create, change and dissolve collections, and add or remove resources.

<a id="fr-co-02"></a>
### FR-CO-02 · Name is required and unique

**Status:** Specified · **Confluence:** CO-02

The name is required and unique.

<a id="fr-co-03"></a>
### FR-CO-03 · Description is required

**Status:** Specified · **Confluence:** CO-03

The description is required, and says which functional domain of Immoscoop the collection covers.

<a id="fr-co-04"></a>
### FR-CO-04 · Colour is required and comes from the palette

**Status:** Specified · **Confluence:** CO-04

The colour is required and comes from the [colour palette](#colour-palette). More collections are possible than there are colours: a colour may therefore recur, and together with the icon a collection stays recognisable.

<a id="fr-co-05"></a>
### FR-CO-05 · Icon is optional and comes from the fixed set

**Status:** Specified · **Confluence:** CO-05

The icon is optional and comes from the fixed set of line icons.

<a id="fr-co-06"></a>
### FR-CO-06 · Exactly one owner unit

**Status:** Specified · **Confluence:** CO-06

The owner is required: exactly one owner unit, a Google group following the [convention from User management](02-user-management.md#naming-convention).

<a id="fr-co-07"></a>
### FR-CO-07 · A resource is in at most one collection

**Status:** Specified · **Confluence:** CO-07

A resource is in at most one collection. Adding a resource to a collection makes it available to the owner of that collection. A resource without a collection has no owner, and so cannot go beyond Described.

<a id="fr-co-08"></a>
### FR-CO-08 · Add or remove, never move

**Status:** Specified · **Confluence:** CO-08

Resources are only added or removed; moving does not exist. Whoever wants a resource in another collection removes it and adds it again. On removal it loses its owner and drops to Described; in the new collection, the new owner confirms it again.

<a id="fr-co-09"></a>
### FR-CO-09 · The owner unit can change; confirmations remain valid

**Status:** Specified · **Confluence:** CO-09

The owner unit of a collection can be changed. The existing confirmations of its resources remain valid.

<a id="fr-co-10"></a>
### FR-CO-10 · Only an empty collection can be dissolved

**Status:** Specified · **Confluence:** CO-10

A collection can only be dissolved when it is empty.

<a id="fr-co-11"></a>
### FR-CO-11 · Every change is logged, append-only

**Status:** Specified · **Confluence:** CO-11

Every change goes into the log and is kept append-only: creating, changing fields, changing owner, adding and removing resources, and dissolving.

## Edge cases

Proposals to confirm.

<a id="ec-co-01"></a>
### EC-CO-01 · The owner group is dissolved in Workspace

**Status:** Proposed

The collection is then without an owner. It is flagged, the data team gets a notification, and for its resources the rule that [User management](02-user-management.md) sets for an owner unit that empties applies (see [EC-UM-01](02-user-management.md#ec-um-01)).

<a id="ec-co-02"></a>
### EC-CO-02 · A resource disappears from the stacks

**Status:** Proposed

It also disappears from its collection, and that goes into the log of the collection.

## Out of scope

What an owner may see and do ([Permissions and library cards](12-permissions-and-library-cards.md)), how the level of a resource is determined ([Maturity and release](06-maturity-and-release.md)), and which views in the stacks are resources ([Stacks and resources](04-stacks-and-resources.md)).

## Open points

- [ ] <a id="op-co-01"></a>**OP-CO-01** · Ask Daniel's team which set of SVG line icons they use, and adopt it. Candidates if they have no fixed set yet: Lucide, Tabler Icons or Phosphor.
- [ ] <a id="op-co-02"></a>**OP-CO-02** · Let Daniel know that collections use the Paul Tol palette as a recognition colour in the interface, separate from the chart language.
- [ ] <a id="op-co-03"></a>**OP-CO-03** · Decide the first collections, starting from the pilot with DigiKom and the agencies case.
- [ ] <a id="op-co-04"></a>**OP-CO-04** · Work out the line of thought of whether promotion happens within a collection.
- [ ] <a id="op-co-05"></a>**OP-CO-05** · Confirm or adjust the edge cases above.

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [User management](02-user-management.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
