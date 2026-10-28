# Resource card

| | |
| --- | --- |
| Domain | 5 of Data Hub · code `RC` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Fiche) |

**Scope:** what Data Hub derives about a Resource and what it stores itself, with Known Behaviour and Anomalies.

*Functional domain 5 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- [The Resource Card](../../overview/data-hub.md#the-resource-card) in the overview: what is derived and what Data Hub keeps itself, with [DEC-DH-16](../../overview/data-hub.md#dec-dh-16) to [DEC-DH-18](../../overview/data-hub.md#dec-dh-18)
- The tabs of a Resource: [FR-SR-24](04-stacks-and-resources.md#fr-sr-24)
- Supplementing the description (intended use, pitfalls, Anomalies, key fields, parameter fields): [FR-SR-28](04-stacks-and-resources.md#fr-sr-28); turning a Signal into an Anomaly: [FR-SR-30](04-stacks-and-resources.md#fr-sr-30)
- Open themes: [OP-DH-14](../../overview/open-themes.md#op-dh-14) (schema of the Resource Card), [OP-DH-15](../../overview/open-themes.md#op-dh-15) (Anomalies as annotations), [OP-DH-16](../../overview/open-themes.md#op-dh-16) (export to BigQuery)

## Decisions

- <a id="dec-rc-01"></a>**DEC-RC-01** · A Resource, and each of its fields, has two descriptions side by side: the description from dbt and the [Business Description](../../definitions.md#business-description), written in Data Hub by the Owner and the Data Team. Neither overrides, replaces or hides the other; the only relation between them is that they describe the same table or field. *Decided on 2026-10-26, by Max ([OP-RC-18](#op-rc-18)).*
- <a id="dec-rc-02"></a>**DEC-RC-02** · Where there is no Business Description, the description from dbt is used alone; where there is one, both are used, each marked with where it comes from. *Decided on 2026-10-26, by Max.*
- <a id="dec-rc-03"></a>**DEC-RC-03** · Every Change to the description from dbt of a Resource or of one of its fields is told to the Owner. It never asks for a review, and changes nothing about the Business Description, the Level or the Publication. *Decided on 2026-10-26, by Max ([OP-RC-19](#op-rc-19)).*
- <a id="dec-rc-04"></a>**DEC-RC-04** · Nothing is made available to the company before its Owner has confirmed it, at Level 3: the first Publication is at once the first Confirmation ([DEC-SR-07](04-stacks-and-resources.md#dec-sr-07)). That Confirmation covers the descriptions too; there is no separate review of them. *Decided on 2026-10-26, by Max ([OP-RC-21](#op-rc-21)).*
- <a id="dec-rc-05"></a>**DEC-RC-05** · A field of a Resource relates to an Entity, never to another Resource, with a relation type of the Domain Model and the identity of that Entity, such as `basedOn` `listing.listingId`. Each relation type has exactly one cardinality, counted from the record that carries the field: one for `placedIn`, `occurredWithin`, `basedOn`, `references`, `hasType`, `represents` and `narrows`; many for `contains`, `partOf`, `serves`, `expresses` and `relatesTo`; every inverse type is many. The cardinality is never chosen in Data Hub: it follows from the type. A type that holds one never lands on an array column; a type that holds many may land on a single value, as many can be one. Where no specific type fits, `references` is the general relation for a single value and `relatesTo` for a list. Data Hub reads the relation types from the Domain Model in use ([FR-AR-15](01-artifact-registry.md#fr-ar-15)). *Decided on 2026-10-26, by Max, after reassessing every relation type of the Domain Model with him, type by type ([OP-RC-07](#op-rc-07), [OP-RC-08](#op-rc-08), [OP-RC-09](#op-rc-09)). The change of the vocabulary itself is made in the Domain Model.* *Note of 2026-10-28: a Resource has no array columns any more ([DEC-SR-33](04-stacks-and-resources.md#dec-sr-33)); a relation of many lands on a field the Data Team flattened in dbt.*
- <a id="dec-rc-06"></a>**DEC-RC-06** · A field that carries the identity of an Entity the row is about maps as `is` that identity, such as `listingId` is `listing.listingId`. `is` is not a relation between two Entities and not a relation type of the Domain Model, where it is simply the identifier of the Entity. An event is a subject of its own: its `eventId` is `entity.action`, such as `homeLoanSimulation.generate`, and the `listingId` of a listing view is `listing.listingId`. Where a record cannot point at an Entity, there is no relation: an aggregate keeps only the relations of the fields it groups by, and its dimensions map as `is`. *Decided on 2026-10-26, by Max.*
- <a id="dec-rc-07"></a>**DEC-RC-07** · The grain of a Resource is the set of fields that together identify each row, with one sentence, such as "one row per listing per day". Data Hub derives it where it can, from the grain a Colleciónes model declares and from a `unique` test in dbt, and otherwise the Data Admin ticks the fields when adding the Resource ([FR-CO-33](03-collections.md#fr-co-33)). *Decided on 2026-10-26, by Max ([OP-RC-12](#op-rc-12)).* *Note of 2026-10-28: Described now asks for `grain` in the `meta` of the model ([DEC-MR-11](06-maturity-and-release.md#dec-mr-11)); whether the Data Admin still ticks it is [OP-RC-24](#op-rc-24).* *Note of 2026-10-28: only in Data Hub, by the Data Admin; a derivation is a suggestion ([DEC-RC-09](#dec-rc-09)).*
- <a id="dec-rc-08"></a>**DEC-RC-08** · Data Hub knows two cardinalities and asks for neither. The rows per Entity follow from `is` and the grain: one when the grain is exactly the `is` field, many when the field is part of a larger grain. The cardinality of a relation follows from its type and counts per instance of its subject, the Entity of an `is` field of the same Resource, not per row: in a Resource with the views of listings per day, a listing has many rows but still one property. With one `is` field the subject is implicit; with several, a relation names the field it starts from. Both are shown in words with a small badge, such as "each generation: one listing · each listing: many generations" and N:1. *Decided on 2026-10-26, by Max ([OP-RC-10](#op-rc-10), [OP-RC-11](#op-rc-11), [OP-RC-13](#op-rc-13)).*
- <a id="dec-rc-09"></a>**DEC-RC-09** · The grain and the model type of a Resource are defined only in Data Hub, by the Data Admin when adding it ([FR-CO-33](03-collections.md#fr-co-33)), never read from the `meta` of dbt. What Data Hub derives, from a `unique` test in dbt or the grain a Colleciónes model declares, is only a suggestion the Data Admin confirms. Neither counts towards Described ([DEC-MR-12](06-maturity-and-release.md#dec-mr-12)). *Decided on 2026-10-28, by Max ([OP-RC-24](#op-rc-24), [OP-MR-06](06-maturity-and-release.md#op-mr-06)).*
- <a id="dec-rc-10"></a>**DEC-RC-10** · The model type of a Resource is one of `event`, `state`, `fact`, `dimension` and `aggregate`, chosen by the Data Admin next to the grain, at step 2 of adding Resources ([FR-CO-33](03-collections.md#fr-co-33)). The list is hard-coded: it changes with a change to the code, not in Data Hub. One Learning Card explains the model types together, and the card on the grain points to it ([FR-LR-39](16-learning.md#fr-lr-39)). *Decided on 2026-10-28, by Max ([OP-RC-25](#op-rc-25)).*
- <a id="dec-rc-11"></a>**DEC-RC-11** · The open questions on the Resource Card are the open Questions on the Resource ([FR-SR-29](04-stacks-and-resources.md#fr-sr-29)), not a list of their own. *Decided on 2026-10-28, by Max ([OP-RC-02](#op-rc-02)).*
- <a id="dec-rc-12"></a>**DEC-RC-12** · Known Gaps keep their name and are part of the Known Behaviour, next to intended use, pitfalls and Anomalies ([DEC-DH-18](../../overview/data-hub.md#dec-dh-18)). On the Overview they keep their own tile, right after Known Behaviour. The record of changes is the Log, not an "audit log". *Decided on 2026-10-28, by Max ([OP-RC-03](#op-rc-03)).*
- <a id="dec-rc-13"></a>**DEC-RC-13** · The grain and the mappings of the fields of a Resource, its Entities and identifiers, are kept in Data Hub. A model outside Colleciónes does not carry them in the meta of its dbt project; for a Colleciónes model, Data Hub fills them in from the meta of its columns when the Resource is added ([FR-AR-17](01-artifact-registry.md#fr-ar-17), [FR-CO-33](03-collections.md#fr-co-33)). *Decided on 2026-10-28, by Max ([OP-RC-05](#op-rc-05)).*

## Requirements

*[FR-RC-01](#fr-rc-01) to [FR-RC-10](#fr-rc-10) come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md); they are proposals, still to be validated, and therefore Proposed. [FR-RC-11](#fr-rc-11) to [FR-RC-15](#fr-rc-15) come from the review of the [detail page of a Resource](../../design/principles.md#detail-page-of-a-resource) on the same day. [FR-RC-16](#fr-rc-16) to [FR-RC-18](#fr-rc-18) come from the review of Max on 2026-10-26, which also made [FR-RC-01](#fr-rc-01) Specified.*

<a id="fr-rc-01"></a>
### FR-RC-01 · A Business Description of the Resource

**Status:** Specified · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource can have a Business Description: what it is, in business language, its entry in the data dictionary, visible on its Resource Card next to the description from dbt ([DEC-RC-01](#dec-rc-01)).

*Note of 2026-10-26: first proposed as a definition in business language, a text of its own; Max decided that it is the Business Description of the Resource, side by side with the description from dbt.*

*Note of 2026-10-28: from Described on: a Resource the Data Team has not described in dbt has no Business Descriptions ([DEC-MR-10](06-maturity-and-release.md#dec-mr-10)).*

<a id="fr-rc-02"></a>
### FR-RC-02 · Open questions about the data

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource keeps the open questions about its data, as metadata of its own that is visible on its Resource Card.

*Note of 2026-10-28: these are the open Questions on the Resource, not a list of their own ([DEC-RC-11](#dec-rc-11)).*

<a id="fr-rc-03"></a>
### FR-RC-03 · The control figures behind a Confirmation

**Status:** Withdrawn · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource shows the control figures that were run to confirm it, as metadata of their own.


*Note of 2026-10-24: the Owner records the control figures when publishing and when confirming again, each with its value and what it was checked against ([FR-SR-49](04-stacks-and-resources.md#fr-sr-49), [FR-MR-11](06-maturity-and-release.md#fr-mr-11)).*

*Note of 2026-10-26: withdrawn by Max. A Confirmation is business confirming what a Resource is and what it stands for, with no link to the data inside it ([DEC-MR-07](06-maturity-and-release.md#dec-mr-07)). Figures that check the data belong to the EDA ([EDA](15-eda.md)), which learns far more about a Resource.*

<a id="fr-rc-04"></a>
### FR-RC-04 · Known Gaps

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource records its Known Gaps, as metadata of their own: structural gaps in its data, such as the visitorId that is missing for credit leads that come from MySQL rather than from website events.

<a id="fr-rc-05"></a>
### FR-RC-05 · A log of changes and Anomalies, for people and for Claude

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

The errors, import problems and changes in the data of a Resource are kept in chronological order, readable by people in Data Hub and by Claude through the MCP. This builds on the Log ([DEC-DH-28](../../overview/data-hub.md#dec-dh-28)) and the Anomalies of the Known Behaviour ([DEC-DH-18](../../overview/data-hub.md#dec-dh-18)).

*Note of 2026-10-28: the part for Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-rc-06"></a>
### FR-RC-06 · Stability

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource states its Stability, as metadata of its own: whether its data is still settling, such as event data that closes after a few days, or can change by nature, such as an account name, and from when it is final, for example "stable = D-3".

*Could, not in v1: set on 2026-10-28, by Max; Stability is left out of version 1.*

<a id="fr-rc-07"></a>
### FR-RC-07 · The Level on the Resource Card

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

The Resource Card shows the Level of the Resource. Its confidentiality is worked out as a concept first ([OP-PL-01](12-permissions-and-library-cards.md#op-pl-01)).

<a id="fr-rc-08"></a>
### FR-RC-08 · Relationships through an Entity and an identifier

**Status:** Proposed · **Source:** [REQ-DH-RELATIES](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-relaties)

With every Resource stands which other Resources it can be joined to, and on which field. A relationship is expressed as an Entity and an identifier, as in the Domain Model, not as a table name. The Data Team gives the relationships when it makes a Resource available.

*Note of 2026-10-25: the Data Admin gives them per field when adding the Resource to a Collection ([FR-CO-33](03-collections.md#fr-co-33)).* *Note of 2026-10-26: a relationship is a relation type of the Domain Model towards the identity of an Entity, with the cardinality the type fixes ([DEC-RC-05](#dec-rc-05)); a field that is the identity of the Entity the row is about maps as `is` ([DEC-RC-06](#dec-rc-06)).*

<a id="fr-rc-09"></a>
### FR-RC-09 · A new Resource is linked through its Entity

**Status:** Proposed · **Source:** [REQ-DH-RELATIES](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-relaties)

A new Resource that states its Entity and identifier is linked automatically to every Resource that carries the same Entity.

<a id="fr-rc-10"></a>
### FR-RC-10 · Relationships can be visualised

**Status:** Proposed · **Source:** [REQ-DH-RELATIES](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-relaties)

The relationships between Resources can be shown as a picture.

<a id="fr-rc-11"></a>
### FR-RC-11 · Model type and grain

**Status:** Specified · **Source:** [The Resource Card](../../overview/data-hub.md#the-resource-card)

The Resource Card shows the model type and the grain of the Resource, as dbt has them (`model_type` and `grain` in `meta`), next to its description.

*Note of 2026-10-26: the grain is now the set of fields that identify each row, with a sentence, derived or given when the Resource is added ([DEC-RC-07](#dec-rc-07)). The `grain` in `meta` of dbt is one of its sources.*

<a id="fr-rc-12"></a>
### FR-RC-12 · Who published and who confirmed

**Status:** Specified · **Source:** [The Resource Card](../../overview/data-hub.md#the-resource-card)

The Resource Card shows who published the Resource and when, and who confirmed it last and when.

<a id="fr-rc-13"></a>
### FR-RC-13 · Since when the data is reliable

**Status:** Specified · **Source:** [The Resource Card](../../overview/data-hub.md#the-resource-card)

The Resource Card shows since when the data of the Resource is reliable. The Owner and the Data Team set it.

<a id="fr-rc-14"></a>
### FR-RC-14 · Checks and incidents

**Status:** Specified · **Source:** [The Resource Card](../../overview/data-hub.md#the-resource-card)

The Resource Card shows the active checks on the Resource and its incidents.

<a id="fr-rc-15"></a>
### FR-RC-15 · The Owner and the Data Team edit in place

**Status:** Specified · **Source:** [DEC-UX-09](../../design/principles.md#dec-ux-09)

The Owner and the Data Team edit what Data Hub keeps about a Resource in place, on its Resource Card: the Business Description of the Resource and of each field, intended use, pitfalls, Known Gaps, Stability, since when the data is reliable, and the key fields and Parameters. What comes from dbt is shown next to it, read-only. Every saved change goes into the Log ([FR-SR-28](04-stacks-and-resources.md#fr-sr-28)).

<a id="fr-rc-16"></a>
### FR-RC-16 · A Business Description of every field

**Status:** Specified · **Source:** [Review of 2026-10-25](../../review/2026-10-25-functional-and-technical-review.md#resources-the-resource-card-and-the-levels)

The Owner and the Data Team can write a Business Description of every field of a Resource, next to its description from dbt, as for the Resource itself ([FR-RC-01](#fr-rc-01)). The description from dbt is never edited in Data Hub ([FR-SR-06](04-stacks-and-resources.md#fr-sr-06)) and never hidden. Every Business Description that is written, changed or removed goes into the Log.

*Note of 2026-10-26: first proposed as an override of the description from dbt; Max decided that the two live side by side ([DEC-RC-01](#dec-rc-01)).*

*Note of 2026-10-28: from Described on: a Resource the Data Team has not described in dbt has no Business Descriptions ([DEC-MR-10](06-maturity-and-release.md#dec-mr-10)).*

<a id="fr-rc-17"></a>
### FR-RC-17 · A changed description in dbt is told to the Owner

**Status:** Specified · **Source:** [Review of 2026-10-25](../../review/2026-10-25-functional-and-technical-review.md#resources-the-resource-card-and-the-levels)

When the description from dbt of a Resource or of one of its fields changes, Data Hub tells the Owner in the Message Centre ([DEC-RC-03](#dec-rc-03)): one Message per Resource and Artifact Set, with every description that changed, its text before and after, and the Business Description next to it when there is one. The Message asks for nothing. A Change to a description further upstream in the lineage describes another table, and stays an entry in the Log ([FR-AR-12](01-artifact-registry.md#fr-ar-12)).

*Note of 2026-10-26: first proposed as a request to review the text that overrides the description; Max decided on a Message without a review.*

*Note of 2026-10-27: the Message ends with a link to the Learning Card that explains it, K3.4 Where definitions live ([FR-LR-38](16-learning.md#fr-lr-38)).*

<a id="fr-rc-18"></a>
### FR-RC-18 · Both descriptions, wherever a description is used

**Status:** Specified · **Source:** [Review of 2026-10-25](../../review/2026-10-25-functional-and-technical-review.md#resources-the-resource-card-and-the-levels)

Wherever Data Hub shows or hands over the description of a Resource or of a field, it uses the Business Description and the description from dbt together, each marked with where it comes from; without a Business Description, the description from dbt alone ([DEC-RC-02](#dec-rc-02)). That holds on the Resource Card and its Columns, in search, which covers both ([FR-SR-21](04-stacks-and-resources.md#fr-sr-21)), and for Claude.

## Open points

- [x] <a id="op-rc-01"></a>**OP-RC-01** · Decide how the definition in business language ([FR-RC-01](#fr-rc-01)) relates to the description from the Artifacts ([FR-SR-06](04-stacks-and-resources.md#fr-sr-06)): a separate text kept in Data Hub, and if so who writes it, given that what can be derived is not stored again ([DEC-DH-17](../../overview/data-hub.md#dec-dh-17)). *Raised while taking in the workshop of 2026-10-22.* *Note of 2026-10-26: answered with [OP-RC-18](#op-rc-18), if its proposal holds.* *Decided on 2026-10-26, by Max: the definition in business language is the Business Description of the Resource; it and the description from dbt live side by side, and their only relation is that they describe the same table ([DEC-RC-01](#dec-rc-01)).*
- [x] <a id="op-rc-02"></a>**OP-RC-02** · Decide whether the open questions ([FR-RC-02](#fr-rc-02)) are the open Questions on a Resource ([FR-SR-29](04-stacks-and-resources.md#fr-sr-29)), or a list of their own. *Raised while taking in the workshop of 2026-10-22.* *Decided on 2026-10-28, by Max: the open Questions on the Resource ([DEC-RC-11](#dec-rc-11)).*
- [x] <a id="op-rc-03"></a>**OP-RC-03** · Choose the term for Known Gaps and for the log of changes: the meeting notes say "audit log" does not quite cover it. Decide whether Known Gaps belong to the Known Behaviour ([DEC-DH-18](../../overview/data-hub.md#dec-dh-18)), next to intended use, pitfalls and Anomalies. *Decided on 2026-10-28, by Max: Known Gaps, part of the Known Behaviour; the record of changes is the Log ([DEC-RC-12](#dec-rc-12)).*
- [ ] <a id="op-rc-04"></a>**OP-RC-04** · Choose the term for Stability. The meeting notes name the professional terms: late-arriving data with a settling period, and slowly changing dimensions for attributes that change. Add it to the EDA template on Confluence as well. *Could, not in v1: set on 2026-10-28, by Max; Stability is left out of version 1 ([FR-RC-06](#fr-rc-06)).*
- [x] <a id="op-rc-05"></a>**OP-RC-05** · Decide where the Entity and identifier of a Resource ([FR-RC-08](#fr-rc-08)) are recorded: in the dbt project, in the Domain Model or in Data Hub, building on the Entities derived from the manifest and the lineage ([FR-SR-23](04-stacks-and-resources.md#fr-sr-23)) and on the relationships tests in dbt. *Raised while taking in the workshop of 2026-10-22.* *Note of 2026-10-25: after the review of Max (2026-10-24), the Data Admin records the reference of each field when adding a Resource, filled in from the docs for a Colleciónes model ([FR-CO-33](03-collections.md#fr-co-33)). Open remains where it is kept for other models: only in Data Hub, or also in the meta of the dbt project.* *Note of 2026-10-26: the mappings are now `is` and the relation types of the Domain Model, with the grain ([DEC-RC-05](#dec-rc-05) to [DEC-RC-08](#dec-rc-08)); they are recorded in Data Hub when the Resource is added. Whether models outside Colleciónes also carry them in the meta of dbt stays open.* *Note of 2026-10-28: for a Colleciónes model, the mapping can come from the meta of its columns, written by the generator ([OP-AR-07](01-artifact-registry.md#op-ar-07), [FR-AR-17](01-artifact-registry.md#fr-ar-17)).* *Decided on 2026-10-28, by Max: in Data Hub ([DEC-RC-13](#dec-rc-13)).*
- [x] <a id="op-rc-06"></a>**OP-RC-06** · Decide whether a Confirmation needs at least one control figure ([FR-RC-03](#fr-rc-03)). Proposal: no; the figures are asked for, but a Confirmation is possible without them, so that an Owner is never blocked, and the Resource Card then shows that there are none. *Raised on 2026-10-24, while designing publishing.* *Decided on 2026-10-26, by Max: no control figures at all at a Confirmation; they belong to the EDA ([DEC-MR-07](06-maturity-and-release.md#dec-mr-07)).*
- [x] <a id="op-rc-07"></a>**OP-RC-07** · Decide what a relationship records about its cardinality ([FR-RC-08](#fr-rc-08), [FR-CO-33](03-collections.md#fr-co-33)). For Max the relation is above all the cardinality it holds. Proposal: per field, towards its Entity, so that Data Hub derives the cardinality between any two Resources that share the Entity and warns of a join that fans out; not directly between Resources. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: per field, towards the identity of an Entity, with a relation type of the Domain Model whose cardinality is fixed ([DEC-RC-05](#dec-rc-05)).*
- [x] <a id="op-rc-08"></a>**OP-RC-08** · Decide how a Resource built on a Colleciónes model shows its relations. In the Domain Model the [relation type](https://github.com/immoscoop-be/compilacion-colleciones-domain-model/blob/main/models/root/vocabulary/relationTypes.yaml) implies the cardinality, but on one side only, the number of targets per row; the other side comes from its inverse type, which is almost always many. Proposal: the relation type and the cardinality it implies, read-only, with the description of the type, for the Data Admin to confirm. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: the relation type and the identity come from the Domain Model, the cardinality follows from the type, and the Data Admin confirms them ([DEC-RC-05](#dec-rc-05)). For that, every type now has one cardinality.*
- [x] <a id="op-rc-09"></a>**OP-RC-09** · Decide what a Resource built on another model records: only its cardinality, prefilled from dbt (an array column means many per row; a unique test means one row per value), or also a relation type from the sixteen of the Domain Model. Proposal: the cardinality, with the type optional. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: a relation type too, from the same vocabulary, read from the Domain Model in use ([FR-AR-15](01-artifact-registry.md#fr-ar-15)), suggested from the names of the fields; never only a cardinality ([DEC-RC-05](#dec-rc-05)).*
- [x] <a id="op-rc-10"></a>**OP-RC-10** · Decide how a cardinality is shown. Proposal: in words, "each row: one visitor · each visitor: many rows", with a small badge such as N:1, rather than the notation of crow's feet. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: in words, with a small badge such as N:1 ([DEC-RC-08](#dec-rc-08)).*
- [x] <a id="op-rc-11"></a>**OP-RC-11** · Decide whether Data Hub records the cardinality of the Domain Model, that of the Resource, or both. They differ by the grain of the Resource: a listing represents one property, but a Resource with the views of listings per day has many rows per listing. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: both, and neither is entered: rows per Entity from `is` and the grain, the cardinality of a relation from its type, per instance of its subject ([DEC-RC-08](#dec-rc-08)).*
- [x] <a id="op-rc-12"></a>**OP-RC-12** · Decide how "identifies each row" works when a row is identified by more than one field, such as the week and the lead source of Weekly lead volume: several fields together, or the grain as a notion of its own. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: several fields together make up the grain ([DEC-RC-07](#dec-rc-07)). "Identifies each row" splits into `is`, what the row is about ([DEC-RC-06](#dec-rc-06)), and the grain, what makes it unique.*
- [x] <a id="op-rc-13"></a>**OP-RC-13** · Decide where the second side of a relation comes from. To know whether a join fans out, Data Hub needs both sides; the Domain Model states one. Proposal: derive it from the grain of the Resource, and let the Data Admin state it where that is not possible. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: derived: the other side of a relation type is its inverse, always many, and the rows per Entity follow from the grain ([DEC-RC-08](#dec-rc-08)).*
- [x] <a id="op-rc-14"></a>**OP-RC-14** · Decide whether a relation records that a value can be missing. The Domain Model knows one and many, not zero or one; whether every row has a `visitorId` decides between an inner and a left join, and whether rows fall out of a count. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: a record that cannot point at an Entity has no relation; the relation types stay one or many ([DEC-RC-06](#dec-rc-06)). Whether a field can be empty follows from the data and its `not_null` test.*
- [ ] <a id="op-rc-15"></a>**OP-RC-15** · Decide whether and how Data Hub shows a reference that holds only while attributes are equal on both sides: `matchOn` in the Domain Model, such as `homeLoanBorrowingCapacity` to `homeLoanProfile` on `inputSignature`. The join then needs the identifier and the attribute. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [x] <a id="op-rc-16"></a>**OP-RC-16** · Decide how Data Hub shows a reference with cardinality many that lands as an array column, such as the `listingId`s of an `email`, which must be unnested before a join; next to a many that means many rows per value. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Decided on 2026-10-26, by Max: an array column holds a relation type of many, and the cardinality says so ("each generation: many campaigns"); a type of one on an array column is refused when the Resource is added ([DEC-RC-05](#dec-rc-05)).* *Note of 2026-10-28: replaced: array columns are left out of a Resource ([DEC-SR-33](04-stacks-and-resources.md#dec-sr-33)).*
- [ ] <a id="op-rc-17"></a>**OP-RC-17** · Decide what Data Hub derives and what it asks. dbt gives the type of a column and its tests (`unique`, `not_null`, `relationships`); the Colleciónes models give the relation type and cardinality, but for a state mart only as text in the description of a column. Proposal: derive what dbt gives, and ask the domain model to carry the references of an entity in structured meta. *Raised on 2026-10-25, in the discussion of the relations with Max.* *Note of 2026-10-26: partly settled. Derived: for a Colleciónes model the mappings from the Domain Model and the grain it declares; the grain of another model from a `unique` test. Asked, in the step that adds a Resource: the rest ([DEC-RC-07](#dec-rc-07)). Open remains whether models outside Colleciónes carry their mappings and grain in the meta of dbt.*
- [x] <a id="op-rc-18"></a>**OP-RC-18** · Decide whether a text that overrides a description from dbt ([FR-RC-16](#fr-rc-16)) hides it or stands above it, and whether the definition in business language ([FR-RC-01](#fr-rc-01)) is that text for the Resource itself. Proposal: above it, never hiding it, as the Overview already shows the definition above the description from dbt; and yes, the definition is the override of the Resource, which answers [OP-RC-01](#op-rc-01). Hiding the description from dbt would make Data Hub a second source next to dbt, which [DEC-DH-17](../../overview/data-hub.md#dec-dh-17) rules out. *Raised on 2026-10-26, in the review of Max.* *Decided on 2026-10-26, by Max: no override; the two live side by side ([DEC-RC-01](#dec-rc-01)).*
- [x] <a id="op-rc-19"></a>**OP-RC-19** · Decide which Changes ask for a review ([FR-RC-17](#fr-rc-17)). A description Change is followed downstream through the whole lineage, into the Log of every Resource it reaches ([FR-AR-12](01-artifact-registry.md#fr-ar-12)). Proposal: only a Change to the description of the Resource itself, or of the field the text is on; a Change further upstream stays an entry in the Log. A field that is renamed or removed is a structural Change: its text is kept and asks for a review as well. *Raised on 2026-10-26, in the review of Max.* *Decided on 2026-10-26, by Max: never a review, always a Message to the Owner ([DEC-RC-03](#dec-rc-03), [FR-RC-17](#fr-rc-17)).*
- [x] <a id="op-rc-20"></a>**OP-RC-20** · Decide whether a text on a field counts towards Described when the field has no description in dbt ([FR-MR-01](06-maturity-and-release.md#fr-mr-01)). Proposal: no; Described stays measured on dbt ([DEC-MR-01](06-maturity-and-release.md#dec-mr-01)), so a missing description is written at its source, and an override is not a way around it. *Raised on 2026-10-26, in the review of Max.* *Note of 2026-10-26: Max: they are not overrides, the two live side by side ([DEC-RC-01](#dec-rc-01)). Still to confirm, so: a Business Description does not count towards Described, which stays measured on the descriptions from dbt.* *Decided on 2026-10-26, by Max: a Business Description does not count towards Described, which is done by the Data Team in dbt; where dbt lacks descriptions, the Owner may jump over Described once Business Descriptions cover them ([DEC-MR-09](06-maturity-and-release.md#dec-mr-09)).* *Note of 2026-10-28: the jump over Described is withdrawn ([DEC-MR-10](06-maturity-and-release.md#dec-mr-10)).*
- [x] <a id="op-rc-21"></a>**OP-RC-21** · Decide what happens when nobody reviews a text after a Change in dbt ([FR-RC-17](#fr-rc-17)), and who may answer. Proposal: the text stays, with its marker; the Message Centre reminds the Owner after two weeks; the Level does not change, because the description from dbt is still there; and the Data Team can answer as well, as it can edit the text ([FR-RC-15](#fr-rc-15)). *Raised on 2026-10-26, in the review of Max.* *Decided on 2026-10-26, by Max: there is no review to wait for; nothing is made available to the company before Level 3, Confirmed ([DEC-RC-04](#dec-rc-04)).*
- [ ] <a id="op-rc-22"></a>**OP-RC-22** · Decide how the actor of an event maps, such as the `visitorId` of `homeLoanSimulation.generate`. The Domain Model knows it as who performs the action (`performedBy`), not as a relation type. Proposal: a mapping of its own, "performed by", read from the action in the Domain Model, with one actor per event. *Raised on 2026-10-26, while designing the step that adds a Resource.*
- [ ] <a id="op-rc-23"></a>**OP-RC-23** · Decide whether Data Hub checks a grain against the data when a Resource is added: a query that counts the rows sharing the chosen fields, with a dry run first. Proposal: yes for a grain from a test or chosen by the Data Admin; not for a Colleciónes model, which merges on its key. *Raised on 2026-10-26, while designing the step that adds a Resource.*
- [x] <a id="op-rc-24"></a>**OP-RC-24** · Decide whether the Data Admin still ticks the grain when adding a Resource ([FR-CO-33](03-collections.md#fr-co-33), [DEC-RC-07](#dec-rc-07)), now that Described takes it from the `meta` of dbt ([DEC-MR-11](06-maturity-and-release.md#dec-mr-11)). Proposal: Data Hub shows the grain from `meta`; where there is none, the Data Admin ticks it for the mapping of the fields, and the Resource stays Available until dbt has it. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-28, by Max: yes; the grain is defined only in Data Hub, by the Data Admin ([DEC-RC-09](#dec-rc-09)).*
- [x] <a id="op-rc-25"></a>**OP-RC-25** · Decide the values of the model type that the Data Admin sets in Data Hub ([DEC-RC-09](#dec-rc-09)), and where it is set: step 2 of adding Resources shows the grain, not a model type ([FR-CO-33](03-collections.md#fr-co-33)). Proposal: one of `event`, `state`, `fact`, `dimension` and `aggregate`, chosen next to the grain. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-28, by Max: the five, next to the grain, in a hard-coded list; one Learning Card for the model types, to which the card on the grain points ([DEC-RC-10](#dec-rc-10)).*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
