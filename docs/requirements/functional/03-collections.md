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

**In one sentence:** a Collection is a functional domain of Immoscoop, such as web visits, leads or agencies, in which the Resources of that domain sit together under one Owner Unit.

*Functional domain 3 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: just as a library arranges its shelves into collections, each with a curator who vouches for it, Data Hub arranges its Resources into Collections, each with an Owner Unit.

> **Note:** not to be confused with a dataset in BigQuery, such as the Stacks themselves. That is why we deliberately speak of a Collection.

## Decisions

- <a id="dec-co-01"></a>**DEC-CO-01** · We speak of a Collection, not of a dataset or data set, to avoid confusion with the datasets of BigQuery.
- <a id="dec-co-02"></a>**DEC-CO-02** · A Collection is a functional domain of Immoscoop, not of the data and not of the Domain Model. It exists only in Data Hub.
- <a id="dec-co-03"></a>**DEC-CO-03** · Only the Data Team manages Collections: the members of the Role Group of the Data Team from [User management](02-user-management.md).
- <a id="dec-co-04"></a>**DEC-CO-04** · Every Collection has exactly one Owner Unit, a Group from [User management](02-user-management.md). The Owner of a Resource is the Owner of its Collection.
- <a id="dec-co-05"></a>**DEC-CO-05** · A Resource is in at most one Collection. It can be added and removed, but not moved.
- <a id="dec-co-06"></a>**DEC-CO-06** · When the Owner Unit of a Collection changes, the existing Confirmations remain valid.
- <a id="dec-co-07"></a>**DEC-CO-07** · The colour of a Collection comes from a researched, colour-blind-safe palette for charts: the "muted" palette by Paul Tol.

## What a Collection has

| Field | Required | Explanation |
| --- | --- | --- |
| Name | Yes | Unique within Data Hub |
| Description | Yes | Short: which functional domain of Immoscoop the Collection covers |
| Colour | Yes | From the [colour palette](#colour-palette) below |
| Icon | No | From one fixed set of line icons in SVG |
| Owner | Yes | Exactly one Owner Unit: a Google group following the [convention from User management](02-user-management.md#naming-convention) |

## Colour palette

The "muted" palette by Paul Tol is designed for qualitative series: the colours are easy to tell apart, also for people with a colour vision deficiency. The colour of a Collection serves to recognise it in the interface, not as the colour of a series in a chart; for that, the chart language in Figma remains the source.

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

1. **Create.** Someone from the Data Team creates a Collection, with a name, description, colour, optionally an icon, and an Owner Unit.
2. **Add Resources.** The Data Team adds Resources from the Stacks. With that, the Data Team makes them available to the Owner: step one of the Release.
3. **Confirm.** The Owner publishes the Resources to the company, and thereby confirms them.
4. **Remove Resources.** The Data Team can take a Resource out of the Collection again.
5. **Dissolve.** An empty Collection can be dissolved.

## Requirements

<a id="fr-co-01"></a>
### FR-CO-01 · Only the Data Team manages Collections

**Status:** Specified · **Confluence:** CO-01

Only members of the Role Group of the Data Team can create, change and dissolve Collections, and add or remove Resources.

<a id="fr-co-02"></a>
### FR-CO-02 · Name is required and unique

**Status:** Specified · **Confluence:** CO-02

The name is required and unique.

<a id="fr-co-03"></a>
### FR-CO-03 · Description is required

**Status:** Specified · **Confluence:** CO-03

The description is required, and says which functional domain of Immoscoop the Collection covers.

<a id="fr-co-04"></a>
### FR-CO-04 · Colour is required and comes from the palette

**Status:** Specified · **Confluence:** CO-04

The colour is required and comes from the [colour palette](#colour-palette). More Collections are possible than there are colours: a colour may therefore recur, and together with the icon a Collection stays recognisable.

<a id="fr-co-05"></a>
### FR-CO-05 · Icon is optional and comes from the fixed set

**Status:** Specified · **Confluence:** CO-05

The icon is optional and comes from the fixed set of line icons.

<a id="fr-co-06"></a>
### FR-CO-06 · Exactly one Owner Unit

**Status:** Specified · **Confluence:** CO-06

The Owner is required: exactly one Owner Unit, a Google group following the [convention from User management](02-user-management.md#naming-convention).

<a id="fr-co-07"></a>
### FR-CO-07 · A Resource is in at most one Collection

**Status:** Specified · **Confluence:** CO-07

A Resource is in at most one Collection. Adding a Resource to a Collection makes it available to the Owner of that Collection. A Resource without a Collection has no Owner, and so cannot go beyond Described.

<a id="fr-co-08"></a>
### FR-CO-08 · Add or remove, never move

**Status:** Specified · **Confluence:** CO-08

Resources are only added or removed; moving does not exist. Whoever wants a Resource in another Collection removes it and adds it again. On removal it loses its Owner and drops to Described; in the new Collection, the new Owner confirms it again.

<a id="fr-co-09"></a>
### FR-CO-09 · The Owner Unit can change; Confirmations remain valid

**Status:** Specified · **Confluence:** CO-09

The Owner Unit of a Collection can be changed. The existing Confirmations of its Resources remain valid.

<a id="fr-co-10"></a>
### FR-CO-10 · Only an empty Collection can be dissolved

**Status:** Specified · **Confluence:** CO-10

A Collection can only be dissolved when it is empty.

<a id="fr-co-11"></a>
### FR-CO-11 · Every change is logged, append-only

**Status:** Specified · **Confluence:** CO-11

Every change goes into the Log and is kept append-only: creating, changing fields, changing Owner, adding and removing Resources, and dissolving.

## Edge cases

Proposals to confirm.

<a id="ec-co-01"></a>
### EC-CO-01 · The Owner Unit is dissolved in Workspace

**Status:** Proposed

The Collection is then without an Owner. It is flagged, the Data Team gets a notification, and for its Resources the rule that [User management](02-user-management.md) sets for an Owner Unit that empties applies (see [EC-UM-01](02-user-management.md#ec-um-01)).

<a id="ec-co-02"></a>
### EC-CO-02 · A Resource disappears from the Stacks

**Status:** Proposed

It also disappears from its Collection, and that goes into the Log of the Collection.

## Out of scope

What an Owner may see and do ([Permissions and library cards](12-permissions-and-library-cards.md)), how the Level of a Resource is determined ([Maturity and release](06-maturity-and-release.md)), and which views in the Stacks are Resources ([Stacks and resources](04-stacks-and-resources.md)).

## Open points

- [ ] <a id="op-co-01"></a>**OP-CO-01** · Ask Daniel's team which set of SVG line icons they use, and adopt it. Candidates if they have no fixed set yet: Lucide, Tabler Icons or Phosphor.
- [ ] <a id="op-co-02"></a>**OP-CO-02** · Let Daniel know that Collections use the Paul Tol palette as a recognition colour in the interface, separate from the chart language.
- [ ] <a id="op-co-03"></a>**OP-CO-03** · Decide the first Collections, starting from the pilot with DigiKom and the agencies case.
- [ ] <a id="op-co-04"></a>**OP-CO-04** · Work out the line of thought of whether promotion happens within a Collection.
- [ ] <a id="op-co-05"></a>**OP-CO-05** · Confirm or adjust the edge cases above.

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [User management](02-user-management.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
