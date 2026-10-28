# User management

| | |
| --- | --- |
| Domain | 2 of Data Hub · code `UM` (Confluence: `GB`, Gebruikersbeheer) |
| Type | Working document |
| Tags | context, decision, governance |
| Area | Tooling, Technical |
| Status | Specified; edge cases and open points remain |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Gebruikersbeheer](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371078690) (Confluence, Dutch), last modified 2026-10-15, migrated 2026-10-17 |

**In one sentence:** Data Hub knows its Users and Groups from Google Workspace: you log in with Google, and the Groups you are in come from Google.

*Functional domain 2 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: the library keeps no member register of its own. It uses the register the company already has.

## Decisions

- <a id="dec-um-01"></a>**DEC-UM-01** · Data Hub keeps no Users or passwords of its own. Users authenticate against Google, via OpenID Connect ("Sign in with Google"), and only accounts of the company's own Google Workspace domain get in.
- <a id="dec-um-02"></a>**DEC-UM-02** · Login happens in Data Hub itself, not only via a proxy such as Identity-Aware Proxy. Claude (via MCP) and Excel (via a personal key) also come in through Data Hub, and all channels start from the same Google identity.
- <a id="dec-um-03"></a>**DEC-UM-03** · Groups come from Google Workspace. Data Hub requests them via the Cloud Identity Groups API, with a service account that is given the Groups Reader admin role in Workspace.
- <a id="dec-um-04"></a>**DEC-UM-04** · Owner Units are Google groups that follow a Naming Convention. They are created and managed in Workspace, not in Data Hub. This answers the open question "Workspace groups or our own lists": Workspace groups. *Note of 2026-10-19: an Owner Unit can be any Google group of the own Workspace domain; the Naming Convention now applies to Role Groups only ([DEC-CO-09](03-collections.md#dec-co-09), [DEC-UM-07](#dec-um-07)).*
- <a id="dec-um-05"></a>**DEC-UM-05** · Data Hub only pulls in the Groups that follow the convention, not all groups of the company. *Note of 2026-10-19: replaced by [DEC-UM-07](#dec-um-07).*
- <a id="dec-um-06"></a>**DEC-UM-06** · The only Workspace domain that gets in is `thenextimmoscoop.be`. *Note of 2026-10-25: whether `immoscoop.be` gets in too is open ([OP-UM-07](#op-um-07)).*
- <a id="dec-um-07"></a>**DEC-UM-07** · Data Hub pulls in every group a User is in, nested groups included, as long as the group belongs to the own Workspace domain: any of them can be chosen as an Owner Unit ([DEC-CO-09](03-collections.md#dec-co-09)). Roles still come only from the Role Groups of the Naming Convention. The Synchronisation covers only the Groups Data Hub uses: the Role Groups and the Owner Units of Collections, not every group of the company. This replaces [DEC-UM-05](#dec-um-05).

## Terms

| Term | Meaning |
| --- | --- |
| User | Someone with an Immoscoop Google Workspace account who has logged in to Data Hub at least once |
| Group | A Google group of the own Workspace domain that Data Hub knows: a Role Group, or a group a User is in and can choose as Owner Unit |
| Owner Unit | The Group that takes care of a Collection: any Google group of the own Workspace domain, chosen by whoever creates the Collection from the groups they are in |
| Synchronisation | Periodically pulling in the members of all Groups, so that Data Hub knows who is in which Group, even when that person is not logged in |

## Naming Convention

| Kind of Group | Form | Example |
| --- | --- | --- |
| Role (see the domain [Permissions and Excel keys](12-permissions-and-library-cards.md)) | `datahub-<role>@<domain>` | `datahub-datateam@` |

An Owner Unit needs no convention since 2026-10-19: any Google group of the own Workspace domain will do ([DEC-CO-09](03-collections.md#dec-co-09)). The form `datahub-owner-<name>@<domain>` it had before is no longer needed, and such a group gives no role.

## Flow

1. **Log in.** The User chooses "Sign in with Google" and logs in at Google.
2. **Verify.** Data Hub verifies the ID token from Google: signature, audience and Workspace domain.
3. **Know the User.** At the first login, the User is created in Data Hub; after that, they are recognised.
4. **Fetch Groups.** Data Hub requests the Groups of the User from Google, and keeps them briefly in a cache.
5. **Synchronise.** Periodically, Data Hub fetches the members of all Groups, regardless of who is logged in.

## Requirements

<a id="fr-um-01"></a>
### FR-UM-01 · Sign in with Google only

**Status:** Implemented · **Confluence:** GB-01 · [design](../../design/principles.md#sign-in)

Logging in is only possible with Google, via OpenID Connect. Data Hub verifies the signature of the ID token, the audience and the Workspace domain.

<a id="fr-um-02"></a>
### FR-UM-02 · Accounts of the own Workspace domain only

**Status:** Implemented · **Confluence:** GB-02 · [design](../../design/principles.md#sign-in)

Only accounts of the company's own Workspace domain get in. Personal Gmail accounts and accounts of other domains are refused.

<a id="fr-um-03"></a>
### FR-UM-03 · Create the User at first login, never store a password

**Status:** Implemented · **Confluence:** GB-03

At the first login, Data Hub creates the User, with the fixed Google ID as key, and email and name as data. A password is never stored.

<a id="fr-um-04"></a>
### FR-UM-04 · Groups from the Cloud Identity Groups API, nested groups included

**Status:** Implemented · **Confluence:** GB-04

Groups are requested via the Cloud Identity Groups API, not taken from the token. Nested groups count: whoever is in a group that is a member of a Group is also in that Group.

<a id="fr-um-05"></a>
### FR-UM-05 · Only Groups are pulled in

**Status:** Withdrawn · **Confluence:** GB-05

Only Groups that follow the [Naming Convention](#naming-convention) are pulled in.

*Withdrawn on 2026-10-19: replaced by [FR-UM-11](#fr-um-11) ([DEC-UM-07](#dec-um-07)).*

<a id="fr-um-06"></a>
### FR-UM-06 · Fetch and cache the Groups at login

**Status:** Specified · **Confluence:** GB-06

When logging in, the Groups of the User are fetched and kept briefly in a cache.

<a id="fr-um-07"></a>
### FR-UM-07 · Synchronise the members of Groups periodically

**Status:** Specified · **Confluence:** GB-07

Periodically, the members of all Groups are synchronised to Data Hub, so that ownership and notifications also work for people who are not logged in.

<a id="fr-um-08"></a>
### FR-UM-08 · Recognise a Group by its fixed Google ID

**Status:** Implemented · **Confluence:** GB-08

A Group is recognised by its fixed Google ID, not by its email address, so that a renamed Group keeps its history.

<a id="fr-um-09"></a>
### FR-UM-09 · Owner Units are managed in Workspace

**Status:** Specified · **Confluence:** GB-09

Owner Units are created, filled and dissolved in Workspace. Data Hub shows them, but does not change them.

<a id="fr-um-10"></a>
### FR-UM-10 · Removed or suspended accounts

**Status:** Specified · **Confluence:** GB-10

Whoever disappears from Workspace or is suspended can no longer log in, and disappears from their Groups at the next Synchronisation. What they did, such as Confirmations and conversations, stays stored under their name.

<a id="fr-um-11"></a>
### FR-UM-11 · Every group of the own domain is pulled in; roles come from Role Groups

**Status:** Implemented

Every group of the own Workspace domain that the User is in, nested groups included, is pulled in, with its fixed Google ID, its address and its name. The User can choose any of them as Owner Unit. Only the Role Groups of the [Naming Convention](#naming-convention) give a role.

## Edge cases

Proposals to confirm.

<a id="ec-um-01"></a>
### EC-UM-01 · An Owner Unit becomes empty

**Status:** Proposed

The Resources of that Owner Unit then have no one left who vouches for them. According to the maturity ladder they drop, because their basis falls away; the [Maturity and release](06-maturity-and-release.md) domain defines how (see [OP-MR-04](06-maturity-and-release.md#op-mr-04)).

<a id="ec-um-02"></a>
### EC-UM-02 · A Group is deleted in Workspace

**Status:** Proposed

At the next Synchronisation, Data Hub marks it as dissolved, and keeps its history.

<a id="ec-um-03"></a>
### EC-UM-03 · Google is briefly unreachable

**Status:** Proposed

Whoever is already logged in continues with the Groups from the cache; new logins only succeed once Google is reachable again.

## Out of scope

What someone may see and do, and issuing Excel keys ([Permissions and Excel keys](12-permissions-and-library-cards.md)), assigning an Owner Unit to a Collection ([Collections](03-collections.md)), and what happens to the Level of a Resource when its Owner Unit empties ([Maturity and release](06-maturity-and-release.md)).

## Open points

- [x] <a id="op-um-01"></a>**OP-UM-01** · Finalise the Naming Convention for Groups.
- [x] <a id="op-um-02"></a>**OP-UM-02** · Confirm which Workspace domain (or which domains) is allowed. *Decided on 2026-10-18: `thenextimmoscoop.be` only ([DEC-UM-06](#dec-um-06)).*
- [ ] <a id="op-um-03"></a>**OP-UM-03** · Give the service account of Data Hub the Groups Reader admin role in Workspace, per environment (uat and prod). *Done for uat on 2026-10-18, together with the Data Hub user reader role ([TR-PF-26](../technical/00-platform.md#tr-pf-26)); prod follows once its service account exists.*
- [x] <a id="op-um-04"></a>**OP-UM-04** · Agree who creates and manages Owner Units in Workspace, and who becomes group owner. *Decided on 2026-10-19: any existing Google group can be an Owner Unit, so no groups need to be created for it ([DEC-CO-09](03-collections.md#dec-co-09)).*
- [ ] <a id="op-um-05"></a>**OP-UM-05** · Decide the frequency of the Synchronisation.
- [ ] <a id="op-um-06"></a>**OP-UM-06** · Confirm or adjust the edge cases above.
- [ ] <a id="op-um-07"></a>**OP-UM-07** · Decide whether accounts of `immoscoop.be` get in too, next to `thenextimmoscoop.be` ([DEC-UM-06](#dec-um-06)): Max answered "thenextimmoscoop.be, immoscoop.be" in a comment on the review of 2026-10-25. Identity checks one domain today, reads the groups of one Workspace and checks its accounts. So first: is `immoscoop.be` a second domain of the same Google Workspace? If it is a Workspace of its own, its groups and accounts cannot be read. *Raised on 2026-10-25, from a comment of Max.*

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Functional domains](README.md)
- [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch)
