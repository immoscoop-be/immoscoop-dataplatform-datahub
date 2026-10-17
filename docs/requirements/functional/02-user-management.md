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

**In one sentence:** Data Hub knows its users and groups from Google Workspace: you log in with Google, and the groups you are in come from Google.

*Functional domain 2 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: the library keeps no member register of its own. It uses the register the company already has.

## Decisions

- <a id="dec-um-01"></a>**DEC-UM-01** · Data Hub keeps no users or passwords of its own. Users authenticate against Google, via OpenID Connect ("Sign in with Google"), and only accounts of the company's own Google Workspace domain get in.
- <a id="dec-um-02"></a>**DEC-UM-02** · Login happens in Data Hub itself, not only via a proxy such as Identity-Aware Proxy. Claude (via MCP) and Excel (via a personal key) also come in through Data Hub, and all channels start from the same Google identity.
- <a id="dec-um-03"></a>**DEC-UM-03** · Groups come from Google Workspace. Data Hub requests them via the Cloud Identity Groups API, with a service account that is given the Groups Reader admin role in Workspace.
- <a id="dec-um-04"></a>**DEC-UM-04** · Owner units are Google groups that follow a naming convention. They are created and managed in Workspace, not in Data Hub. This answers the open question "Workspace groups or our own lists": Workspace groups.
- <a id="dec-um-05"></a>**DEC-UM-05** · Data Hub only pulls in the groups that follow the convention, not all groups of the company.

## Terms

| Term | Meaning |
| --- | --- |
| User | Someone with an Immoscoop Google Workspace account who has logged in to Data Hub at least once |
| Group | A Google group from Workspace that follows the naming convention |
| Owner unit | A group that takes care of a collection. Deliberately not a team from the organisational structure, but a Google group that exists only for this purpose |
| Synchronisation | Periodically pulling in the members of all convention groups, so that Data Hub knows who is in which group, even when that person is not logged in |

## Naming convention

| Kind of group | Form | Example |
| --- | --- | --- |
| Owner unit | `datahub-owner-<name>@<domain>` | `datahub-owner-digikom@` |
| Role (see the domain [Permissions and library cards](12-permissions-and-library-cards.md)) | `datahub-<role>@<domain>` | `datahub-datateam@` |

## Flow

1. **Log in.** The user chooses "Sign in with Google" and logs in at Google.
2. **Verify.** Data Hub verifies the ID token from Google: signature, audience and Workspace domain.
3. **Know the user.** At the first login, the user is created in Data Hub; after that, they are recognised.
4. **Fetch groups.** Data Hub requests the groups of the user from Google, and keeps them briefly in a cache.
5. **Synchronise.** Periodically, Data Hub fetches the members of all convention groups, regardless of who is logged in.

## Requirements

<a id="fr-um-01"></a>
### FR-UM-01 · Sign in with Google only

**Status:** Specified · **Confluence:** GB-01

Logging in is only possible with Google, via OpenID Connect. Data Hub verifies the signature of the ID token, the audience and the Workspace domain.

<a id="fr-um-02"></a>
### FR-UM-02 · Accounts of the own Workspace domain only

**Status:** Specified · **Confluence:** GB-02

Only accounts of the company's own Workspace domain get in. Personal Gmail accounts and accounts of other domains are refused.

<a id="fr-um-03"></a>
### FR-UM-03 · Create the user at first login, never store a password

**Status:** Specified · **Confluence:** GB-03

At the first login, Data Hub creates the user, with the fixed Google ID as key, and email and name as data. A password is never stored.

<a id="fr-um-04"></a>
### FR-UM-04 · Groups from the Cloud Identity Groups API, nested groups included

**Status:** Specified · **Confluence:** GB-04

Groups are requested via the Cloud Identity Groups API, not taken from the token. Nested groups count: whoever is in a group that is a member of a convention group is also in that convention group.

<a id="fr-um-05"></a>
### FR-UM-05 · Only convention groups are pulled in

**Status:** Specified · **Confluence:** GB-05

Only groups that follow the [naming convention](#naming-convention) are pulled in.

<a id="fr-um-06"></a>
### FR-UM-06 · Fetch and cache the groups at login

**Status:** Specified · **Confluence:** GB-06

When logging in, the groups of the user are fetched and kept briefly in a cache.

<a id="fr-um-07"></a>
### FR-UM-07 · Synchronise the members of convention groups periodically

**Status:** Specified · **Confluence:** GB-07

Periodically, the members of all convention groups are synchronised to Data Hub, so that ownership and notifications also work for people who are not logged in.

<a id="fr-um-08"></a>
### FR-UM-08 · Recognise a group by its fixed Google ID

**Status:** Specified · **Confluence:** GB-08

A group is recognised by its fixed Google ID, not by its email address, so that a renamed group keeps its history.

<a id="fr-um-09"></a>
### FR-UM-09 · Owner units are managed in Workspace

**Status:** Specified · **Confluence:** GB-09

Owner units are created, filled and dissolved in Workspace. Data Hub shows them, but does not change them.

<a id="fr-um-10"></a>
### FR-UM-10 · Removed or suspended accounts

**Status:** Specified · **Confluence:** GB-10

Whoever disappears from Workspace or is suspended can no longer log in, and disappears from their groups at the next synchronisation. What they did, such as confirmations and conversations, stays stored under their name.

## Edge cases

Proposals to confirm.

<a id="ec-um-01"></a>
### EC-UM-01 · An owner unit becomes empty

**Status:** Proposed

The resources of that owner unit then have no one left who vouches for them. According to the maturity ladder they drop, because their basis falls away; the [Maturity and release](06-maturity-and-release.md) domain defines how (see [OP-MR-04](06-maturity-and-release.md#op-mr-04)).

<a id="ec-um-02"></a>
### EC-UM-02 · A convention group is deleted in Workspace

**Status:** Proposed

At the next synchronisation, Data Hub marks it as dissolved, and keeps its history.

<a id="ec-um-03"></a>
### EC-UM-03 · Google is briefly unreachable

**Status:** Proposed

Whoever is already logged in continues with the groups from the cache; new logins only succeed once Google is reachable again.

## Out of scope

What someone may see and do, and issuing library cards ([Permissions and library cards](12-permissions-and-library-cards.md)), assigning an owner unit to a collection ([Collections](03-collections.md)), and what happens to the level of a resource when its owner unit empties ([Maturity and release](06-maturity-and-release.md)).

## Open points

- [x] <a id="op-um-01"></a>**OP-UM-01** · Finalise the naming convention for groups.
- [ ] <a id="op-um-02"></a>**OP-UM-02** · Confirm which Workspace domain (or which domains) is allowed.
- [ ] <a id="op-um-03"></a>**OP-UM-03** · Give the service account of Data Hub the Groups Reader admin role in Workspace, per environment (uat and prod).
- [ ] <a id="op-um-04"></a>**OP-UM-04** · Agree who creates and manages owner groups in Workspace, and who becomes group owner.
- [ ] <a id="op-um-05"></a>**OP-UM-05** · Decide the frequency of the synchronisation.
- [ ] <a id="op-um-06"></a>**OP-UM-06** · Confirm or adjust the edge cases above.

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Functional domains](README.md)
- [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch)
