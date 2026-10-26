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
| Last decisions | 2026-10-19: anyone creates a Collection, any Google group can be its Owner Unit, and a Collection is private or public ([DEC-CO-08](#dec-co-08) to [DEC-CO-12](#dec-co-12)); its icon is any outline icon of Tabler Icons but the logos of brands ([DEC-CO-13](#dec-co-13), [DEC-CO-14](#dec-co-14)). 2026-10-22: one panel in which a Collection unfolds to its Resources ([FR-CO-18](#fr-co-18) to [FR-CO-24](#fr-co-24)). 2026-10-23: a page per Collection ([FR-CO-25](#fr-co-25) to [FR-CO-31](#fr-co-31)), and only its Owner Unit adds Lenses and edits it ([DEC-CO-15](#dec-co-15)). 2026-10-25: adding Resources records the relation of every field and how a Resource is stored ([FR-CO-33](#fr-co-33), [FR-CO-34](#fr-co-34)); everyone builds Lenses on what they can see, and the Data Team may do everything in every Collection ([DEC-CO-17](#dec-co-17), [DEC-CO-18](#dec-co-18), [FR-CO-35](#fr-co-35)); icons come from Phosphor ([DEC-CO-19](#dec-co-19)) |

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
- <a id="dec-co-07"></a>**DEC-CO-07** · The colour of a Collection comes from a researched, colour-blind-safe palette for charts: the "muted" palette by Paul Tol. *Note of 2026-10-22: the [design](../../design/principles.md#colour) has a palette of six colours; which one applies is open ([OP-UX-08](../../design/principles.md#op-ux-08)).* *Note of 2026-10-25: the palette now lives in a configuration file that grows over time; it keeps the nine colours of the muted palette next to the six of the design, until testing on uat shows which stay ([DEC-UX-60](../../design/principles.md#dec-ux-60)).*
- <a id="dec-co-08"></a>**DEC-CO-08** · Anyone who can sign in to Data Hub can create a Collection. Its Owner Unit and the Data Team manage it: they change its fields, its Owner Unit and whether it is public, and dissolve it. Adding and removing Resources stays with the Data Team, as part of the Registration ([DEC-SR-03](04-stacks-and-resources.md#dec-sr-03)). This replaces [DEC-CO-03](#dec-co-03). Whoever creates a Collection owns Resources only once the Data Team adds them to it. *Note of 2026-10-22: confirmed after the workshop proposed that the Owner chooses the Resources ([OP-CO-10](#op-co-10)).*
- <a id="dec-co-09"></a>**DEC-CO-09** · The Owner Unit of a Collection is one Google group of the own Workspace domain, chosen from the groups the person choosing it is in, nested groups included. It needs no Naming Convention. It stays exactly one Owner Unit ([DEC-CO-04](#dec-co-04)); the Owner Unit can be changed, again to one of the groups of whoever changes it. This replaces the Naming Convention for Owner Units of [DEC-UM-04](02-user-management.md#dec-um-04).
- <a id="dec-co-10"></a>**DEC-CO-10** · A Collection is private or public. A private Collection is visible to the members of its Owner Unit and to the Data Team; a public Collection is visible to every User. Whoever creates a Collection chooses; the Owner Unit and the Data Team can switch it later.
- <a id="dec-co-11"></a>**DEC-CO-11** · The Data Team sees every Collection, private ones included, so that it can add Resources to them and help their Owners. *Note of 2026-10-22: confirmed after the workshop proposed that only the owners see a private Collection ([OP-CO-09](#op-co-09)).*
- <a id="dec-co-12"></a>**DEC-CO-12** · A Resource is visible to everyone who sees its Collection only once its Owner has published it: the first Publication is the first Confirmation ([DEC-SR-07](04-stacks-and-resources.md#dec-sr-07)). Until then, only the Owner Unit and the Data Team see it. In a public Collection, the Publication thus opens a Resource to the whole company. This replaces "visible to the whole company" in [DEC-SR-06](04-stacks-and-resources.md#dec-sr-06) and [DEC-DH-40](../../overview/data-hub.md#dec-dh-40).
- <a id="dec-co-13"></a>**DEC-CO-13** · The icon of a Collection comes from Tabler Icons (MIT licence), the outline icons on a 24-pixel grid with a 2-pixel line, as the icons of the web app itself. Not the whole set of some 5,000 icons, but a list chosen for the functional domains of Immoscoop, kept in one place for catalogue and the web app; a new icon is a change to that list. Tabler has a Figma plugin, so designs can use the same set. This answers [OP-CO-01](#op-co-01). *Note of 2026-10-19: the chosen list is replaced by [DEC-CO-14](#dec-co-14): every outline icon but the logos of brands.* *Note of 2026-10-25: the family is replaced by [DEC-CO-19](#dec-co-19): Phosphor.*
- <a id="dec-co-14"></a>**DEC-CO-14** · A Collection can carry any outline icon of Tabler Icons except the logos of brands (Tabler's category Brand): some 4,800 icons, so that every functional domain finds its own. The web app does not take them all on board: it loads the drawing of an icon only where it shows one, and the list to choose from only when a Collection is created or edited. Choosing is searching, by the name of an icon and the words Tabler gives it, so that "house" finds the home and "money" finds coins and the wallet; the results are grouped by Tabler's category. Before anything is typed, the choice shows a short list of suggestions for the functional domains of Immoscoop. This replaces the chosen list of [DEC-CO-13](#dec-co-13). *Note of 2026-10-22: the [design](../../design/principles.md#icons) takes Phosphor for every icon; which family applies is open ([OP-UX-07](../../design/principles.md#op-ux-07)).* *Note of 2026-10-25: replaced by [DEC-CO-19](#dec-co-19) for the family; choosing by searching, and leaving out the logos of brands, stay.*
- <a id="dec-co-15"></a>**DEC-CO-15** · A Collection also holds Lenses. Only its Owner Unit adds Lenses to it, changes them, and edits the Collection: a User who does not own a Collection cannot change it. This extends [DEC-DH-64](../../overview/data-hub.md#dec-dh-64), where a Collection groups Resources only. Adding and removing Resources stays with the Data Admins ([DEC-CO-08](#dec-co-08)); whether the Data Team keeps editing every Collection is open ([OP-CO-12](#op-co-12)). *Decided on 2026-10-23, with the page of a Collection.* *Note of 2026-10-25: the Data Team may do the same in every Collection ([DEC-CO-18](#dec-co-18)).*
- <a id="dec-co-16"></a>**DEC-CO-16** · A User sees a Lens only when they may use every Resource beneath it ([FR-SR-31](04-stacks-and-resources.md#fr-sr-31)). *Decided on 2026-10-23, for the Lenses of [OP-CO-07](#op-co-07).*
- <a id="dec-co-17"></a>**DEC-CO-17** · Everyone may build Lenses on every Resource they can see. Who sees a Lens stays [DEC-CO-16](#dec-co-16); adding a Lens to a Collection stays with its Owner Unit and the Data Team ([DEC-CO-15](#dec-co-15), [DEC-CO-18](#dec-co-18)). *Decided on 2026-10-25, by Max ([OP-CO-07](#op-co-07)).*
- <a id="dec-co-18"></a>**DEC-CO-18** · The Data Team may do everything in every Collection, also one it does not own: change its details, hand it to another Owner Unit ([FR-CO-35](#fr-co-35)), add and change its Lenses, add and remove its Resources, and dissolve it. *Decided on 2026-10-25, by Max ([OP-CO-12](#op-co-12)).*
- <a id="dec-co-19"></a>**DEC-CO-19** · The icon of a Collection comes from [Phosphor](https://phosphoricons.com) (MIT licence), the one family of the design ([icons](../../design/principles.md#icons)). The light weight is favoured and is the default; the other weights of Phosphor are possible too. As before, choosing is searching by the name of an icon and its words, and the logos of brands are left out. This replaces Tabler Icons of [DEC-CO-13](#dec-co-13) and [DEC-CO-14](#dec-co-14). *Decided on 2026-10-25, by Max ([OP-UX-07](../../design/principles.md#op-ux-07)).*

## What a Collection has

| Field | Required | Explanation |
| --- | --- | --- |
| Name | Yes | Unique within Data Hub |
| Description | Yes | Short: which functional domain of Immoscoop the Collection covers |
| Colour | Yes | From the [colour palette](#colour-palette) below |
| Icon | No | Any icon of Phosphor but the logos of brands, the light weight by default ([DEC-CO-19](#dec-co-19)) |
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

*Note of 2026-10-25: the Data Team can choose any group of the domain ([FR-CO-35](#fr-co-35)).*

<a id="fr-co-16"></a>
### FR-CO-16 · A Collection is private or public

**Status:** Implemented

Every Collection is private or public. Whoever creates it chooses, private unless they choose otherwise; afterwards the Owner Unit and the Data Team can switch it ([FR-CO-13](#fr-co-13)).

<a id="fr-co-17"></a>
### FR-CO-17 · Who sees a Collection

**Status:** Implemented

A public Collection is visible to every User. A private Collection is visible only to the members of its Owner Unit and to the Data Team. To anyone else, a private Collection does not exist: it is not listed, and asking for it gives the same answer as for a Collection that does not exist. Which of its Resources someone sees is set by [FR-SR-31](04-stacks-and-resources.md#fr-sr-31).

## The panel of Collections

How a User finds the Collections and their Resources in the web app: one panel, in which a Collection unfolds ([DEC-UX-10](../../design/principles.md#dec-ux-10)). The screens are in the [design](../../design/principles.md#what-is-in-the-panel).

<a id="fr-co-18"></a>
### FR-CO-18 · One list of Collections, each unfolding to what it holds

**Status:** Specified · **Source:** [DEC-UX-10](../../design/principles.md#dec-ux-10)

The panel of Collections lists every Collection the User sees ([FR-CO-17](#fr-co-17)). A Collection unfolds in place to show the Resources in it that the User sees ([FR-SR-31](04-stacks-and-resources.md#fr-sr-31)); the arrow next to it folds and unfolds it. Several Collections can be unfolded at once. There is no separate list per Collection. For the Data Team, the Resources without a Collection ([FR-SR-35](04-stacks-and-resources.md#fr-sr-35)) are on top, and unfold the same way.

*Note of 2026-10-23: clicking the Collection itself opens its page ([FR-CO-25](#fr-co-25)); only the arrow folds it.*

*Note of 2026-10-26: the Lenses of the Collection are listed too, after its Resources ([FR-CO-36](#fr-co-36)).*

<a id="fr-co-19"></a>
### FR-CO-19 · Opening a Resource unfolds its Collection

**Status:** Specified · **Source:** [DEC-UX-10](../../design/principles.md#dec-ux-10)

When a User opens a Resource, its Collection is unfolded in the panel, and the Resource is marked as the one that is open.

<a id="fr-co-20"></a>
### FR-CO-20 · An item shows the icon of its kind, its name and its Level

**Status:** Specified · **Source:** [DEC-UX-11](../../design/principles.md#dec-ux-11)

Each item in an unfolded Collection shows the icon of its kind, the same for every item of that kind (a table for a Resource), its Display Name, and its Level ([FR-MR-10](06-maturity-and-release.md#fr-mr-10)).

<a id="fr-co-21"></a>
### FR-CO-21 · Every name takes one line

**Status:** Specified · **Source:** [DEC-UX-10](../../design/principles.md#dec-ux-10)

In the panel, the name of a Collection or of an item takes one line. A name that is too long ends in an ellipsis and is shown in full on hover.

<a id="fr-co-22"></a>
### FR-CO-22 · A Resource that is not published is shown as such

**Status:** Specified · **Source:** [DEC-UX-12](../../design/principles.md#dec-ux-12)

A Resource that is not published, which only its Owner Unit and the Data Team see ([DEC-CO-12](#dec-co-12)), is shown in a lighter grey in the panel, without an icon. Hovering over it says that it is not published, and so does a screen reader.

<a id="fr-co-23"></a>
### FR-CO-23 · A long Collection shows its first eight items

**Status:** Specified · **Source:** [DEC-UX-10](../../design/principles.md#dec-ux-10)

An unfolded Collection shows its first eight items, then "Show all" with the number of items, which shows the rest.

*Note of 2026-10-26: the Lenses of the Collection are listed too, after its Resources ([FR-CO-36](#fr-co-36)).*

<a id="fr-co-24"></a>
### FR-CO-24 · Search in the panel covers Collections and their Resources

**Status:** Specified · **Source:** [DEC-UX-10](../../design/principles.md#dec-ux-10)

Search in the panel filters the Collections and their Resources together. A Collection whose name matches stays listed as it was; a Collection that holds a matching Resource unfolds and shows only the matching Resources. When nothing matches, the panel says so.

*Note of 2026-10-26: the Lenses of the Collection are listed too, after its Resources ([FR-CO-36](#fr-co-36)).*

<a id="fr-co-36"></a>
### FR-CO-36 · An unfolded Collection lists its Lenses too

**Status:** Specified · **Source:** Max, 2026-10-26 ([OP-UX-15](../../design/principles.md#op-ux-15))

An unfolded Collection lists, after its Resources and without a label of their own, the Lenses its Owner Unit added to it ([FR-CO-28](#fr-co-28)) that the User sees ([DEC-CO-16](#dec-co-16)), each with the icon of its kind, its name and its Level. Each group shows its first eight, then "Show all". Search in the panel covers the Lenses as well. Reports join later as a group of their own.

## The page of a Collection

What a User sees and does on the page of a Collection ([DEC-UX-13](../../design/principles.md#dec-ux-13), [DEC-UX-14](../../design/principles.md#dec-ux-14)). The screens are in the [design](../../design/principles.md#page-of-a-collection). Specified on 2026-10-23, when the design was approved.

<a id="fr-co-25"></a>
### FR-CO-25 · Clicking a Collection opens its page

**Status:** Specified · **Source:** [DEC-UX-13](../../design/principles.md#dec-ux-13)

Clicking a Collection in the panel opens its page and unfolds it in the panel ([FR-CO-18](#fr-co-18)).

<a id="fr-co-26"></a>
### FR-CO-26 · The page says what the Collection is and what needs attention

**Status:** Specified · **Source:** [DEC-UX-14](../../design/principles.md#dec-ux-14)

The page shows the icon, name and description of the Collection, its Owner Unit, whether it is private or public, the number of Resources and Lenses, and when and by whom it was created. To the Owner Unit and the Data Team it also shows what needs attention: a Level that dropped and waits for a Confirmation, open Signals, and Resources not published yet, each with a link to where it is solved.

<a id="fr-co-27"></a>
### FR-CO-27 · The page lists the Resources of the Collection

**Status:** Specified · **Source:** [DEC-UX-14](../../design/principles.md#dec-ux-14)

The page lists every Resource of the Collection that the User sees ([FR-SR-31](04-stacks-and-resources.md#fr-sr-31)), with its Display Name, Level, Publication, open Signals and last change.

<a id="fr-co-28"></a>
### FR-CO-28 · The page lists the Lenses built on the Collection

**Status:** Specified · **Source:** [DEC-UX-14](../../design/principles.md#dec-ux-14)

The page lists the Lenses in the Collection, which its Owner Unit added ([DEC-CO-15](#dec-co-15)), with their name, type, what they are built on, their weight ([FR-LE-02](09-lenses.md#fr-le-02)) and their Level ([DEC-DH-10](../../overview/data-hub.md#dec-dh-10)).

*Note of 2026-10-23: without their weight, since [FR-LE-02](09-lenses.md#fr-le-02) is withdrawn ([DEC-UX-24](../../design/principles.md#dec-ux-24)).*

<a id="fr-co-29"></a>
### FR-CO-29 · A Lens is started from the page of a Collection

**Status:** Specified · **Source:** [DEC-UX-14](../../design/principles.md#dec-ux-14)

From the page of a Collection, its Owner Unit starts a new Lens in it ([DEC-CO-15](#dec-co-15)); nobody else can. Whether such a Lens may also use Resources of other Collections is open ([OP-CO-07](#op-co-07)), and so is how the story is asked first ([FR-LE-05](09-lenses.md#fr-le-05), [OP-LE-01](09-lenses.md#op-le-01)).

*Note of 2026-10-25: the Data Team can start one too ([DEC-CO-18](#dec-co-18)), and everyone may build Lenses on every Resource they can see ([DEC-CO-17](#dec-co-17)), so such a Lens can use Resources of other Collections.*

<a id="fr-co-30"></a>
### FR-CO-30 · The details are edited on the page

**Status:** Specified · **Source:** [DEC-UX-14](../../design/principles.md#dec-ux-14)

The Owner Unit edits the details of the Collection on its page ([DEC-CO-15](#dec-co-15)); whether the Data Team does too, as [FR-CO-13](#fr-co-13) has it, is open ([OP-CO-12](#op-co-12)). The details are the name, description, colour, icon, Owner Unit and whether it is private or public. Dissolving is offered there too, and only possible for an empty Collection ([FR-CO-10](#fr-co-10)).

*Note of 2026-10-25: the Data Team edits the details too, on every Collection ([DEC-CO-18](#dec-co-18)).*

<a id="fr-co-31"></a>
### FR-CO-31 · A Data Admin adds Resources from the page

**Status:** Specified · **Source:** [DEC-UX-14](../../design/principles.md#dec-ux-14)

From the page of a Collection, a Data Admin picks one or more Resources without a Collection ([FR-SR-35](04-stacks-and-resources.md#fr-sr-35)) and adds them, and removes a Resource again ([FR-CO-14](#fr-co-14)). Only Resources without a Collection can be picked ([FR-CO-07](#fr-co-07), [FR-CO-08](#fr-co-08)). Every addition and removal goes into the Log.

*Note of 2026-10-25: adding takes two steps; the second records how each Resource picked is stored and the relation of every field ([FR-CO-33](#fr-co-33), [FR-CO-34](#fr-co-34)).*


<a id="fr-co-32"></a>
### FR-CO-32 · A link to something a User may not see looks like a link to nothing

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#a-link-to-something-you-may-not-see)

A link to a Collection, Resource, Lens or query that a User may not see opens the same page as a link to something that does not exist ([FR-CO-17](#fr-co-17), [FR-SR-31](04-stacks-and-resources.md#fr-sr-31), [DEC-CO-16](#dec-co-16)). The page does not say which of the two it is. It tells the User to ask whoever sent the link, and lets them search what they may see.

<a id="fr-co-33"></a>
### FR-CO-33 · Adding a Resource records the relation of every field

**Status:** Proposed · **Source:** Max, 2026-10-24 and 2026-10-25 · [design](../../design/principles.md#page-of-a-collection)

After picking Resources ([FR-CO-31](#fr-co-31)), the Data Admin sees, per Resource, every field with its type and description from dbt. For each field they say which relation it has:

- **no relation;**
- **it identifies each row** of the Resource;
- **it refers to** an Entity.

A field that identifies each row or refers to an Entity gets an Entity identifier, written as `entity.identifier`, such as `agency.agencyId` ([FR-RC-08](05-resource-card.md#fr-rc-08)). It is a reference, not a join: Data Hub links every Resource that carries the same reference ([FR-RC-09](05-resource-card.md#fr-rc-09)), and says next to the field how many Resources that is. For a Resource built on a Colleciónes model, Data Hub fills in the relations its docs give; for another model, it suggests a reference where the name of a field matches an identifier of the Domain Model. The Data Admin checks them and can change each one. No relation is required. The Resources are added, with their relations, in one go, and the relations go into the Log with the addition.

*Note of 2026-10-25: what a relation records about its cardinality is under discussion ([OP-RC-07](05-resource-card.md#op-rc-07) to [OP-RC-17](05-resource-card.md#op-rc-17)); this step changes with it.*

<a id="fr-co-34"></a>
### FR-CO-34 · Adding a Resource records how it is stored

**Status:** Proposed · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#page-of-a-collection)

In the same step as the relations ([FR-CO-33](#fr-co-33)), the Data Admin sees per Resource how it is stored: its partition column and the unit of its partitions, its cluster columns in their order, and whether a partition filter is required. Data Hub derives them where it can, from the dbt manifest of the model beneath the view, through the lineage, and from BigQuery ([OP-SR-12](04-stacks-and-resources.md#op-sr-12)), and marks them "From dbt". The Data Admin sets what cannot be derived and can correct the rest. A partition filter that BigQuery requires stays required; the Data Admin can also require one where BigQuery does not, so that Data Hub asks for a filter on the partition column in every query on the Resource. Data Hub uses them on the page of the Resource ([FR-SR-39](04-stacks-and-resources.md#fr-sr-39)) and in the Pre-flight ([FR-SR-40](04-stacks-and-resources.md#fr-sr-40)).

<a id="fr-co-35"></a>
### FR-CO-35 · The Data Team hands a Collection to any group

**Status:** Specified · **Source:** Max, 2026-10-25 ([OP-CO-06](#op-co-06))

In the form to edit a Collection, a member of the Data Team can choose any Google group of the own Workspace domain as its Owner Unit, not only a group they are in themselves ([FR-CO-15](#fr-co-15)). This is how the Data Team hands a Collection to another Owner Unit, for example when its group is dissolved in Workspace ([EC-CO-01](#ec-co-01)). Choosing the group again also brings its name and address up to date ([OP-CO-08](../technical/03-collections.md#op-co-08)). The choice needs the groups of the whole domain, not only those of the User.

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
- [x] <a id="op-co-03"></a>**OP-CO-03** · Decide the first Collections, starting from the pilot with DigiKom and the agencies case. *Decided on 2026-10-25, by Max: no separate choice is needed; the first Collections are the ones the pilot makes first, with DigiKom and the agencies, and they are the first to be used.*
- [ ] <a id="op-co-04"></a>**OP-CO-04** · Work out the line of thought of whether promotion happens within a Collection.
- [ ] <a id="op-co-05"></a>**OP-CO-05** · Confirm or adjust the edge cases above.
- [x] <a id="op-co-06"></a>**OP-CO-06** · Decide how the Data Team hands a Collection to an Owner Unit it is not in itself, for example when the Owner Unit is dissolved in Workspace ([EC-CO-01](#ec-co-01)). Today, only a group of whoever changes the Owner Unit can be chosen ([FR-CO-15](#fr-co-15)). *Raised on 2026-10-19.* *Decided on 2026-10-25, by Max: in the form to edit a Collection, where the Data Team can choose any group of the domain as Owner Unit ([FR-CO-35](#fr-co-35)).*
- [x] <a id="op-co-07"></a>**OP-CO-07** · Decide who may see and build dashboards, Lenses and Reports, on the Resources of a Collection. Proposal of 2026-10-19: everyone may build on every Resource they can see, and a dashboard is visible only to whoever sees its Collection and every Resource under it, so that a public dashboard never shows a private Resource. *Raised on 2026-10-19.* *Note of 2026-10-23: only the Owner Unit adds Lenses to its Collection ([DEC-CO-15](#dec-co-15)); open remains whether such a Lens may use Resources of other Collections.* *Decided on 2026-10-23 for Lenses: a User sees a Lens only when they may use every Resource beneath it ([DEC-CO-16](#dec-co-16)). Reports and dashboards remain.* *Decided on 2026-10-25, by Max: everyone may build Lenses on every Resource they can see ([DEC-CO-17](#dec-co-17)). Reports and dashboards are not specified yet; they follow when their domain is.*
- [x] <a id="op-co-09"></a>**OP-CO-09** · The workshop of 2026-10-22 proposes that a private Collection is visible only to its owners, and to nobody else ([REQ-DH-COLL](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-coll)). [DEC-CO-10](#dec-co-10), [DEC-CO-11](#dec-co-11) and [FR-CO-17](#fr-co-17) let the Data Team see every private Collection too, so that it can add Resources and help their Owners. Decide whether that stays. *Raised while taking in the workshop of 2026-10-22.* *Decided on 2026-10-22: the Data Team keeps seeing private Collections ([DEC-CO-11](#dec-co-11)); "nobody else" in the workshop means no other colleagues.*
- [x] <a id="op-co-10"></a>**OP-CO-10** · The workshop of 2026-10-22 proposes that the Owner decides, per Resource, what is in a Collection and whether it is public ([REQ-DH-COLL](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-coll)). Publishing is already up to the Owner ([FR-SR-16](04-stacks-and-resources.md#fr-sr-16)); adding and removing Resources is up to the Data Team ([DEC-CO-08](#dec-co-08), [FR-CO-14](#fr-co-14)). Decide whether the Owner also chooses the Resources of their Collection. *Raised while taking in the workshop of 2026-10-22.* *Decided on 2026-10-22: the Data Team keeps adding and removing Resources ([DEC-CO-08](#dec-co-08)); the Owner decides per Resource whether it is published ([FR-SR-16](04-stacks-and-resources.md#fr-sr-16)).*
- [x] <a id="op-co-11"></a>**OP-CO-11** · Decide which Lenses the page of a Collection lists ([FR-CO-28](#fr-co-28)). Proposal: every Lens built on at least one of its Resources, so that a Lens over two Collections shows in both and needs no Collection of its own; this keeps a Collection a container of Resources ([DEC-DH-64](../../overview/data-hub.md#dec-dh-64)). *Raised on 2026-10-23.* *Decided on 2026-10-23: the Lenses its Owner Unit adds to it ([DEC-CO-15](#dec-co-15)).*
- [x] <a id="op-co-12"></a>**OP-CO-12** · Decide what the Data Team may do in a Collection it does not own. [DEC-CO-08](#dec-co-08) and [FR-CO-13](#fr-co-13), already built, let it edit every Collection; [DEC-CO-15](#dec-co-15) says that only who owns a Collection edits it and adds Lenses. Decide whether the Data Team keeps editing the details of every Collection, and whether it adds Lenses. Adding and removing Resources stays with the Data Admins either way. *Raised on 2026-10-23.* *Decided on 2026-10-25, by Max: the Data Team may do everything, in every Collection ([DEC-CO-18](#dec-co-18)).*
- [ ] <a id="op-co-13"></a>**OP-CO-13** · Decide whether a User can ask for access to something they may not see, and how ([FR-CO-32](#fr-co-32)). Asking on the page would tell them that it exists, which [FR-CO-17](#fr-co-17) rules out for a private Collection; and access comes from the Owner Unit, a group in Workspace ([FR-UM-09](02-user-management.md#fr-um-09)), or from a public Collection and a Publication. Proposal: no asking in Data Hub; whoever shared the link speaks to the owner. *Raised on 2026-10-24, while designing the page for a link to something a User may not see.*
- [ ] <a id="op-co-14"></a>**OP-CO-14** · Decide what happens to a field that identifies something the Domain Model has no Entity for yet, such as the ID of an agency review ([FR-CO-33](#fr-co-33)): it stays without a relation until the Entity exists, or the Data Admin proposes the Entity from here. The design leaves it without a relation. *Raised on 2026-10-25, while designing the relations.*
- [ ] <a id="op-co-15"></a>**OP-CO-15** · Decide where the relations of a Resource can be changed after it is added, and by whom: on the page of the Resource, by a Data Admin only, or also by its Owner ([FR-CO-33](#fr-co-33)). *Raised on 2026-10-25, while designing the relations.*
- [ ] <a id="op-co-16"></a>**OP-CO-16** · Decide how the icons of existing Collections move from Tabler to Phosphor ([DEC-CO-19](#dec-co-19)): the two sets name their icons differently. Proposal: map the names, by name and search words, and show the Data Team the icons without a match, to choose again. *Raised on 2026-10-25, while recording the decision.*
- [ ] <a id="op-co-17"></a>**OP-CO-17** · Decide who chooses the weight of the icon of a Collection, now that the light weight is favoured and the others are possible ([DEC-CO-19](#dec-co-19)): whoever chooses the icon, next to it, or Data Hub, light everywhere. Proposal: light by default, with the weight to choose next to the icon. *Raised on 2026-10-25, while recording the decision.*

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [User management](02-user-management.md)
- [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch)
- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
