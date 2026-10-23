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

**Status:** Proposed · **Source:** [REQ-DH-LENSTEXT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lenstext)

When a Lens is created, Data Hub generates, through a skill, a description in business language of its steps, queries and CTEs, so that business sees what happens in the Lens without reading SQL.

<a id="fr-le-04"></a>
### FR-LE-04 · Business adjusts Parameters without touching the SQL

**Status:** Proposed · **Source:** [REQ-DH-LENSPARAMS](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lensparams)

Business can adjust certain Parameters of a Lens without touching its SQL, for example the bounds of a `WHERE ... BETWEEN`. Parameters are typed and named functionally ([DEC-DH-11](../../overview/data-hub.md#dec-dh-11)).

<a id="fr-le-05"></a>
### FR-LE-05 · First the story, then the data

**Status:** Proposed · **Source:** [REQ-DH-STORY](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-story)

Whoever starts a Lens is first asked to record the question and the story, what they want to know and what they will do with it, before the query is built. The story becomes metadata of the Lens.


<a id="fr-le-06"></a>
### FR-LE-06 · A Lens has a short description and tags

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#query)

Every Lens has a description of a sentence or two on what it shows, in business language, and tags: a few words its maker chooses. Next to the description of its steps ([FR-LE-03](#fr-le-03)), they make a Lens findable: a new query matches its words against them ([FR-SR-48](04-stacks-and-resources.md#fr-sr-48)).

<a id="fr-le-07"></a>
### FR-LE-07 · A query becomes a Lens

**Status:** Proposed · **Source:** Max, 2026-10-23

Whoever ran a query in Query ([FR-SR-41](04-stacks-and-resources.md#fr-sr-41)) can make a Lens of it, with the button "Make it a lens" on the query ([DEC-UX-25](../../design/principles.md#dec-ux-25)): the logical next step once a query answers a question that will come back. Its name, its question and its Resources come along; its question is where the story of the Lens starts ([FR-LE-05](#fr-le-05)). Starting a Lens from the page of a Collection ([FR-CO-29](03-collections.md#fr-co-29)) stays possible. Where a Lens made from a query belongs is open ([OP-LE-04](#op-le-04)).

<a id="fr-le-08"></a>
### FR-LE-08 · Making a Lens checks what one run reads, in three ranges

**Status:** Proposed · **Source:** Max, 2026-10-23, in place of [FR-LE-01](#fr-le-01)

When a Lens is made, Data Hub measures what one run of it reads, with a dry run as in the Pre-flight ([FR-SR-36](04-stacks-and-resources.md#fr-sr-36)). Two configurable thresholds make three ranges:

- **Within range:** the author makes and publishes the Lens freely.
- **Large,** above the first threshold: the author is warned, with what one run reads and, where it applies, what would make it read less, such as a filter on the partition column ([FR-SR-40](04-stacks-and-resources.md#fr-sr-40)). The author is still free to publish.
- **Very large,** above the second threshold: a member of the Data Team accepts the Lens before it is published ([FR-LE-09](#fr-le-09)).

The ranges only concern making a Lens: whoever uses a Lens sees no weight ([FR-LE-02](#fr-le-02), [DEC-UX-24](../../design/principles.md#dec-ux-24)). The thresholds are set apart from those of a single query ([FR-SR-37](04-stacks-and-resources.md#fr-sr-37)) and decided with the other limits ([OP-SR-07](04-stacks-and-resources.md#op-sr-07)).

<a id="fr-le-09"></a>
### FR-LE-09 · A very large Lens waits for the Data Team

**Status:** Proposed · **Source:** Max, 2026-10-23

A very large Lens ([FR-LE-08](#fr-le-08)) is saved but not published: its author can open it, nobody else sees it yet. The Data Team is notified and accepts or refuses it; a refusal comes with a reason. The author is notified of either, and both are recorded in the Log.

*Note of 2026-10-23: the request and the decision are Messages on the Lens: a Request to the Data Team with the word of its author, and the decision as its reply ([FR-CV-08](14-conversations.md#fr-cv-08)).*

<a id="fr-le-10"></a>
### FR-LE-10 · A Lens that outgrows its range is checked again

**Status:** Proposed · **Source:** Max, 2026-10-23

The size of a Lens is measured when it is made ([FR-LE-08](#fr-le-08)). After that, Data Hub follows what each run of the Lens reads. When a run reads more than the range the Lens was made in, or last accepted in, the Lens is checked again as when it was made: grown into large, its author is warned; grown into very large, the Data Team accepts it again ([FR-LE-09](#fr-le-09)). Whether it keeps running for its Users in the meantime is open ([OP-LE-05](#op-le-05)).

<a id="fr-le-11"></a>
### FR-LE-11 · A Lens runs on a page of its own

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#page-of-a-lens)

Every Lens has a page where it runs, for everyone who may use it ([DEC-CO-16](03-collections.md#dec-co-16)): a request with its Parameters, and the result. Its Parameters are filled in with their defaults ([FR-LE-13](#fr-le-13)); the User changes their values without touching the SQL ([FR-LE-04](#fr-le-04)) and puts a changed one back to its default. Adding Parameters is editing the Lens, for its Owner Unit. A second part of the page tells what the Lens answers, what it does step by step ([FR-LE-03](#fr-le-03)), what it is built on and its history. The result shows the rows, what was read and its Query ID ([FR-LN-06](07-log-and-notifications.md#fr-ln-06)), and can be downloaded within the row limit ([FR-CH-01](13-channels.md#fr-ch-01)). This is the basic flavour of a Lens: a query with Parameters, its result a table ([OP-LE-07](#op-le-07)).

<a id="fr-le-12"></a>
### FR-LE-12 · Every run of a Lens is a query

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#page-of-a-lens)

Every run of a Lens passes the Pre-flight, with its thresholds ([FR-SR-36](04-stacks-and-resources.md#fr-sr-36), [FR-SR-37](04-stacks-and-resources.md#fr-sr-37)), and is a query in the Query Log, with the name of the Lens ([DEC-UX-20](../../design/principles.md#dec-ux-20)). When a Parameter changes after a run, the result is marked as being for the old values until the Lens runs again. Whether a Lens runs when it is opened is open ([OP-LE-06](#op-le-06)).

<a id="fr-le-13"></a>
### FR-LE-13 · A Parameter takes a value or a function

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#page-of-a-lens)

A Parameter takes a value, such as a date or "all channels", or a function that is worked out at every run, such as "today − 3 days" or "the start of this year". Both are chosen in the same dropdown, with the date a function gives today. This holds for its default, which its Owner Unit sets when making or editing the Lens, and for the value a User chooses when running it. Which functions exist is open ([OP-LE-08](#op-le-08)).

<a id="fr-le-14"></a>
### FR-LE-14 · Only its Owner Unit sees the SQL of a Lens

**Status:** Proposed · **Source:** Max, 2026-10-23 · [design](../../design/principles.md#dec-ux-27)

A colleague never sees the SQL of a Lens: not on its page, and not through "Open in Query", which is for its Owner Unit only. The Owner Unit sees the SQL when editing the Lens. What the Lens does is told in plain language instead ([FR-LE-03](#fr-le-03)). The Data Team keeps seeing the SQL of every query in the Query Log ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)).

## Open points

- [ ] <a id="op-le-01"></a>**OP-LE-01** · Decide the form in which the story of a Lens is asked ([FR-LE-05](#fr-le-05)): a skill, a form or the interface. The meeting notes ask Hannelore to help shape how a question becomes actionable before a Lens is built.
- [x] <a id="op-le-02"></a>**OP-LE-02** · Decide where a Lens turns from light to heavy ([FR-LE-02](#fr-le-02)), in GB per run, together with the limit of [FR-LE-01](#fr-le-01). *Raised on 2026-10-23.* *Decided on 2026-10-23: a Lens has no light or heavy; [FR-LE-02](#fr-le-02) is withdrawn. Making a Lens is checked in three ranges instead ([FR-LE-08](#fr-le-08)), whose two thresholds are decided with the other limits in [OP-SR-07](04-stacks-and-resources.md#op-sr-07).*
- [x] <a id="op-le-03"></a>**OP-LE-03** · Decide at what one run of a Lens is measured ([FR-LE-08](#fr-le-08)): its default Parameters, or the widest a User can choose ([FR-LE-04](#fr-le-04)). And decide what happens when a Lens later outgrows its range, as its Resources grow: whether it is measured again, and whether a Lens that becomes very large then waits for the Data Team. *Raised on 2026-10-23.* *Decided on 2026-10-23: the size is measured when the Lens is made, as its author sets it up. Growth is followed while the Lens runs: a run that reads more than its range sets off the check again ([FR-LE-10](#fr-le-10)).*
- [ ] <a id="op-le-04"></a>**OP-LE-04** · Decide where a Lens made from a query belongs ([FR-LE-07](#fr-le-07)). Only the Owner Unit adds Lenses to a Collection ([DEC-CO-15](03-collections.md#dec-co-15)), so a Lens made by someone outside it needs a place: for example with its author until an Owner Unit takes it in. *Raised on 2026-10-23.* *Note of 2026-10-23: the [design](../../design/principles.md#making-a-lens) shows an author in the Owner Unit, whose Lens goes into the Collection of that unit.*
- [ ] <a id="op-le-05"></a>**OP-LE-05** · Decide whether a published Lens that grows into very large keeps running for its Users while it waits for the Data Team ([FR-LE-10](#fr-le-10)), or stops until it is accepted again. A proposal: it keeps running, so that nobody who uses it loses it, as a published Resource stays published when its Level drops ([DEC-DH-40](../../overview/data-hub.md#dec-dh-40)). *Raised on 2026-10-23.*
- [ ] <a id="op-le-06"></a>**OP-LE-06** · Decide whether a Lens runs when it is opened ([FR-LE-12](#fr-le-12)). A proposal, as designed: it does not, as every run is a query with its Pre-flight; the User runs it. Whether it then shows the result of their last run is open too. *Raised on 2026-10-23.*
- [ ] <a id="op-le-07"></a>**OP-LE-07** · Decide the flavours of a Lens, such as filtered or aggregated, next to the basic one of [FR-LE-11](#fr-le-11), a query with Parameters, and how they relate to the type of a Lens, such as Trend, Comparison or Funnel ([DEC-DH-13](../../overview/data-hub.md#dec-dh-13)). *Raised on 2026-10-23.*
- [ ] <a id="op-le-08"></a>**OP-LE-08** · Decide which functions a default may use ([FR-LE-13](#fr-le-13)). A first list: today, today minus a number of days, the start of this week, month or year, and the last complete week or month. *Raised on 2026-10-23.*
- [ ] <a id="op-le-09"></a>**OP-LE-09** · Decide whether a very large Lens can change while its Request waits for the Data Team ([FR-LE-09](#fr-le-09)), by its author or by the Data Team, and what then happens to the Request: a change can bring the Lens into another range, such as a default for From that makes it large. *Raised on 2026-10-23, while designing a Request opened in context.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
