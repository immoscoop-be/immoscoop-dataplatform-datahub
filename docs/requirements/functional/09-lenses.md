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

**Status:** Proposed · **Source:** [REQ-DH-LENSWEIGHT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lensweight)

A Lens can only be created when the processing at its creation stays under a configurable number of GB.

<a id="fr-le-02"></a>
### FR-LE-02 · The weight of a Lens is visible

**Status:** Proposed · **Source:** [REQ-DH-LENSWEIGHT](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-lensweight)

The weight of a Lens, light or heavy, is visible to every User, so that whoever works with data knows what they set in motion.

*Note of 2026-10-23: the [design](../../design/principles.md#query) shows it as "Light" or "Heavy" with what one run reads, such as "Light · 0.8 GB a run"; where the line lies is open ([OP-LE-02](#op-le-02)).*

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

## Open points

- [ ] <a id="op-le-01"></a>**OP-LE-01** · Decide the form in which the story of a Lens is asked ([FR-LE-05](#fr-le-05)): a skill, a form or the interface. The meeting notes ask Hannelore to help shape how a question becomes actionable before a Lens is built.
- [ ] <a id="op-le-02"></a>**OP-LE-02** · Decide where a Lens turns from light to heavy ([FR-LE-02](#fr-le-02)), in GB per run, together with the limit of [FR-LE-01](#fr-le-01). *Raised on 2026-10-23.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
