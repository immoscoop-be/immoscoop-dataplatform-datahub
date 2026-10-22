# Collections

| | |
| --- | --- |
| Domain | 3 of Data Hub · code `CO` |
| Type | Working document |
| Tags | context, decision, governance |
| Area | Tooling, Technical |
| Status | Specified; Collections and their Resources implemented; the icon and the edge cases remain |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Collecties](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371504655) (Confluence, Dutch), last modified 2026-10-15, migrated 2026-10-17 |
| Last decisions | 2026-10-19: anyone creates a Collection, any Google group can be its Owner Unit, and a Collection is private or public ([DEC-CO-08](#dec-co-08) to [DEC-CO-12](#dec-co-12)); its icon is any outline icon of Tabler Icons but the logos of brands ([DEC-CO-13](#dec-co-13), [DEC-CO-14](#dec-co-14)) |

**In one sentence:** a Collection is a functional domain of Immoscoop, such as web visits, leads or agencies, in which the Resources of that domain sit together under one Owner Unit; anyone can create one, and it is private or public.

*Functional domain 3 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: just as a library arranges its shelves into collections, each with a curator who vouches for it, Data Hub arranges its Resources into Collections, each with an Owner Unit.

> **Note:** not to be confused with a dataset in BigQuery, such as the Stacks themselves. That is why we deliberately speak of a Collection.

## Decisions

- <a id="dec-co-01"></a>**DEC-CO-01** · We speak of a Collection, not of a dataset or data set, to avoid confusion with the datasets of BigQuery.
- <a id="dec-co-02"></a>**DEC-CO-02** · A Collection is a functional domain of Immoscoop, not of the data and not of the Domain Model. It exists only in Data Hub.
- <a id="dec-co-03"></a>**DEC-CO-03** · Only the Data Team manages Collections: the members of the Role Group of the Data Team from [User management](02-user-management.md). *Note of 2026-10-19: anyone creates a Collection, and its Owner Unit manages it with the Data Team; adding and removing Resources stays with the Data Team ([DEC-CO-08](#dec-co-08)).*
- <a id="dec-co-04"></a>**DEC-CO-04** · Every Collection has exactly one Owner Unit, a Group from [User management](02-user-management.md). The Owner of a Resource is the Owner of its Collection. *Note of 2026-10-19: the Owner Unit can be any Google group of the own Workspace domain, without a Naming Convention ([DEC-CO-09](#dec-co-09)).*
- <a id="dec-co-05"></a>**DEC-CO-05** · A Resource is in at most one Collection. It can be added and removed, but not moved. *Confirmed on 2026-10-19: one Owner Unit vouches for a Resource; everyone who can see it can still use it.*
- <a id="dec-co-06"></a>**DEC-CO-06** · When the Owner Unit of a Collection changes, the existing Confirmations remain valid.
- <a id="dec-co-07"></a>**DEC-CO-07** · The colour of a Collection comes from a researched, colour-blind-safe palette for charts: the "muted" palette by Paul Tol. *Note of 2026-10-22: the [design](../../design/principles.md#colour) has a palette of six colours; which one applies is open ([OP-UX-08](../../design/principles.md#op-ux-08)).*
- <a id="dec-co-08"></a>**DEC-CO-08** · Anyone who can sign in to Data Hub can create a Collection. Its Owner Unit and the Data Team manage it: they change its fields, its Owner Unit and whether it is public, and dissolve it. Adding and removing Resources stays with the Data Team, as part of the Registration ([DEC-SR-03](04-stacks-and-resources.md#dec-sr-03)). This replaces [DEC-CO-03](#dec-co-03). Whoever creates a Collection owns Resources only once the Data Team adds them to it. *Note of 2026-10-22: the workshop proposes that the Owner chooses the Resources; see [OP-CO-10](#op-co-10).*
- <a id="dec-co-09"></a>**DEC-CO-09** · The Owner Unit of a Collection is one Google group of the own Workspace domain, chosen from the groups the person choosing it is in, nested groups included. It needs no Naming Convention. It stays exactly one Owner Unit ([DEC-CO-04](#dec-co-04)); the Owner Unit can be changed, again to one of the groups of whoever changes it. This replaces the Naming Convention for Owner Units of [DEC-UM-04](02-user-management.md#dec-um-04).
- <a id="dec-co-10"></a>**DEC-CO-10** · A Collection is private or public. A private Collection is visible to the members of its Owner Unit and to the Data Team; a public Collection is visible to every User. Whoever creates a Collection chooses; the Owner Unit and the Data Team can switch it later.
- <a id="dec-co-11"></a>**DEC-CO-11** · The Data Team sees every Collection, private ones included, so that it can add Resources to them and help their Owners. *Note of 2026-10-22: the workshop proposes that only the owners see a private Collection; see [OP-CO-09](#op-co-09).*
- <a id="dec-co-12"></a>**DEC-CO-12** · A Resource is visible to everyone who sees its Collection only once its Owner has published it: the first Publication is the first Confirmation ([DEC-SR-07](04-stacks-and-resources.md#dec-sr-07)). Until then, only the Owner Unit and the Data Team see it. In a public Collection, the Publication thus opens a Resource to the whole company. This replaces "visible to the whole company" in [DEC-SR-06](04-stacks-and-resources.md#dec-sr-06) and [DEC-DH-40](../../overview/data-hub.md#dec-dh-40).
- <a id="dec-co-13"></a>**DEC-CO-13** · The icon of a Collection comes from Tabler Icons (MIT licence), the outline icons on a 24-pixel grid with a 2-pixel line, as the icons of the web app itself. Not the whole set of some 5,000 icons, but a list chosen for the functional domains of Immoscoop, kept in one place for catalogue and the web app; a new icon is a change to that list. Tabler has a Figma plugin, so designs can use the same set. This answers [OP-CO-01](#op-co-01). *Note of 2026-10-19: the chosen list is replaced by [DEC-CO-14](#dec-co-14): every outline icon but the logos of brands.*
- <a id="dec-co-14"></a>**DEC-CO-14** · A Collection can carry any outline icon of Tabler Icons except the logos of brands (Tabler's category Brand): some 4,800 icons, so that every functional domain finds its own. The web app does not take them all on board: it loads the drawing of an icon only where it shows one, and the list to choose from only when a Collection is created or edited. Choosing is searching, by the name of an icon and the words Tabler gives it, so that "house" finds the home and "money" finds coins and the wallet; the results are grouped by Tabler's category. Before anything is typed, the choice shows a short list of suggestions for the functional domains of Immoscoop. This replaces the chosen list of [DEC-CO-13](#dec-co-13). *Note of 2026-10-22: the [design](../../design/principles.md#icons) takes Phosphor for every icon; which family applies is open ([OP-UX-07](../../design/principles.md#op-ux-07)).*

## What a Collection has

| Field | Required | Explanation |
| --- | --- | --- |
| Name | Yes | Unique within Data Hub |
| Description | Yes | Short: which functional domain of Immoscoop the Collection covers |
| Colour | Yes | From the [colour palette](#colour-palette) below |
| Icon | No | Any outline icon of Tabler Icons but the logos of brands ([DEC-CO-13](#dec-co-13), [DEC-CO-14](#dec-co-14)) |
| Owner | Yes | Exactly one Owner Unit: a Google group of the own Workspace domain that the one choosing it is in ([DEC-CO-09](#dec-co-09)) |
| Visibility | Yes | Private or public ([DEC-CO-10](#dec-co-10)) |

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

1. **Create.** Anyone creates a Collection, with a name, description, colour, optionally an icon, an Owner Unit from their own groups, and private or public.
2. **Add Resources.** The Data Team adds Resources, which come from the exposures in the dbt projects ([DEC-SR-22](04-stacks-and-resources.md#dec-sr-22)). With that, the Data Team makes them available to the Owner: step one of the Release.
3. **Publish.** The Owner publishes the Resources, and thereby confirms them. They are then visible to everyone who sees the Collection: in a public Collection, the whole company.
4. **Manage.** The Owner Unit and the Data Team change the fields, hand the Collection to another Owner Unit, or switch it between private and public.
5. **Remove Resources.** The Data Team can take a Resource out of the Collection again.
6. **Dissolve.** An empty Collection can be dissolved.

## Requirements

<a id="fr-co-01"></a>
### FR-CO-01 · Only the Data Team manages Collections

**Status:** Withdrawn · **Confluence:** CO-01

Only members of the Role Group of the Data Team can create, change and dissolve Collections, and add or remove Resources.

*Withdrawn on 2026-10-19: replaced by [FR-CO-12](#fr-co-12), [FR-CO-13](#fr-co-13) and [FR-CO-14](#fr-co-14) ([DEC-CO-08](#dec-co-08)).*

<a id="fr-co-02"></a>
### FR-CO-02 · Name is required and unique

**Status:** Implemented · **Confluence:** CO-02

The name is required and unique.

<a id="fr-co-03"></a>
### FR-CO-03 · Description is required

**Status:** Implemented · **Confluence:** CO-03

The description is required, and says which functional domain of Immoscoop the Collection covers.

<a id="fr-co-04"></a>
### FR-CO-04 · Colour is required and comes from the palette

**Status:** Implemented · **Confluence:** CO-04

The colour is required and comes from the [colour palette](#colour-palette). More Collections are possible than there are colours: a colour may therefore recur, and together with the icon a Collection stays recognisable.

<a id="fr-co-05"></a>
### FR-CO-05 · Icon is optional and comes from the fixed set

**Status:** Implemented · **Confluence:** CO-05

The icon is optional and comes from the fixed set of line icons.

<a id="fr-co-06"></a>
### FR-CO-06 · Exactly one Owner Unit

**Status:** Withdrawn · **Confluence:** CO-06

The Owner is required: exactly one Owner Unit, a Google group following the [convention from User management](02-user-management.md#naming-convention).

*Withdrawn on 2026-10-19: replaced by [FR-CO-15](#fr-co-15), without the Naming Convention ([DEC-CO-09](#dec-co-09)).*

<a id="fr-co-07"></a>
### FR-CO-07 · A Resource is in at most one Collection

**Status:** Implemented · **Confluence:** CO-07

A Resource is in at most one Collection. Adding a Resource to a Collection makes it available to the Owner of that Collection. A Resource without a Collection has no Owner, and so cannot go beyond Described.

<a id="fr-co-08"></a>
### FR-CO-08 · Add or remove, never move

**Status:** Implemented · **Confluence:** CO-08

Resources are only added or removed; moving does not exist. Whoever wants a Resource in another Collection removes it and adds it again. On removal it loses its Owner and drops to Described; in the new Collection, the new Owner confirms it again.

<a id="fr-co-09"></a>
### FR-CO-09 · The Owner Unit can change; Confirmations remain valid

**Status:** Specified · **Confluence:** CO-09

The Owner Unit of a Collection can be changed. The existing Confirmations of its Resources remain valid.

<a id="fr-co-10"></a>
### FR-CO-10 · Only an empty Collection can be dissolved

**Status:** Implemented · **Confluence:** CO-10

A Collection can only be dissolved when it is empty.

<a id="fr-co-11"></a>
### FR-CO-11 · Every change is logged, append-only

**Status:** Implemented · **Confluence:** CO-11

Every change goes into the Log and is kept append-only: creating, changing fields, changing Owner, adding and removing Resources, and dissolving.

<a id="fr-co-12"></a>
### FR-CO-12 · Anyone creates a Collection

**Status:** Implemented

Every User can create a Collection. Creating one gives no Resources: those come only when the Data Team adds them ([FR-CO-14](#fr-co-14)).

<a id="fr-co-13"></a>
### FR-CO-13 · The Owner Unit and the Data Team manage a Collection

**Status:** Implemented

The members of the Owner Unit of a Collection and the members of the Role Group of the Data Team can change its name, description, colour and icon, hand it to another Owner Unit, make it private or public, and dissolve it. Nobody else can.

<a id="fr-co-14"></a>
### FR-CO-14 · Only the Data Team adds and removes Resources

**Status:** Implemented

Only members of the Role Group of the Data Team add Resources to a Collection and remove them, also in a Collection whose Owner Unit they are not in.

<a id="fr-co-15"></a>
### FR-CO-15 · Exactly one Owner Unit, from the groups of whoever chooses it

**Status:** Implemented

The Owner is required: exactly one Owner Unit, a Google group of the own Workspace domain. Whoever creates a Collection or hands it to another Owner Unit can only choose a group they are in themselves, nested groups included. The Owner Unit is recognised by its fixed Google ID ([FR-UM-08](02-user-management.md#fr-um-08)).

<a id="fr-co-16"></a>
### FR-CO-16 · A Collection is private or public

**Status:** Implemented

Every Collection is private or public. Whoever creates it chooses, private unless they choose otherwise; afterwards the Owner Unit and the Data Team can switch it ([FR-CO-13](#fr-co-13)).

<a id="fr-co-17"></a>
### FR-CO-17 · Who sees a Collection

**Status:** Implemented

A public Collection is visible to every User. A private Collection is visible only to the members of its Owner Unit and to the Data Team. To anyone else, a private Collection does not exist: it is not listed, and asking for it gives the same answer as for a Collection that does not exist. Which of its Resources someone sees is set by [FR-SR-31](04-stacks-and-resources.md#fr-sr-31).

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

What someone may see and do beyond Collections ([Permissions and library cards](12-permissions-and-library-cards.md)), how the Level of a Resource is determined ([Maturity and release](06-maturity-and-release.md)), and which views in the Stacks are Resources ([Stacks and resources](04-stacks-and-resources.md)).

## Open points

- [x] <a id="op-co-01"></a>**OP-CO-01** · Ask Daniel's team which set of SVG line icons they use, and adopt it. Candidates if they have no fixed set yet: Lucide, Tabler Icons or Phosphor. *Decided on 2026-10-19: Tabler Icons ([DEC-CO-13](#dec-co-13)).*
- [ ] <a id="op-co-02"></a>**OP-CO-02** · Let Daniel know that Collections use the Paul Tol palette as a recognition colour in the interface, separate from the chart language.
- [ ] <a id="op-co-03"></a>**OP-CO-03** · Decide the first Collections, starting from the pilot with DigiKom and the agencies case.
- [ ] <a id="op-co-04"></a>**OP-CO-04** · Work out the line of thought of whether promotion happens within a Collection.
- [ ] <a id="op-co-05"></a>**OP-CO-05** · Confirm or adjust the edge cases above.
- [ ] <a id="op-co-06"></a>**OP-CO-06** · Decide how the Data Team hands a Collection to an Owner Unit it is not in itself, for example when the Owner Unit is dissolved in Workspace ([EC-CO-01](#ec-co-01)). Today, only a group of whoever changes the Owner Unit can be chosen ([FR-CO-15](#fr-co-15)). *Raised on 2026-10-19.*
- [ ] <a id="op-co-07"></a>**OP-CO-07** · Decide who may see and build dashboards, Lenses and Reports, on the Resources of a Collection. Proposal of 2026-10-19: everyone may build on every Resource they can see, and a dashboard is visible only to whoever sees its Collection and every Resource under it, so that a public dashboard never shows a private Resource. *Raised on 2026-10-19.*
- [ ] <a id="op-co-09"></a>**OP-CO-09** · The workshop of 2026-10-22 proposes that a private Collection is visible only to its owners, and to nobody else ([REQ-DH-COLL](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-coll)). [DEC-CO-10](#dec-co-10), [DEC-CO-11](#dec-co-11) and [FR-CO-17](#fr-co-17) let the Data Team see every private Collection too, so that it can add Resources and help their Owners. Decide whether that stays. *Raised while taking in the workshop of 2026-10-22.*
- [ ] <a id="op-co-10"></a>**OP-CO-10** · The workshop of 2026-10-22 proposes that the Owner decides, per Resource, what is in a Collection and whether it is public ([REQ-DH-COLL](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-coll)). Publishing is already up to the Owner ([FR-SR-16](04-stacks-and-resources.md#fr-sr-16)); adding and removing Resources is up to the Data Team ([DEC-CO-08](#dec-co-08), [FR-CO-14](#fr-co-14)). Decide whether the Owner also chooses the Resources of their Collection. *Raised while taking in the workshop of 2026-10-22.*

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [User management](02-user-management.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
