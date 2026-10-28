# Permissions and Excel keys

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
- The Excel key for Excel: [DEC-DH-46](../../overview/data-hub.md#dec-dh-46), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)
- All channels from one Google identity: [DEC-UM-02](02-user-management.md#dec-um-02)
- Role Groups: the [Naming Convention](02-user-management.md#naming-convention) in User management

## Requirements

<a id="fr-pl-01"></a>
### FR-PL-01 · A User makes an Excel key on My page, and sees it once

**Status:** Proposed · **Source:** Max, 2026-10-28 ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) · [design](../../design/principles.md#my-page) · **Screens:** [my-page](../../design/screens/my-page.html)

On My page, a User makes an Excel key and gives it a name that says where it is used, such as "Excel on my laptop". Data Hub shows the key once, to copy, with how to use it in Power Query. identity keeps only its hash ([TR-PF-07](../technical/00-platform.md#tr-pf-07)): nobody can show it again.

<a id="fr-pl-02"></a>
### FR-PL-02 · My page lists the Excel keys of its User, and revokes one

**Status:** Proposed · **Source:** Max, 2026-10-28 ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) · [design](../../design/principles.md#my-page) · **Screens:** [my-page](../../design/screens/my-page.html)

My page lists every Excel key of its User: its name, when it was made, when it was last used and when it expires. Revoking one stops it at once, after a confirmation; the list keeps it, marked revoked. Renewing a key is revoking it and making a new one.

<a id="fr-pl-03"></a>
### FR-PL-03 · An Excel key lasts a year, and stops with its User

**Status:** Proposed · **Source:** Max, 2026-10-28 ([DEC-DH-79](../../overview/data-hub.md#dec-dh-79)) · **Screens:** [my-page](../../design/screens/my-page.html)

An Excel key expires a year after it was made; a month before, its User gets a notification. It stops at once when its User can no longer sign in with Google, for example after leaving. The Data Team can revoke any key, and its User gets a notification of that.

## Open points

- [ ] <a id="op-pl-01"></a>**OP-PL-01** · Work out confidentiality as a concept first, on Confluence, before it becomes requirements here. The starting points of the workshop ([REQ-DH-CONF](../../workshops/2026-10-22-data-agents-and-governance.md#req-dh-conf)): next to its maturity, every Resource gets a level of confidentiality, set in dbt (`meta`), only ever lowered downstream, and taken at its highest by a Lens or a Report, with a matrix of levels against who may do what. Settle as well how it relates to the access classification on the Resource Card ([The Resource Card](../../overview/data-hub.md#the-resource-card)) and to the access axis of [OP-DH-22](../../overview/open-themes.md#op-dh-22). *Decided on 2026-10-22: a concept to work out first, not yet requirements.* *Could, not in v1: set on 2026-10-28, by Max; confidentiality is out of the scope of version 1.*

## Builds on

- [Workshop data agents and governance, 2026-10-22](../../workshops/2026-10-22-data-agents-and-governance.md), and its [meeting notes](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1378746422) (Confluence, Dutch)
