# Lenses

| | |
| --- | --- |
| Domain | 9 of Data Hub · code `LE` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Lenzen) |

**Scope:** Lens types, Parameters and their Level.

*Functional domain 9 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- [Lenses](../../overview/data-hub.md#lenses) in the overview: [DEC-DH-09](../../overview/data-hub.md#dec-dh-09) to [DEC-DH-13](../../overview/data-hub.md#dec-dh-13)
- Same look in Data Hub and in Claude: [DEC-DH-15](../../overview/data-hub.md#dec-dh-15)
- Open themes: [OP-DH-08](../../overview/open-themes.md#op-dh-08) to [OP-DH-11](../../overview/open-themes.md#op-dh-11), [OP-DH-21](../../overview/open-themes.md#op-dh-21)

## Decisions

- <a id="dec-le-01"></a>**DEC-LE-01** · A Lens takes its Parameters from the query it is made from: making a Lens adds none, and a Parameter is added in the query. Its Users can always change the value of every Parameter, without touching the SQL; there is no choice to lock one. *Decided on 2026-10-27, by Max.*
- <a id="dec-le-02"></a>**DEC-LE-02** · Making a Lens does not show what it does step by step. Data Hub writes that description in plain language when the Lens is saved ([FR-LE-03](#fr-le-03)), and the page of the Lens shows it. *Decided on 2026-10-27, by Max.* *Note of 2026-10-29: its author writes it, or Claude through the MCP ([DEC-LE-16](#dec-le-16)).*
- <a id="dec-le-03"></a>**DEC-LE-03** · A query that becomes a Lens stays a query, and says that it is used as that Lens, with a link to it; the Lens links back to its query. *Decided on 2026-10-27, by Max.*
- <a id="dec-le-04"></a>**DEC-LE-04** · Opening a query that is used as a Lens offers to overwrite the Lens with the query: its SQL and Parameters replace those of the Lens, after a new size check, as a new version of the Lens. Such a query no longer suggests the Lenses on its Resources. Using other Resources is a new query, as always ([DEC-UX-73](../../design/principles.md#dec-ux-73)); that one is not used as the Lens, and can become a Lens of its own. *Decided on 2026-10-27, by Max.*
- <a id="dec-le-05"></a>**DEC-LE-05** · While its Request waits for the Data Team, a very large Lens is frozen: nobody changes it, neither its author nor the Data Team, and it waits for the answer. A Request has a reasonable timeout ([OP-LE-10](#op-le-10)). *Decided on 2026-10-27, by Max ([OP-LE-09](#op-le-09)).*
- <a id="dec-le-06"></a>**DEC-LE-06** · A Lens is a query with its Parameters, as a Beta Concept is ([DEC-DH-70](../../overview/open-themes.md#dec-dh-70)). It has no type from a fixed list, such as funnel, trend or ranking: what it shows follows from its query. *Decided on 2026-10-28, by Max ([OP-DH-09](../../overview/open-themes.md#op-dh-09)), as answered with [OP-DH-07](../../overview/open-themes.md#op-dh-07).* *Note of 2026-10-28: the screens show no type ([DEC-UX-82](../../design/principles.md#dec-ux-82)).*
- <a id="dec-le-07"></a>**DEC-LE-07** · The kinds of a Parameter are basic types, enough for Data Hub: Date, Period, Whole number, Decimal number, Text, Choice, Several choices and Yes or no ([DEC-UX-71](../../design/principles.md#dec-ux-71)). They are aligned with the primitives that the datatypes of the Domain Model cascade down to, `date`, `integer`, `number`, `string`, `list` and `boolean`, with the same BigQuery types, but not derived from them: an Entity such as an agency is not a kind of its own, but a Text or a Choice. A Parameter is named as the Domain Model names things, in camelCase, such as `@dateFrom` or `@agencyId`, by whoever writes the query; its name is not derived either. *Decided on 2026-10-28, by Max ([OP-DH-10](../../overview/open-themes.md#op-dh-10)).*
- <a id="dec-le-08"></a>**DEC-LE-08** · In v1, the result of a Lens is a simple table: the same grid as the result of a query in Query ([DEC-UX-72](../../design/principles.md#dec-ux-72)), in Data Hub and in Claude. A Lens has no chart in v1. Visualisations come with Reports, and with them how they render, in the browser or as SVG, and in which mode in Claude. *Decided on 2026-10-28, by Max ([OP-DH-11](../../overview/open-themes.md#op-dh-11)).*
- <a id="dec-le-09"></a>**DEC-LE-09** · A Lens is made public the same way as a Resource ([FR-SR-31](04-stacks-and-resources.md#fr-sr-31)): published in a public Collection, it is available to the entire company. Not published, only its Owner Unit and the Data Team see it. Who sees it stays bounded by the Resources beneath it ([DEC-CO-16](03-collections.md#dec-co-16)). *Decided on 2026-10-28, by Max ([OP-LN-02](07-log-and-notifications.md#op-ln-02)).*
- <a id="dec-le-10"></a>**DEC-LE-10** · In version 1 the story of a Lens is a field of the Lens, which its author fills in, as the question of a query, "What do you want to know?", is today. No skill and no separate form. *Decided on 2026-10-28, by Max ([OP-LE-01](#op-le-01)).*
- <a id="dec-le-11"></a>**DEC-LE-11** · A published Lens that grows into very large stops: it does not run for anyone until the Data Team accepts it again. Data Hub tells its Owner and the Data Team. *Decided on 2026-10-28, by Max ([OP-LE-05](#op-le-05)).*
- <a id="dec-le-12"></a>**DEC-LE-12** · A Lens runs only when a User runs it, never when it is opened: every run is a query with its Pre-flight. *Decided on 2026-10-28, by Max ([OP-LE-06](#op-le-06)).*
- <a id="dec-le-13"></a>**DEC-LE-13** · Version 1 has one kind of Lens, a query with its Parameters ([FR-LE-11](#fr-le-11)); no flavours such as filtered or aggregated. *Decided on 2026-10-28, by Max ([OP-LE-07](#op-le-07)).*
- <a id="dec-le-14"></a>**DEC-LE-14** · A default, and any value of a Parameter, is a value or any SQL function, worked out at every run. The field suggests the common ones: today, today minus 3 days, the start of this week, month, quarter or year, and the end of the last complete week or month, as in Query ([DEC-UX-71](../../design/principles.md#dec-ux-71)). *Decided on 2026-10-28, by Max ([OP-LE-08](#op-le-08)).*
- <a id="dec-le-15"></a>**DEC-LE-15** · A Request has no timeout: it waits until the Data Team accepts or refuses it, however long that takes. This holds for a very large Lens and for a query above 1 GB ([DEC-SR-36](04-stacks-and-resources.md#dec-sr-36)). *Decided on 2026-10-28, by Max ([OP-LE-10](#op-le-10)).*
- <a id="dec-le-16"></a>**DEC-LE-16** · What a Lens does, step by step, is written by its author, in plain language, when making or editing it; when Claude makes a Lens through the MCP, in version 2, Claude writes it. Data Hub does not write it itself. This replaces the second sentence of [DEC-LE-02](#dec-le-02). *Decided on 2026-10-29, by Max.*
- <a id="dec-le-17"></a>**DEC-LE-17** · The result of a Lens cannot be downloaded in v1: the grid on its page is its result ([FR-CH-01](13-channels.md#fr-ch-01)). *Decided on 2026-10-29, by Max.*

## Requirements

*The requirements below come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md). They are proposals, still to be validated, and therefore Proposed.*

<a id="fr-le-01"></a>
### FR-LE-01 · A Lens is created only under a processing limit

**Status:** Withdrawn · **Source:** [REQ-DH-LENSWEIGHT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lensweight)

A Lens can only be created when the processing at its creation stays under a configurable number of GB.

*Withdrawn on 2026-10-23 by Max: one hard limit becomes a check in three ranges, in which only a very large Lens waits for the Data Team ([FR-LE-08](#fr-le-08)).*

<a id="fr-le-02"></a>
### FR-LE-02 · The weight of a Lens is visible

**Status:** Withdrawn · **Source:** [REQ-DH-LENSWEIGHT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lensweight)

The weight of a Lens, light or heavy, is visible to every User, so that whoever works with data knows what they set in motion.

*Note of 2026-10-23: the [design](../../design/principles.md#query) shows it as "Light" or "Heavy" with what one run reads, such as "Light · 0.8 GB a run"; where the line lies is open ([OP-LE-02](#op-le-02)).*

*Withdrawn on 2026-10-23 by Max: whoever asks for data wants the answer, and a label of light or heavy does not stop them. What a query reads is shown where it matters, in its Pre-flight ([FR-SR-36](04-stacks-and-resources.md#fr-sr-36)).*

<a id="fr-le-03"></a>
### FR-LE-03 · A Lens is described in plain language

**Status:** Proposed · **Source:** [REQ-DH-LENSTEXT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lenstext) · **Screens:** [lens](../../design/screens/lens.html)

When a Lens is created, Data Hub generates, through a skill, a description in business language of its steps, queries and CTEs, so that business sees what happens in the Lens without reading SQL.

*Note of 2026-10-27: not shown while the Lens is made; the page of the Lens shows it ([DEC-LE-02](#dec-le-02)).*

*Note of 2026-10-29: not generated: its author writes the steps when making the Lens, and Claude when it makes one through the MCP ([DEC-LE-16](#dec-le-16)).*

<a id="fr-le-04"></a>
### FR-LE-04 · Business adjusts Parameters without touching the SQL

**Status:** Proposed · **Source:** [REQ-DH-LENSPARAMS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lensparams) · **Screens:** [lens](../../design/screens/lens.html), [lens-new](../../design/screens/lens-new.html), [lens-new-context](../../design/screens/lens-new-context.html)

Business can adjust certain Parameters of a Lens without touching its SQL, for example the bounds of a `WHERE ... BETWEEN`. Parameters are typed and named functionally ([DEC-DH-11](../../overview/data-hub.md#dec-dh-11)).

*Note of 2026-10-27: every Parameter, not certain ones; they come from the query, and Users can always change them ([DEC-LE-01](#dec-le-01)).*

<a id="fr-le-05"></a>
### FR-LE-05 · First the story, then the data

**Status:** Proposed · **Source:** [REQ-DH-STORY](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-story) · **Screens:** [lens-new](../../design/screens/lens-new.html)

Whoever starts a Lens is first asked to record the question and the story, what they want to know and what they will do with it, before the query is built. The story becomes metadata of the Lens.

*Note of 2026-10-28: in version 1 it is a field of the Lens ([DEC-LE-10](#dec-le-10)).*


<a id="fr-le-06"></a>
### FR-LE-06 · A Lens has a short description and tags

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#query) · **Screens:** [lens](../../design/screens/lens.html), [lens-new](../../design/screens/lens-new.html), [lens-new-context](../../design/screens/lens-new-context.html), [query-new](../../design/screens/query-new.html)

Every Lens has a description of a sentence or two on what it shows, in business language, and tags: a few words its maker chooses. Next to the description of its steps ([FR-LE-03](#fr-le-03)), they make a Lens findable: a new query matches its words against them ([FR-SR-48](04-stacks-and-resources.md#fr-sr-48)).

<a id="fr-le-07"></a>
### FR-LE-07 · A query becomes a Lens

**Status:** Proposed · **Source:** Max, 2026-10-23 · **Screens:** [lens-new](../../design/screens/lens-new.html), [query](../../design/screens/query.html)

Whoever ran a query in Query ([FR-SR-41](04-stacks-and-resources.md#fr-sr-41)) can make a Lens of it, with the button "Make it a lens" on the query ([DEC-UX-25](../../design/principles.md#dec-ux-25)): the logical next step once a query answers a question that will come back. Its name, its question and its Resources come along; its question is where the story of the Lens starts ([FR-LE-05](#fr-le-05)). Starting a Lens from the page of a Collection ([FR-CO-29](03-collections.md#fr-co-29)) stays possible. Where a Lens made from a query belongs is open ([OP-LE-04](#op-le-04)).

*Note of 2026-10-27: the query stays, used as the Lens ([DEC-LE-03](#dec-le-03)).*

<a id="fr-le-08"></a>
### FR-LE-08 · Making a Lens checks what one run reads, in three ranges

**Status:** Proposed · **Source:** Max, 2026-10-23, in place of [FR-LE-01](#fr-le-01) · **Screens:** [lens-new](../../design/screens/lens-new.html), [lens-new-context](../../design/screens/lens-new-context.html), [query](../../design/screens/query.html)

When a Lens is made, Data Hub measures what one run of it reads, with a dry run as in the Pre-flight ([FR-SR-36](04-stacks-and-resources.md#fr-sr-36)). Two configurable thresholds make three ranges:

- **Within range:** the author makes and publishes the Lens freely.
- **Large,** above the first threshold: the author is warned, with what one run reads and, where it applies, what would make it read less, such as a filter on the partition column ([FR-SR-40](04-stacks-and-resources.md#fr-sr-40)). The author is still free to publish.
- **Very large,** above the second threshold: a member of the Data Team accepts the Lens before it is published ([FR-LE-09](#fr-le-09)).

The ranges only concern making a Lens: whoever uses a Lens sees no weight ([FR-LE-02](#fr-le-02), [DEC-UX-24](../../design/principles.md#dec-ux-24)). The thresholds are set apart from those of a single query ([FR-SR-37](04-stacks-and-resources.md#fr-sr-37)) and decided with the other limits ([OP-SR-07](04-stacks-and-resources.md#op-sr-07)).

*Note of 2026-10-26: the two thresholds are 100 MB and 1 GB, as for every query ([DEC-SR-29](04-stacks-and-resources.md#dec-sr-29)).*

<a id="fr-le-09"></a>
### FR-LE-09 · A very large Lens waits for the Data Team

**Status:** Proposed · **Source:** Max, 2026-10-23 · **Screens:** [collections-start](../../design/screens/collections-start.html), [lens-new](../../design/screens/lens-new.html), [lens-new-context](../../design/screens/lens-new-context.html), [messages](../../design/screens/messages.html)

A very large Lens ([FR-LE-08](#fr-le-08)) is saved but not published: its author can open it, nobody else sees it yet. The Data Team is notified and accepts or refuses it; a refusal comes with a reason. The author is notified of either, and both are recorded in the Log.

*Note of 2026-10-23: the request and the decision are Messages on the Lens: a Request to the Data Team with the word of its author, and the decision as its reply ([FR-CV-08](14-conversations.md#fr-cv-08)).*

<a id="fr-le-10"></a>
### FR-LE-10 · A Lens that outgrows its range is checked again

**Status:** Proposed · **Source:** Max, 2026-10-23 · **Screens:** [lens-new](../../design/screens/lens-new.html)

The size of a Lens is measured when it is made ([FR-LE-08](#fr-le-08)). After that, Data Hub follows what each run of the Lens reads. When a run reads more than the range the Lens was made in, or last accepted in, the Lens is checked again as when it was made: grown into large, its author is warned; grown into very large, the Data Team accepts it again ([FR-LE-09](#fr-le-09)). In the meantime it stops, and its Owner and the Data Team are told ([DEC-LE-11](#dec-le-11)).

<a id="fr-le-11"></a>
### FR-LE-11 · A Lens runs on a page of its own

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#page-of-a-lens) · **Screens:** [lens](../../design/screens/lens.html)

Every Lens has a page where it runs, for everyone who may use it ([DEC-CO-16](03-collections.md#dec-co-16)): a request with its Parameters, and the result. Its Parameters are filled in with their defaults ([FR-LE-13](#fr-le-13)); the User changes their values without touching the SQL ([FR-LE-04](#fr-le-04)) and puts a changed one back to its default. Adding Parameters is editing the Lens, for its Owner Unit. A second part of the page tells what the Lens answers, what it does step by step ([FR-LE-03](#fr-le-03)), what it is built on and its history. The result shows the rows, what was read and its Query ID ([FR-LN-06](07-log-and-notifications.md#fr-ln-06)), and can be downloaded within the row limit ([FR-CH-01](13-channels.md#fr-ch-01)). This is the basic flavour of a Lens: a query with Parameters, its result a table ([OP-LE-07](#op-le-07)).

*Note of 2026-10-26: the page of a Lens sits under Collections, with its Collection unfolded in the panel; there is no section Lenses ([DEC-UX-66](../../design/principles.md#dec-ux-66)).*

*Note of 2026-10-29: its result cannot be downloaded in v1 ([DEC-LE-17](#dec-le-17)).*

<a id="fr-le-12"></a>
### FR-LE-12 · Every run of a Lens is a query

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#page-of-a-lens) · **Screens:** [lens](../../design/screens/lens.html)

Every run of a Lens passes the Pre-flight, with its thresholds ([FR-SR-36](04-stacks-and-resources.md#fr-sr-36), [FR-SR-37](04-stacks-and-resources.md#fr-sr-37)), and is a query in the Query Log, with the name of the Lens ([DEC-UX-20](../../design/principles.md#dec-ux-20)). When a Parameter changes after a run, the result is marked as being for the old values until the Lens runs again. A Lens runs only when a User runs it, not when it is opened ([DEC-LE-12](#dec-le-12)).

<a id="fr-le-13"></a>
### FR-LE-13 · A Parameter takes a value or a function

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#page-of-a-lens) · **Screens:** [lens](../../design/screens/lens.html), [lens-new](../../design/screens/lens-new.html), [lens-new-context](../../design/screens/lens-new-context.html)

A Parameter takes a value, such as a date or "all channels", or a function that is worked out at every run, such as "today − 3 days" or "the start of this year". Both are chosen in the same dropdown, with the date a function gives today. This holds for its default, which its Owner Unit sets when making or editing the Lens, and for the value a User chooses when running it. It may be any SQL function; the field suggests the common ones ([DEC-LE-14](#dec-le-14)).

*Note of 2026-10-29: the date a function gives today is shown for the functions the field suggests, which Data Hub works out itself; next to any other function the field says "worked out at every run", and every function goes into the SQL of the run as it is written ([DEC-UX-118](../../design/principles.md#dec-ux-118)). In Query, part 5 of the [build order](../../design/build-order.md), a Parameter works this way; on a Lens it comes with part 6.*

<a id="fr-le-14"></a>
### FR-LE-14 · Only its Owner Unit sees the SQL of a Lens

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#dec-ux-27) · **Screens:** [lens](../../design/screens/lens.html)

A colleague never sees the SQL of a Lens: not on its page, and not through "Open in Query", which is for its Owner Unit only. The Owner Unit sees the SQL when editing the Lens. What the Lens does is told in plain language instead ([FR-LE-03](#fr-le-03)). The Data Team keeps seeing the SQL of every query in the Query Log ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)).


<a id="fr-le-15"></a>
### FR-LE-15 · The section Lenses starts with the Lenses a User may use

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#start-screen-per-section)

The section Lenses opens on a start screen. It finds Lenses by the words of a question, as a new query does ([FR-SR-48](04-stacks-and-resources.md#fr-sr-48)); shows the Lenses of the User and their Owner Unit, those waiting for the Data Team among them ([FR-LE-09](#fr-le-09)); and Lenses to discover, popular and new. Its panel lists the Lenses the User may use ([DEC-CO-16](03-collections.md#dec-co-16)), by Collection.

*Note of 2026-10-26: withdrawn by Max. Lenses have no section of their own; the start screen of Collections finds them ([FR-CO-37](03-collections.md#fr-co-37)).*

<a id="fr-le-16"></a>
### FR-LE-16 · A Lens is updated from its query

**Status:** Specified · **Source:** Max, 2026-10-27 · **Screens:** [query](../../design/screens/query.html)

A query used as a Lens says so, with a link to the Lens ([DEC-LE-03](#dec-le-03)). Whoever may change the Lens, its Owner Unit and the Data Team ([DEC-CO-15](03-collections.md#dec-co-15), [DEC-CO-18](03-collections.md#dec-co-18)), can update the Lens from the query: the SQL and the Parameters of the query replace those of the Lens, a new size check decides how it is published again ([FR-LE-08](#fr-le-08)), and the Lens keeps its name, question, story, tags and Collection. The earlier version stays in the history of the Lens. The query does not suggest the Lenses on its Resources ([DEC-LE-04](#dec-le-04)).


<a id="fr-le-17"></a>
### FR-LE-17 · A Lens that reads what no longer exists is Broken

**Status:** Proposed · **Source:** [DEC-DH-67](../../overview/data-hub.md#dec-dh-67) · **Screens:** [collection-overview](../../design/screens/collection-overview.html), [collections-start](../../design/screens/collections-start.html), [lens](../../design/screens/lens.html)

A Broken Lens cannot run, for anyone: Run is off, and a callout on top of its page names what no longer exists and since which dbt run. Its last result is not shown, so that nobody takes it for a current one. It carries a red dot wherever it is listed: in the panel, on tiles, in search and in the Lenses of a Collection, for everyone who sees it ([DEC-UX-81](../../design/principles.md#dec-ux-81)). Its Owner Unit gets a Message ([MSG-LEN-05](message-catalogue.md#msg-len-05)) and can repair it from its query ([DEC-LE-04](#dec-le-04)). When everything it reads exists again, it works again by itself, and the Message says so. The Reports with this Lens are Broken with it.

## Open points

- [x] <a id="op-le-01"></a>**OP-LE-01** · Decide the form in which the story of a Lens is asked ([FR-LE-05](#fr-le-05)): a skill, a form or the interface. The meeting notes ask Hannelore to help shape how a question becomes actionable before a Lens is built. *Decided on 2026-10-28, by Max: in v1, a field of the Lens ([DEC-LE-10](#dec-le-10)).*
- [x] <a id="op-le-02"></a>**OP-LE-02** · Decide where a Lens turns from light to heavy ([FR-LE-02](#fr-le-02)), in GB per run, together with the limit of [FR-LE-01](#fr-le-01). *Raised on 2026-10-23.* *Decided on 2026-10-23: a Lens has no light or heavy; [FR-LE-02](#fr-le-02) is withdrawn. Making a Lens is checked in three ranges instead ([FR-LE-08](#fr-le-08)), whose two thresholds are decided with the other limits in [OP-SR-07](04-stacks-and-resources.md#op-sr-07).*
- [x] <a id="op-le-03"></a>**OP-LE-03** · Decide at what one run of a Lens is measured ([FR-LE-08](#fr-le-08)): its default Parameters, or the widest a User can choose ([FR-LE-04](#fr-le-04)). And decide what happens when a Lens later outgrows its range, as its Resources grow: whether it is measured again, and whether a Lens that becomes very large then waits for the Data Team. *Raised on 2026-10-23.* *Decided on 2026-10-23: the size is measured when the Lens is made, as its author sets it up. Growth is followed while the Lens runs: a run that reads more than its range sets off the check again ([FR-LE-10](#fr-le-10)).*
- [x] <a id="op-le-04"></a>**OP-LE-04** · Decide where a Lens made from a query belongs ([FR-LE-07](#fr-le-07)). Only the Owner Unit adds Lenses to a Collection ([DEC-CO-15](03-collections.md#dec-co-15)), so a Lens made by someone outside it needs a place: for example with its author until an Owner Unit takes it in. *Raised on 2026-10-23.* *Note of 2026-10-23: the [design](../../design/principles.md#making-a-lens) shows an author in the Owner Unit, whose Lens goes into the Collection of that unit.* *Decided on 2026-10-26, by Max: a Lens always goes into a Collection its author owns, even with Resources of other Collections ([DEC-CO-20](03-collections.md#dec-co-20)).*
- [x] <a id="op-le-05"></a>**OP-LE-05** · Decide whether a published Lens that grows into very large keeps running for its Users while it waits for the Data Team ([FR-LE-10](#fr-le-10)), or stops until it is accepted again. A proposal: it keeps running, so that nobody who uses it loses it, as a published Resource stays published when its Level drops ([DEC-DH-40](../../overview/data-hub.md#dec-dh-40)). *Raised on 2026-10-23.* *Note of 2026-10-27: Max asked what this means. It is about a Lens that is already published and used, and that later reads more than 1 GB in a run, for example as its data grows: does it keep running for its Users until the Data Team accepts it again, or does it stop?* *Decided on 2026-10-28, by Max: it stops, and its Owner and the Data Team are told ([DEC-LE-11](#dec-le-11)).*
- [x] <a id="op-le-06"></a>**OP-LE-06** · Decide whether a Lens runs when it is opened ([FR-LE-12](#fr-le-12)). A proposal, as designed: it does not, as every run is a query with its Pre-flight; the User runs it. Whether it then shows the result of their last run is open too. *Raised on 2026-10-23.* *Decided on 2026-10-28, by Max: no, only when it is run ([DEC-LE-12](#dec-le-12)).*
- [x] <a id="op-le-07"></a>**OP-LE-07** · Decide the flavours of a Lens, such as filtered or aggregated, next to the basic one of [FR-LE-11](#fr-le-11), a query with Parameters, and how they relate to the type of a Lens, such as Trend, Comparison or Funnel ([DEC-DH-13](../../overview/data-hub.md#dec-dh-13)). *Raised on 2026-10-23.* *Note of 2026-10-28: a Lens has no type from a fixed list ([DEC-LE-06](#dec-le-06)); the flavours remain to decide.* *Decided on 2026-10-28, by Max: v1 has only the one kind, a query with its Parameters ([DEC-LE-13](#dec-le-13)).*
- [x] <a id="op-le-08"></a>**OP-LE-08** · Decide which functions a default may use ([FR-LE-13](#fr-le-13)). A first list: today, today minus a number of days, the start of this week, month or year, and the last complete week or month. *Raised on 2026-10-23.* *Note of 2026-10-27: in Query, the value of a Parameter is a value or any SQL function, worked out at every run; the field suggests today, today minus 3 days, the start of this week, month, quarter or year, and the end of the last complete week or month ([DEC-UX-71](../../design/principles.md#dec-ux-71)).* *Decided on 2026-10-28, by Max: as suggested ([DEC-LE-14](#dec-le-14)).*
- [x] <a id="op-le-09"></a>**OP-LE-09** · Decide whether a very large Lens can change while its Request waits for the Data Team ([FR-LE-09](#fr-le-09)), by its author or by the Data Team, and what then happens to the Request: a change can bring the Lens into another range, such as a default for From that makes it large. *Raised on 2026-10-23, while designing a Request opened in context.* *Decided on 2026-10-27, by Max: no; the Lens is frozen and waits, with a reasonable timeout ([DEC-LE-05](#dec-le-05)).*
- [x] <a id="op-le-10"></a>**OP-LE-10** · Decide the timeout of a Request for a very large Lens ([DEC-LE-05](#dec-le-05)), and what happens when it runs out. Proposal: five working days; then the Request lapses, its author is told in the Message Centre, and the Lens stays unpublished, to be changed and sent again. *Raised on 2026-10-27, in the review of Max.* *Decided on 2026-10-28, by Max: no timeout; a Request waits indefinitely ([DEC-LE-15](#dec-le-15)).*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
