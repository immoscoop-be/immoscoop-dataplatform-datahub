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

*The requirements below come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md). They are proposals, still to be validated, and therefore Proposed.*

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

<a id="fr-rc-09"></a>
### FR-RC-09 · A new Resource is linked through its Entity

**Status:** Proposed · **Source:** [REQ-DH-RELATIES](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-relaties)

A new Resource that states its Entity and identifier is linked automatically to every Resource that carries the same Entity.

<a id="fr-rc-10"></a>
### FR-RC-10 · Relationships can be visualised

**Status:** Proposed · **Source:** [REQ-DH-RELATIES](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-relaties)

The relationships between Resources can be shown as a picture.

## Open points

- [ ] <a id="op-rc-01"></a>**OP-RC-01** · Decide how the definition in business language ([FR-RC-01](#fr-rc-01)) relates to the description from the Artifacts ([FR-SR-06](04-stacks-and-resources.md#fr-sr-06)): a separate text kept in Data Hub, and if so who writes it, given that what can be derived is not stored again ([DEC-DH-17](../../overview/data-hub.md#dec-dh-17)). *Raised while taking in the workshop of 2026-10-22.*
- [ ] <a id="op-rc-02"></a>**OP-RC-02** · Decide whether the open questions ([FR-RC-02](#fr-rc-02)) are the open Questions on a Resource ([FR-SR-29](04-stacks-and-resources.md#fr-sr-29)), or a list of their own. *Raised while taking in the workshop of 2026-10-22.*
- [ ] <a id="op-rc-03"></a>**OP-RC-03** · Choose the term for Known Gaps and for the log of changes: the meeting notes say "audit log" does not quite cover it. Decide whether Known Gaps belong to the Known Behaviour ([DEC-DH-18](../../overview/data-hub.md#dec-dh-18)), next to intended use, pitfalls and Anomalies.
- [ ] <a id="op-rc-04"></a>**OP-RC-04** · Choose the term for Stability. The meeting notes name the professional terms: late-arriving data with a settling period, and slowly changing dimensions for attributes that change. Add it to the EDA template on Confluence as well.
- [ ] <a id="op-rc-05"></a>**OP-RC-05** · Decide where the Entity and identifier of a Resource ([FR-RC-08](#fr-rc-08)) are recorded: in the dbt project, in the Domain Model or in Data Hub, building on the Entities derived from the manifest and the lineage ([FR-SR-23](04-stacks-and-resources.md#fr-sr-23)) and on the relationships tests in dbt. *Raised while taking in the workshop of 2026-10-22.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
