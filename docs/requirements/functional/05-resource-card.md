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

## Requirements

*[FR-RC-01](#fr-rc-01) to [FR-RC-10](#fr-rc-10) come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md); they are proposals, still to be validated, and therefore Proposed. [FR-RC-11](#fr-rc-11) to [FR-RC-15](#fr-rc-15) come from the review of the [detail page of a Resource](../../design/principles.md#detail-page-of-a-resource) on the same day.*

<a id="fr-rc-01"></a>
### FR-RC-01 · A definition in business language

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource has a definition in business language, its entry in the data dictionary, as metadata of its own that is visible on its Resource Card.

<a id="fr-rc-02"></a>
### FR-RC-02 · Open questions about the data

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource keeps the open questions about its data, as metadata of its own that is visible on its Resource Card.

<a id="fr-rc-03"></a>
### FR-RC-03 · The control figures behind a Confirmation

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource shows the control figures that were run to confirm it, as metadata of their own.


*Note of 2026-10-24: the Owner records the control figures when publishing and when confirming again, each with its value and what it was checked against ([FR-SR-49](04-stacks-and-resources.md#fr-sr-49), [FR-MR-11](06-maturity-and-release.md#fr-mr-11)).*
<a id="fr-rc-04"></a>
### FR-RC-04 · Known Gaps

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource records its Known Gaps, as metadata of their own: structural gaps in its data, such as the visitorId that is missing for credit leads that come from MySQL rather than from website events.

<a id="fr-rc-05"></a>
### FR-RC-05 · A log of changes and Anomalies, for people and for Claude

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

The errors, import problems and changes in the data of a Resource are kept in chronological order, readable by people in Data Hub and by Claude through the MCP. This builds on the Log ([DEC-DH-28](../../overview/data-hub.md#dec-dh-28)) and the Anomalies of the Known Behaviour ([DEC-DH-18](../../overview/data-hub.md#dec-dh-18)).

<a id="fr-rc-06"></a>
### FR-RC-06 · Stability

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

Every Resource states its Stability, as metadata of its own: whether its data is still settling, such as event data that closes after a few days, or can change by nature, such as an account name, and from when it is final, for example "stable = D-3".

<a id="fr-rc-07"></a>
### FR-RC-07 · The Level on the Resource Card

**Status:** Proposed · **Source:** [REQ-DH-META](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-meta)

The Resource Card shows the Level of the Resource. Its confidentiality is worked out as a concept first ([OP-PL-01](12-permissions-and-library-cards.md#op-pl-01)).

<a id="fr-rc-08"></a>
### FR-RC-08 · Relationships through an Entity and an identifier

**Status:** Proposed · **Source:** [REQ-DH-RELATIES](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-relaties)

With every Resource stands which other Resources it can be joined to, and on which field. A relationship is expressed as an Entity and an identifier, as in the Domain Model, not as a table name. The Data Team gives the relationships when it makes a Resource available.

*Note of 2026-10-25: the Data Admin gives them per field when adding the Resource to a Collection ([FR-CO-33](03-collections.md#fr-co-33)).*

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

The Owner and the Data Team edit what Data Hub keeps about a Resource in place, on its Resource Card: the definition in business language, intended use, pitfalls, Known Gaps, Stability, since when the data is reliable, and the key fields and Parameters. What comes from dbt is shown next to it, read-only. Every saved change goes into the Log ([FR-SR-28](04-stacks-and-resources.md#fr-sr-28)).

## Open points

- [ ] <a id="op-rc-01"></a>**OP-RC-01** · Decide how the definition in business language ([FR-RC-01](#fr-rc-01)) relates to the description from the Artifacts ([FR-SR-06](04-stacks-and-resources.md#fr-sr-06)): a separate text kept in Data Hub, and if so who writes it, given that what can be derived is not stored again ([DEC-DH-17](../../overview/data-hub.md#dec-dh-17)). *Raised while taking in the workshop of 2026-10-22.*
- [ ] <a id="op-rc-02"></a>**OP-RC-02** · Decide whether the open questions ([FR-RC-02](#fr-rc-02)) are the open Questions on a Resource ([FR-SR-29](04-stacks-and-resources.md#fr-sr-29)), or a list of their own. *Raised while taking in the workshop of 2026-10-22.*
- [ ] <a id="op-rc-03"></a>**OP-RC-03** · Choose the term for Known Gaps and for the log of changes: the meeting notes say "audit log" does not quite cover it. Decide whether Known Gaps belong to the Known Behaviour ([DEC-DH-18](../../overview/data-hub.md#dec-dh-18)), next to intended use, pitfalls and Anomalies.
- [ ] <a id="op-rc-04"></a>**OP-RC-04** · Choose the term for Stability. The meeting notes name the professional terms: late-arriving data with a settling period, and slowly changing dimensions for attributes that change. Add it to the EDA template on Confluence as well.
- [ ] <a id="op-rc-05"></a>**OP-RC-05** · Decide where the Entity and identifier of a Resource ([FR-RC-08](#fr-rc-08)) are recorded: in the dbt project, in the Domain Model or in Data Hub, building on the Entities derived from the manifest and the lineage ([FR-SR-23](04-stacks-and-resources.md#fr-sr-23)) and on the relationships tests in dbt. *Raised while taking in the workshop of 2026-10-22.* *Note of 2026-10-25: after the review of Max (2026-10-24), the Data Admin records the reference of each field when adding a Resource, filled in from the docs for a Colleciónes model ([FR-CO-33](03-collections.md#fr-co-33)). Open remains where it is kept for other models: only in Data Hub, or also in the meta of the dbt project.*
- [ ] <a id="op-rc-06"></a>**OP-RC-06** · Decide whether a Confirmation needs at least one control figure ([FR-RC-03](#fr-rc-03)). Proposal: no; the figures are asked for, but a Confirmation is possible without them, so that an Owner is never blocked, and the Resource Card then shows that there are none. *Raised on 2026-10-24, while designing publishing.*
- [ ] <a id="op-rc-07"></a>**OP-RC-07** · Decide what a relationship records about its cardinality ([FR-RC-08](#fr-rc-08), [FR-CO-33](03-collections.md#fr-co-33)). For Max the relation is above all the cardinality it holds. Proposal: per field, towards its Entity, so that Data Hub derives the cardinality between any two Resources that share the Entity and warns of a join that fans out; not directly between Resources. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-08"></a>**OP-RC-08** · Decide how a Resource built on a Colleciónes model shows its relations. In the Domain Model the [relation type](https://github.com/immoscoop-be/compilacion-colleciones-domain-model/blob/main/models/root/vocabulary/relationTypes.yaml) implies the cardinality, but on one side only, the number of targets per row; the other side comes from its inverse type, which is almost always many. Proposal: the relation type and the cardinality it implies, read-only, with the description of the type, for the Data Admin to confirm. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-09"></a>**OP-RC-09** · Decide what a Resource built on another model records: only its cardinality, prefilled from dbt (an array column means many per row; a unique test means one row per value), or also a relation type from the sixteen of the Domain Model. Proposal: the cardinality, with the type optional. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-10"></a>**OP-RC-10** · Decide how a cardinality is shown. Proposal: in words, "each row: one visitor · each visitor: many rows", with a small badge such as N:1, rather than the notation of crow's feet. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-11"></a>**OP-RC-11** · Decide whether Data Hub records the cardinality of the Domain Model, that of the Resource, or both. They differ by the grain of the Resource: a listing represents one property, but a Resource with the views of listings per day has many rows per listing. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-12"></a>**OP-RC-12** · Decide how "identifies each row" works when a row is identified by more than one field, such as the week and the lead source of Weekly lead volume: several fields together, or the grain as a notion of its own. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-13"></a>**OP-RC-13** · Decide where the second side of a relation comes from. To know whether a join fans out, Data Hub needs both sides; the Domain Model states one. Proposal: derive it from the grain of the Resource, and let the Data Admin state it where that is not possible. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-14"></a>**OP-RC-14** · Decide whether a relation records that a value can be missing. The Domain Model knows one and many, not zero or one; whether every row has a `visitorId` decides between an inner and a left join, and whether rows fall out of a count. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-15"></a>**OP-RC-15** · Decide whether and how Data Hub shows a reference that holds only while attributes are equal on both sides: `matchOn` in the Domain Model, such as `homeLoanBorrowingCapacity` to `homeLoanProfile` on `inputSignature`. The join then needs the identifier and the attribute. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-16"></a>**OP-RC-16** · Decide how Data Hub shows a reference with cardinality many that lands as an array column, such as the `listingId`s of an `email`, which must be unnested before a join; next to a many that means many rows per value. *Raised on 2026-10-25, in the discussion of the relations with Max.*
- [ ] <a id="op-rc-17"></a>**OP-RC-17** · Decide what Data Hub derives and what it asks. dbt gives the type of a column and its tests (`unique`, `not_null`, `relationships`); the Colleciónes models give the relation type and cardinality, but for a state mart only as text in the description of a column. Proposal: derive what dbt gives, and ask the domain model to carry the references of an entity in structured meta. *Raised on 2026-10-25, in the discussion of the relations with Max.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
