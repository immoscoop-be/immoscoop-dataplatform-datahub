# User management

| | |
| --- | --- |
| Domain | 2 of Data Hub · code `UM` (Confluence: `GB`, Gebruikersbeheer) |
| Type | Working document |
| Tags | context, decision, governance |
| Area | Tooling, Technical |
| Status | Implemented; groups kept in Data Hub since 2026-11-10 ([DEC-UM-10](#dec-um-10)) |
| Source of truth | This file |
| Migrated from | [ptditt - Tooling - Data Hub - Gebruikersbeheer](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1371078690) (Confluence, Dutch), last modified 2026-10-15, migrated 2026-10-17 |

**In one sentence:** you sign in to Data Hub with your Google account, and the Groups you work in are kept in Data Hub itself, by the colleagues who manage them.

*Functional domain 2 of Data Hub. Overview of all domains: [Functional domains](README.md).*

In library terms: the library uses the register of the company to know who you are, and keeps its own list of who works together.

## Decisions

- <a id="dec-um-01"></a>**DEC-UM-01** · Data Hub keeps no Users or passwords of its own. Users authenticate against Google, via OpenID Connect ("Sign in with Google"), and only accounts of the company's own Google Workspace domain get in.
- <a id="dec-um-02"></a>**DEC-UM-02** · Login happens in Data Hub itself, not only via a proxy such as Identity-Aware Proxy. Claude (via MCP) and Excel (via a personal key) also come in through Data Hub, and all channels start from the same Google identity.
- <a id="dec-um-03"></a>**DEC-UM-03** · Groups come from Google Workspace. Data Hub requests them via the Cloud Identity Groups API, with a service account that is given the Groups Reader admin role in Workspace. *Note of 2026-11-10: replaced by [DEC-UM-10](#dec-um-10) once it is built: groups are kept in Data Hub.*
- <a id="dec-um-04"></a>**DEC-UM-04** · Owner Units are Google groups that follow a Naming Convention. They are created and managed in Workspace, not in Data Hub. This answers the open question "Workspace groups or our own lists": Workspace groups. *Note of 2026-10-19: an Owner Unit can be any Google group of the own Workspace domain; the Naming Convention now applies to Role Groups only ([DEC-CO-09](03-collections.md#dec-co-09), [DEC-UM-07](#dec-um-07)).* *Note of 2026-11-10: replaced by [DEC-UM-10](#dec-um-10) once it is built: groups are kept in Data Hub.*
- <a id="dec-um-05"></a>**DEC-UM-05** · Data Hub only pulls in the Groups that follow the convention, not all groups of the company. *Note of 2026-10-19: replaced by [DEC-UM-07](#dec-um-07).*
- <a id="dec-um-06"></a>**DEC-UM-06** · The only Workspace domain that gets in is `thenextimmoscoop.be`. *Note of 2026-10-25: whether `immoscoop.be` gets in too is open ([OP-UM-07](#op-um-07)).* *Note of 2026-10-28: both domains get in ([DEC-UM-09](#dec-um-09)).*
- <a id="dec-um-07"></a>**DEC-UM-07** · Data Hub pulls in every group a User is in, nested groups included, as long as the group belongs to the own Workspace domain: any of them can be chosen as an Owner Unit ([DEC-CO-09](03-collections.md#dec-co-09)). Roles still come only from the Role Groups of the Naming Convention. The Synchronisation covers only the Groups Data Hub uses: the Role Groups and the Owner Units of Collections, not every group of the company. This replaces [DEC-UM-05](#dec-um-05). *Note of 2026-11-10: replaced by [DEC-UM-10](#dec-um-10) once it is built: groups are kept in Data Hub.*
- <a id="dec-um-08"></a>**DEC-UM-08** · The Synchronisation happens when a User signs in: then Data Hub pulls in the Groups that User is in. It does not pull in all Groups on a schedule; who has never signed in, Data Hub does not know. *Decided on 2026-10-28, by Max ([OP-UM-05](#op-um-05)).* *Note of 2026-11-10: replaced by [DEC-UM-10](#dec-um-10) once it is built: groups are kept in Data Hub.*
- <a id="dec-um-09"></a>**DEC-UM-09** · Accounts of both `thenextimmoscoop.be` and `immoscoop.be` get in: both domains are on the same Google Workspace, so Data Hub reads their accounts and Groups alike. This replaces the one domain of [DEC-UM-06](#dec-um-06). identity checks one domain today (`DATAHUB_WORKSPACE_DOMAIN`); the rebuild takes both. *Decided on 2026-10-28, by Max ([OP-UM-07](#op-um-07)).* *Note of 2026-10-28: identity takes both now; Terraform passes them in `workspace_domains`, and a refused account is named on the sign-in.*
- <a id="dec-um-10"></a>**DEC-UM-10** · Groups are kept in Data Hub, no longer in Google Workspace: a group is a set of Users, managed by another group or by itself, and the Owner Unit of a Collection is one of them. Whoever may make groups chooses which of their groups manages a new one; a Data Admin manages every group. Once built, this replaces [DEC-UM-03](#dec-um-03), [DEC-UM-04](#dec-um-04), [DEC-UM-05](#dec-um-05), [DEC-UM-07](#dec-um-07) and [DEC-UM-08](#dec-um-08); the Role Group of the Data Team stays a Google group only for Cloud SQL Studio ([TR-PF-28](../technical/00-platform.md#tr-pf-28)). The screens are proposed in [design](../../design/principles.md#groups) ([DEC-UX-200](../../design/principles.md#dec-ux-200), [DEC-UX-201](../../design/principles.md#dec-ux-201)); the requirements follow once they are approved ([OP-UX-69](../../design/principles.md#op-ux-69)). *Decided on 2026-11-10, by Max, as Immoscoop moves from Google to Entra and nobody uses prod yet.* *Note of 2026-11-10: its requirements are [FR-UM-12](#fr-um-12) to [FR-UM-21](#fr-um-21) and [EC-UM-05](#ec-um-05).*
- <a id="dec-um-11"></a>**DEC-UM-11** · Sign in with Google stays until Immoscoop moves to Entra, months after Data Hub goes live. To make that switch cheap, every User gets an identifier of Data Hub's own, so that their Collections, queries, progress and Messages stay theirs when they start to sign in with Entra. *Decided on 2026-11-10, by Max.*
- <a id="dec-um-12"></a>**DEC-UM-12** · Data Hub keeps asking the directory whether an account is still active, at every renewal, so that the sessions, Excel keys and Claude connections of a colleague who left stop by themselves ([TR-PF-26](../technical/00-platform.md#tr-pf-26)): Google Workspace now, Entra after the move. *Decided on 2026-11-10, by Max.*

## Terms

| Term | Meaning |
| --- | --- |
| User | Someone with an Immoscoop Google Workspace account who has logged in to Data Hub at least once |
| Group | A set of Users kept in Data Hub, managed by another Group or by itself ([FR-UM-12](#fr-um-12)). A Group is who you work with; a Permission group is what you may do |
| Owner Unit | The Group that takes care of a Collection, chosen by whoever creates the Collection from the Groups they are in |
| Managed by | The Group whose members change a Group: its members, its name, who manages it, and deleting it ([FR-UM-14](#fr-um-14)) |

## Naming Convention

| Kind of Group | Form | Example |
| --- | --- | --- |
| Role (see the domain [Permissions and Excel keys](12-permissions-and-library-cards.md)) | `datahub-<role>@<domain>` | `datahub-datateam@` |

An Owner Unit needs no convention since 2026-10-19: any Google group of the own Workspace domain will do ([DEC-CO-09](03-collections.md#dec-co-09)). The form `datahub-owner-<name>@<domain>` it had before is no longer needed, and such a group gives no role.

*Note of 2026-11-10: Data Hub reads no Google groups since its Groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)). `datahub-datateam@` stays a Google group for Cloud SQL Studio and for the e-mail to the Data Team; the way back into Admin is a list of addresses in Terraform ([EC-PL-03](12-permissions-and-library-cards.md#ec-pl-03)).*

## Flow

1. **Log in.** The User chooses "Sign in with Google" and logs in at Google.
2. **Verify.** Data Hub verifies the ID token from Google: signature, audience and Workspace domain.
3. **Know the User.** At the first login, the User is created in Data Hub; after that, they are recognised.
4. **Check the account.** Data Hub asks the directory whether the account is still active, at sign-in and at every renewal ([DEC-UM-12](#dec-um-12)).
5. **Know the Groups.** Data Hub reads the Groups the User is in from its own database, and puts them in the Access Token ([FR-UM-19](#fr-um-19)).

## Requirements

<a id="fr-um-01"></a>
### FR-UM-01 · Sign in with Google only

**Status:** Implemented · **Confluence:** GB-01 · [design](../../design/principles.md#sign-in) · **Screens:** [sign-in](../../design/screens/sign-in.html)

Logging in is only possible with Google, via OpenID Connect. Data Hub verifies the signature of the ID token, the audience and the Workspace domain.

<a id="fr-um-02"></a>
### FR-UM-02 · Accounts of the own Workspace domain only

**Status:** Implemented · **Confluence:** GB-02 · [design](../../design/principles.md#sign-in) · **Screens:** [sign-in](../../design/screens/sign-in.html)

Only accounts of the company's own Workspace domain get in. Personal Gmail accounts and accounts of other domains are refused.

<a id="fr-um-03"></a>
### FR-UM-03 · Create the User at first login, never store a password

**Status:** Implemented · **Confluence:** GB-03 · **Screens:** [sign-in](../../design/screens/sign-in.html)

At the first login, Data Hub creates the User, with the fixed Google ID as key, and email and name as data. A password is never stored.

<a id="fr-um-04"></a>
### FR-UM-04 · Groups from the Cloud Identity Groups API, nested groups included

**Status:** Withdrawn · **Confluence:** GB-04

Groups are requested via the Cloud Identity Groups API, not taken from the token. Nested groups count: whoever is in a group that is a member of a Group is also in that Group.

*Withdrawn on 2026-11-10: replaced by [FR-UM-12](#fr-um-12), as groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)).*

<a id="fr-um-05"></a>
### FR-UM-05 · Only Groups are pulled in

**Status:** Withdrawn · **Confluence:** GB-05

Only Groups that follow the [Naming Convention](#naming-convention) are pulled in.

*Withdrawn on 2026-10-19: replaced by [FR-UM-11](#fr-um-11) ([DEC-UM-07](#dec-um-07)).*

<a id="fr-um-06"></a>
### FR-UM-06 · Fetch and cache the Groups at login

**Status:** Withdrawn · **Confluence:** GB-06

When logging in, the Groups of the User are fetched and kept briefly in a cache.

*Note of 2026-10-31, on checking what was built: the Groups are read at sign-in and again at every renewal of the Access Token, and travel in it for its lifetime of 15 minutes ([TR-PF-26](../technical/00-platform.md#tr-pf-26)).*

*Withdrawn on 2026-11-10: replaced by [FR-UM-19](#fr-um-19), as groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)).*

<a id="fr-um-07"></a>
### FR-UM-07 · Synchronise the members of Groups periodically

**Status:** Withdrawn · **Confluence:** GB-07

Periodically, the members of all Groups are synchronised to Data Hub, so that ownership and notifications also work for people who are not logged in.

*Withdrawn on 2026-11-10: replaced by [FR-UM-12](#fr-um-12): the members are kept in Data Hub, so ownership and notifications work for who is not signed in, as groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)).*

<a id="fr-um-08"></a>
### FR-UM-08 · Recognise a Group by its fixed Google ID

**Status:** Withdrawn · **Confluence:** GB-08

A Group is recognised by its fixed Google ID, not by its email address, so that a renamed Group keeps its history.

*Withdrawn on 2026-11-10: replaced by [FR-UM-12](#fr-um-12), with an identifier of Data Hub, as groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)).*

<a id="fr-um-09"></a>
### FR-UM-09 · Owner Units are managed in Workspace

**Status:** Withdrawn · **Confluence:** GB-09

Owner Units are created, filled and dissolved in Workspace. Data Hub shows them, but does not change them.

*Withdrawn on 2026-11-10: replaced by [FR-UM-14](#fr-um-14), as groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)).*

<a id="fr-um-10"></a>
### FR-UM-10 · Removed or suspended accounts

**Status:** Implemented · **Confluence:** GB-10

Whoever disappears from Workspace or is suspended can no longer log in, and disappears from their Groups at the next Synchronisation. What they did, such as Confirmations and conversations, stays stored under their name.

*Note of 2026-10-31, on checking what was built: at the next renewal of their Access Token, their sessions end and their Groups are emptied, as Data Hub reads the Groups at sign-in and renewal instead of in a Synchronisation ([DEC-UM-08](#dec-um-08), [TR-PF-26](../technical/00-platform.md#tr-pf-26)).*

*Note of 2026-11-10: since Groups are kept in Data Hub, they stay in their Groups, listed greyed with "cannot sign in", until someone takes them out ([FR-UM-15](#fr-um-15)); they no longer get the Messages of those Groups.*

<a id="fr-um-11"></a>
### FR-UM-11 · Every group of the own domain is pulled in; roles come from Role Groups

**Status:** Withdrawn

Every group of the own Workspace domain that the User is in, nested groups included, is pulled in, with its fixed Google ID, its address and its name. The User can choose any of them as Owner Unit. Only the Role Groups of the [Naming Convention](#naming-convention) give a role.

*Note of 2026-11-06: once Permission groups are built, a Role Group gives no role: what a User may do comes from their Permission group ([FR-PL-15](12-permissions-and-library-cards.md#fr-pl-15)).*

*Withdrawn on 2026-11-10: replaced by [FR-UM-12](#fr-um-12) and [FR-UM-13](#fr-um-13), as groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)).*

<a id="fr-um-12"></a>
### FR-UM-12 · A Group is a set of Users kept in Data Hub

**Status:** Implemented · [design](../../design/principles.md#groups) · **Screens:** [groups](../../design/screens/groups.html), [collection-edit](../../design/screens/collection-edit.html)

A Group has a name, a sentence on who is in it, and the Group that manages it: another Group, or itself. It holds Users only, never other Groups, so that who is in it stays plain to see ([OP-UX-71](../../design/principles.md#op-ux-71)). Data Hub knows it by an identifier of its own, so that a renamed Group keeps its Collections and its history; it has no address. A Group is who you work with; what you may do comes from your Permission group ([OP-UX-72](../../design/principles.md#op-ux-72)).

<a id="fr-um-13"></a>
### FR-UM-13 · Making a Group

**Status:** Implemented · [design](../../design/principles.md#groups) · **Screens:** [groups](../../design/screens/groups.html)

A User whose Permission group has Make groups (`groups.manage`) makes a Group with a name, a sentence and the Group that manages it: one of the Groups they are in, or the new Group itself, so that a User in no Group can still make their first ([DEC-UX-201](../../design/principles.md#dec-ux-201)). They are its first member, and add colleagues once it is made.

<a id="fr-um-14"></a>
### FR-UM-14 · Who changes a Group

**Status:** Implemented · [design](../../design/principles.md#groups) · **Screens:** [groups](../../design/screens/groups.html)

The members of the Group that manages a Group add and take out its members, rename it, change its sentence, choose which Group manages it, and delete it. The choice lists the Groups the User is in, and the Group itself; choosing a Group they are not in tells them they will no longer manage it. A User whose Permission group has Manage every group (`groups.all.manage`) changes every Group, also one they are not in, and chooses any Group to manage it ([DEC-UX-201](../../design/principles.md#dec-ux-201)).

<a id="fr-um-15"></a>
### FR-UM-15 · Adding a colleague, also before they signed in

**Status:** Implemented · [design](../../design/principles.md#groups) · **Screens:** [groups](../../design/screens/groups.html)

A colleague is added by name, suggested while typing, or by an address of an own Workspace domain ([DEC-UM-09](#dec-um-09)), and is in the Group at once. A colleague who has not signed in yet is listed with "has not signed in yet", and is in the Group from their first sign-in ([OP-UX-70](../../design/principles.md#op-ux-70)). A colleague who left stays listed, greyed, with "cannot sign in", until someone takes them out.

<a id="fr-um-16"></a>
### FR-UM-16 · Deleting a Group

**Status:** Implemented · [design](../../design/principles.md#groups) · **Screens:** [groups](../../design/screens/groups.html)

A Group that is the Owner Unit of a Collection, or manages another Group, cannot be deleted until those move to another Group: the page says which. Otherwise it is deleted once confirmed; its members are taken out, and what it did stays in the history.

<a id="fr-um-17"></a>
### FR-UM-17 · The history of a Group

**Status:** Implemented · [design](../../design/principles.md#groups) · **Screens:** [groups](../../design/screens/groups.html)

Every change to a Group is kept with who made it and when: made, renamed, its sentence changed, another Group chosen to manage it, a member added or taken out, moved from Google ([FR-UM-20](#fr-um-20)), deleted. The opened Group shows it, newest first.

<a id="fr-um-18"></a>
### FR-UM-18 · The page Groups

**Status:** Implemented · [design](../../design/principles.md#groups) · **Screens:** [groups](../../design/screens/groups.html), [my-page](../../design/screens/my-page.html)

Every User reaches Groups from My page, and sees the Groups they are in or manage; with Manage every group, also every other Group. An opened Group shows its members, the Group that manages it, the Collections it is the Owner Unit of as far as the User may see them, the Groups it manages, and its history. Whoever does not manage it sees it read-only, with the Group that manages it and two of its members to ask. Any signed-in User opens a Group they are sent to, such as the Owner Unit of a Collection.

<a id="fr-um-19"></a>
### FR-UM-19 · The Groups of a User travel in their Access Token

**Status:** Implemented

At sign-in and at every renewal, Data Hub reads the Groups the User is in from its own database, and puts them in their Access Token, as it did with the groups of Google. A change of members thus reaches every service within the lifetime of one Access Token; the web app renews its own at once after a change to the Groups of its User.

<a id="fr-um-20"></a>
### FR-UM-20 · The Owner Units of Google move once

**Status:** Implemented · **Source:** [OP-UX-69](../../design/principles.md#op-ux-69)

Each Google group that is the Owner Unit of a Collection becomes a Group of Data Hub once, with its name, keeping its Google ID as identifier so that its Collections stay with it, with the Users Data Hub last knew to be in it as members, and managing itself. From then on, Data Hub reads no groups from Google, and identity no longer needs the admin role Groups Reader in Workspace.

<a id="fr-um-21"></a>
### FR-UM-21 · What notifies an Owner Unit reaches each of its members

**Status:** Implemented

A Group has no address. A Message that notifies an Owner Unit reaches each of its members who can still sign in, or has not signed in yet: by e-mail in their own language, Dutch until they choose, and in Slack ([FR-LN-01](07-log-and-notifications.md#fr-ln-01)).

## Edge cases

<a id="ec-um-01"></a>
### EC-UM-01 · An Owner Unit becomes empty

**Status:** Withdrawn

The Resources of that Owner Unit then have no one left who vouches for them. According to the maturity ladder they drop, because their basis falls away; the [Maturity and release](06-maturity-and-release.md) domain defines how (see [OP-MR-04](06-maturity-and-release.md#op-mr-04)).

*Withdrawn on 2026-10-28, by Max: replaced by [EC-UM-04](#ec-um-04); the Level does not drop.*

<a id="ec-um-02"></a>
### EC-UM-02 · A Group is deleted in Workspace

**Status:** Withdrawn

At the next Synchronisation, Data Hub marks it as dissolved, and keeps its history.

*Withdrawn on 2026-10-28, by Max: replaced by [EC-UM-04](#ec-um-04): the Data Team manages a Group deleted in Workspace.*

<a id="ec-um-03"></a>
### EC-UM-03 · Google is briefly unreachable

**Status:** Withdrawn

Whoever is already logged in continues with the Groups from the cache; new logins only succeed once Google is reachable again.


*Withdrawn on 2026-10-28, by Max: Data Hub does not take this into account.*

<a id="ec-um-04"></a>
### EC-UM-04 · An Owner Unit becomes empty or is deleted, without Data Hub knowing

**Status:** Withdrawn · **Source:** Max, 2026-10-28

Data Hub learns the Groups of a User only when they sign in ([DEC-UM-08](#dec-um-08)), so it does not notice that an Owner Unit has become empty or was deleted in Workspace, and notifies nobody. The Data Team reassigns its Collections to another Group when it finds out. The Level of their Resources does not drop.

*Withdrawn on 2026-11-10: replaced by [FR-UM-16](#fr-um-16) and [EC-UM-05](#ec-um-05), as Data Hub keeps its Groups itself ([DEC-UM-10](#dec-um-10)).*

<a id="ec-um-05"></a>
### EC-UM-05 · Nobody who manages a Group can still sign in

**Status:** Implemented · **Source:** proposed on 2026-11-10, with [DEC-UM-10](#dec-um-10)

When every member of the Group that manages a Group has left, a User with Manage every group changes it, and chooses which Group manages it from then on ([FR-UM-14](#fr-um-14)). The Level of the Resources of its Collections does not drop.
## Out of scope

What someone may see and do, and issuing Excel keys ([Permissions and Excel keys](12-permissions-and-library-cards.md)), assigning an Owner Unit to a Collection ([Collections](03-collections.md)), and what happens to the Level of a Resource when its Owner Unit empties ([Maturity and release](06-maturity-and-release.md)).

## Open points

- [x] <a id="op-um-01"></a>**OP-UM-01** · Finalise the Naming Convention for Groups.
- [x] <a id="op-um-02"></a>**OP-UM-02** · Confirm which Workspace domain (or which domains) is allowed. *Decided on 2026-10-18: `thenextimmoscoop.be` only ([DEC-UM-06](#dec-um-06)).*
- [ ] <a id="op-um-03"></a>**OP-UM-03** · Give the service account of Data Hub the Groups Reader admin role in Workspace, per environment (uat and prod). *Done for uat on 2026-10-18, together with the Data Hub user reader role ([TR-PF-26](../technical/00-platform.md#tr-pf-26)); prod follows once its service account exists.* *Note of 2026-11-10: Groups Reader is needed only until the Owner Units moved ([FR-UM-20](#fr-um-20)); the Data Hub user reader role stays ([DEC-UM-12](#dec-um-12)).*
- [x] <a id="op-um-04"></a>**OP-UM-04** · Agree who creates and manages Owner Units in Workspace, and who becomes group owner. *Decided on 2026-10-19: any existing Google group can be an Owner Unit, so no groups need to be created for it ([DEC-CO-09](03-collections.md#dec-co-09)).*
- [x] <a id="op-um-05"></a>**OP-UM-05** · Decide the frequency of the Synchronisation. *Decided on 2026-10-28, by Max: at every sign-in ([DEC-UM-08](#dec-um-08)).*
- [x] <a id="op-um-06"></a>**OP-UM-06** · Confirm or adjust the edge cases above. *Decided on 2026-10-28, by Max: confirmed; [EC-UM-04](#ec-um-04) is Specified, the others are withdrawn.*
- [x] <a id="op-um-07"></a>**OP-UM-07** · Decide whether accounts of `immoscoop.be` get in too, next to `thenextimmoscoop.be` ([DEC-UM-06](#dec-um-06)): Max answered "thenextimmoscoop.be, immoscoop.be" in a comment on the review of 2026-10-25. Identity checks one domain today, reads the groups of one Workspace and checks its accounts. So first: is `immoscoop.be` a second domain of the same Google Workspace? If it is a Workspace of its own, its groups and accounts cannot be read. *Raised on 2026-10-25, from a comment of Max.* *Decided on 2026-10-28, by Max: both, as they are on the same Workspace ([DEC-UM-09](#dec-um-09)).*
- [x] <a id="op-um-08"></a>**OP-UM-08** · [FR-UM-07](#fr-um-07) still asks to synchronise the members of every Group periodically, and so does step 5 of the [Flow](#flow), while [DEC-UM-08](#dec-um-08) synchronises the Groups of a User only when they sign in, never on a schedule. Proposal: FR-UM-07 is withdrawn, and step 5 goes. *Raised on 2026-10-28, while mapping the screens to the requirements.* *Done on 2026-11-10: FR-UM-07 is withdrawn and step 5 replaced, as the members of Groups are kept in Data Hub ([DEC-UM-10](#dec-um-10)).*

## Builds on

- [Data Hub overview](../../overview/data-hub.md)
- [Functional domains](README.md)
- [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch)
