# Permissions and library cards

| | |
| --- | --- |
| Domain | 12 of Data Hub · code `PL` |
| Status | To be specified |
| Source of truth | This file |
| Origin | Listed in the domain overview on Confluence; no page of its own yet (Confluence name: Rechten en lezerskaarten) |

**Scope:** roles, access and personal keys.

*Functional domain 12 of Data Hub. Overview of all domains: [Functional domains](README.md).*

## Already touched on elsewhere

Pointers to material this domain will build on, collected during the migration. They are navigation, not requirements of this domain.

- [Permissions and user/group management](../../overview/open-themes.md#2-permissions-and-usergroup-management): [OP-DH-22](../../overview/open-themes.md#op-dh-22) to [OP-DH-25](../../overview/open-themes.md#op-dh-25)
- The Library Card for Excel: [DEC-DH-46](../../overview/data-hub.md#dec-dh-46), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)
- All channels from one Google identity: [DEC-UM-02](02-user-management.md#dec-um-02)
- Role Groups: the [Naming Convention](02-user-management.md#naming-convention) in User management

## Requirements

*The requirements below come from the [workshop on data agents and governance of 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md). They are proposals, still to be validated, and therefore Proposed.*

<a id="fr-pl-01"></a>
### FR-PL-01 · Every Resource has a Confidentiality Level

**Status:** Proposed · **Source:** [REQ-DH-CONF](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-conf)

Next to its Level, every Resource has a Confidentiality Level. It is set in the dbt project, in `meta`.

<a id="fr-pl-02"></a>
### FR-PL-02 · Downstream, the Confidentiality Level can only go down

**Status:** Proposed · **Source:** [REQ-DH-CONF](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-conf)

Downstream, in a Lens, a Report or an export, the Confidentiality Level can only be lowered, never raised.

<a id="fr-pl-03"></a>
### FR-PL-03 · A Lens or a Report inherits the highest Confidentiality Level

**Status:** Proposed · **Source:** [REQ-DH-CONF](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-conf)

A Lens or a Report takes the highest Confidentiality Level of what lies beneath it.

## Open points

- [ ] <a id="op-pl-01"></a>**OP-PL-01** · Determine the Confidentiality Levels themselves, and the matrix of Confidentiality Levels against who may do what.
- [ ] <a id="op-pl-02"></a>**OP-PL-02** · Decide how the Confidentiality Level relates to the access classification on the Resource Card ([The Resource Card](../../overview/data-hub.md#the-resource-card)) and to the access axis of [OP-DH-22](../../overview/open-themes.md#op-dh-22): the same thing under a new name, or a second axis. *Raised while taking in the workshop of 2026-10-22.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
