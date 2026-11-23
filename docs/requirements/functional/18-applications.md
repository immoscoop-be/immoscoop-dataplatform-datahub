# Applications

| | |
| --- | --- |
| Domain | 18 of Data Hub · code `AP` |
| Status | To be specified: decisions taken on 2026-11-23; the screens designed and the requirements proposed the same night, both to be gone over with Max ([DEC-AP-18](#dec-ap-18)) |
| Version | Could, not in v1: set on 2026-11-23, by Max; every requirement and open point in this file is *Could, not in v1* ([DEC-AP-18](#dec-ap-18)) |
| Source of truth | This file |
| Origin | The [interview on delivery to applications of 2026-11-23](../../workshops/2026-11-23-delivery-to-applications.md), in which Max reconsidered that Data Hub never exposes its data to other systems |

**In one sentence:** an application that needs data of Immoscoop gets it through Data Hub as a registered Application, reading a Feed made from a Query, once every Owner of the Resources under it has said yes, and only the slice its user may see, from a copy that never depends on BigQuery.

*Functional domain 18 of Data Hub. Overview of all domains: [Functional domains](README.md). It narrows [DEC-DH-43](../../overview/data-hub.md#dec-dh-43) and [DEC-DH-44](../../overview/data-hub.md#dec-dh-44) through [DEC-DH-85](../../overview/data-hub.md#dec-dh-85); exports to people and tools stay as [Channels](13-channels.md) describes them.*

## Decisions

*Decided on 2026-11-23, by Max, in the [interview](../../workshops/2026-11-23-delivery-to-applications.md) and his review of the plan that followed. The names Application, Feed, Edition and Dock were chosen by Claude at his request ([OP-AP-01](#op-ap-01)).*

- <a id="dec-ap-01"></a>**DEC-AP-01** · A permanent flow of data to an application goes through Data Hub: the application is registered as an Application, with its Footprint, before it gets anything. Chatting with data while an app is being built stays as it is: a User and their Claude, on that User's rights. Data Hub wants to know what kind of application comes knocking, and how it will use the data. ([REQ-DH-APP-02](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-02))
- <a id="dec-ap-02"></a>**DEC-AP-02** · From a Query, a User makes a Lens, for people, or a Feed, for applications. A Feed sits in a Dock: the container of an Owner Unit that says "this data can be asked for, and these Applications may ask for it". A Feed is owned by the Owner Unit of its Dock, which need own no Resource. ([REQ-DH-APP-08](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-08), [REQ-DH-APP-10](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-10), [REQ-DH-APP-R1](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r1))
- <a id="dec-ap-03"></a>**DEC-AP-03** · The Footprint says what the Application is, whether it is internal or external, whether it authenticates its users and on which user pool, how it uses the data, whether it reads prepared or live, how often it needs new data, and, per Feed, the Binding Rule that matches a user of that pool to rows, such as `leads.company_id = agencies.company_id`. It is filled in a form in Data Hub, or from a JSON schema that the platform of IT provides. ([REQ-DH-APP-04](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-04), [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13))
- <a id="dec-ap-04"></a>**DEC-AP-04** · Every Owner of every Resource under a Feed says yes before an Application reads that Feed: Data Hub falls back on the Owners of the Resources. Data Hub informs each well enough to decide: the Footprint, the Binding Rule written out, the fields of their Resources that leave, aggregates and their Minimum Volume, and how often. ([REQ-DH-APP-03](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-03), [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09))
- <a id="dec-ap-05"></a>**DEC-AP-05** · Every Owner can withdraw at any time, in two degrees: phase out by a date, or cut off at once. ([REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09))
- <a id="dec-ap-06"></a>**DEC-AP-06** · Two identities come to the door: the Application itself, with a key of its own, and, when it has users, the user it carries, with a token of AWS Cognito. Identifying users is the work of IT: applications are built on its platform, and Cognito knows three user pools today, the users of the website, the agencies and the private sellers; more may follow. Whether an Application is internal follows from its registration, not from where it calls from. ([REQ-DH-APP-05](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-05), [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5))
- <a id="dec-ap-07"></a>**DEC-AP-07** · A Feed reads on the rights of its Owner Unit, which made the link: not on those of a person, so that the link does not fall away when someone leaves, and not on those of the user of the Application. Data Hub has no row-level privileges: its rights are per Collection and Resource. Slicing per customer is the Binding Rule of a delivery, and exists only there. ([REQ-DH-APP-14](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-14), [REQ-DH-APP-R4](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r4))
- <a id="dec-ap-08"></a>**DEC-AP-08** · A transactional system never queries BigQuery. A Feed is delivered either **prepared**, hardened: served from a copy that Data Hub fills, never dependent on BigQuery; or **live**: passed through to BigQuery at every question, for internal Applications only. One front door of Data Hub serves both, and chooses by the Footprint. ([REQ-DH-APP-06](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-06), [REQ-DH-APP-07](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-07), [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12), [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13))
- <a id="dec-ap-09"></a>**DEC-AP-09** · The copy of a prepared Feed lives in a Firestore of Data Hub's own, managed by Data Hub; not in the Firestore of Colleciónes ([DEC-DH-56](../../overview/data-hub.md#dec-dh-56)). It is partitioned on the identity the Binding Rule derives from the token, so a user can only search within their own slice, and it is searchable on the keys its Feed declares up front. The front door does not go down for a release. ([REQ-DH-APP-07](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-07), [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5))
- <a id="dec-ap-10"></a>**DEC-AP-10** · Late or never. A prepared Feed gets new data only after a run on it succeeded; until then the last good delivery is served. The contract with every Application says the data may come and may not come: a question may be answered with an error, and the Application copes with it. The error says its cause, distinct per cause: cut off by an Owner, held by a Rule, Data Hub unavailable. ([REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09), [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12), [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5))
- <a id="dec-ap-11"></a>**DEC-AP-11** · The transactional system stays the master of transactional data. A Feed only adds what the data platform makes, owned by the Data Team and, by extension, the Owners in Data Hub. The Application states in its Footprint that it knows the data travelled through the analytical layer and is not, or only late, representative of the transactional system. ([REQ-DH-APP-10](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-10))
- <a id="dec-ap-12"></a>**DEC-AP-12** · An aggregated value is delivered only when enough observations stand behind it: its Minimum Volume. It holds for every Application, with or without users. ([REQ-DH-APP-11](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-11), [REQ-DH-APP-R2](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r2))
- <a id="dec-ap-13"></a>**DEC-AP-13** · An Owner sets rules on their data that are evaluated after a run, before a delivery, such as "below so much I do not want it": the Monitor of the Resource, with its Rules and Actions ([Checks and monitoring](08-checks-and-monitoring.md)). Quarantine stops every delivery that reads the Resource. ([REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09), [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13))
- <a id="dec-ap-14"></a>**DEC-AP-14** · An Edition of a Feed never changes. Its Owner Unit changes a Feed by adding a new Edition; the old one stays alive for the Applications that read it, for a while. ([REQ-DH-APP-R3](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r3))
- <a id="dec-ap-15"></a>**DEC-AP-15** · An Owner Unit cannot be deleted while it holds a Dock with a Feed that an Application reads, as it cannot while it owns a Collection ([FR-UM-16](02-user-management.md#fr-um-16)). ([REQ-DH-APP-R4](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r4))
- <a id="dec-ap-16"></a>**DEC-AP-16** · There is no public Application for now: even the structured data of the SEO pages goes through the backend of the transactional system, which registers as an Application without users. ([REQ-DH-APP-15](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-15))
- <a id="dec-ap-17"></a>**DEC-AP-17** · The first case is the structured data of the SEO pages: price statistics per street and municipality, consistent across every kind of page. The agents' portal, with users of the pool of agencies sliced per agency, comes next. ([REQ-DH-APP-10](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-10), [REQ-DH-APP-R6](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r6))
- <a id="dec-ap-18"></a>**DEC-AP-18** · The designs come first, then the requirements written from them, gone over with Max one by one, and only then the build. The domain is not part of version 1. ([REQ-DH-APP-R6](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r6))

## Terms

| Term | Meaning |
| --- | --- |
| [Application](../../definitions.md#application) | An app registered in Data Hub, with its Footprint and its key |
| [Footprint](../../definitions.md#footprint) | What an Application declares about itself when it registers |
| [Feed](../../definitions.md#feed) | What an Application may read: made from a Query, in a Dock |
| [Edition](../../definitions.md#edition) | A frozen version of a Feed |
| [Dock](../../definitions.md#dock) | The container of an Owner Unit with its Feeds and the Applications that may read them |
| [Binding Rule](../../definitions.md#binding-rule) | How a user of a user pool is matched to the rows of a Feed |
| [Minimum Volume](../../definitions.md#minimum-volume) | The fewest observations behind an aggregated value before it is delivered |
| user pool | A pool of AWS Cognito, kept by IT, that identifies the users of an application: website users, agencies, private sellers |
| front door | The part of Data Hub that Applications call; not a Defined Term |

## Flow

1. **Build.** A colleague has an app built, with Claude on the platform of IT, and tries data with their own Claude as they always could.
2. **Make a Feed.** In Query, its Owner Unit makes a Feed from a query, as a Lens is made: its fields, the keys to search on, the fields that count observations and the Minimum Volume, how often, prepared or live. It goes into a Dock. Its first Edition is a draft until an Application reads it.
3. **Register the Application.** Its Footprint, typed in a form or filled from the JSON schema of the platform of IT; per Feed, the Binding Rule to its user pool.
4. **Consent.** Every Owner of every Resource under the Feed gets a request in their Messages, with what they need to decide. Each says yes or no, with why.
5. **Key.** Once every Owner said yes, Data Hub issues the Application its key, shown once.
6. **Deliver.** After every run that succeeded on its Resources, Data Hub prepares the Edition: it runs the query on the rights of the Owner Unit of the Feed, withholds values below the Minimum Volume, checks the Rules of the Owners, and writes the copy into its Firestore, sliced by the Binding Rule; then it switches the front door over to it. A live Feed runs its query at every question.
7. **Watch.** Every Owner sees where their Resources go, and the Log of a Feed tells every delivery, consent and withdrawal.
8. **Change.** The Owner Unit adds a new Edition; the Applications move to it; the old one ends.
9. **Withdraw.** An Owner phases out by a date, or cuts off at once.

## Requirements

*Written on 2026-11-23 from the designs, at the request of Max, to be gone over with him one by one ([DEC-AP-18](#dec-ap-18)). They are proposals, and therefore Proposed.*

<a id="fr-ap-01"></a>
### FR-AP-01 · An application registers before it gets data

**Status:** Proposed · **Source:** [REQ-DH-APP-02](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-02) · **Screens:** [application-register](../../design/screens/application-register.html), [docks-start](../../design/screens/docks-start.html)

An application gets data of Data Hub permanently only as an Application: registered with its Footprint, in a Dock, by a User of an Owner Unit ([DEC-AP-01](#dec-ap-01)). There is no other way in for an application: no key without a registration, no Feed without a Dock. A User and their Claude keep working with data on their own rights, as before; that is not an Application.

**Makes easy:** trying data while an app is being built, and then registering the one app that keeps it. **Makes hard:** a permanent flow that nobody knows of, such as an app reading BigQuery with a key of its own.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-02"></a>
### FR-AP-02 · The Footprint

**Status:** Proposed · **Source:** [REQ-DH-APP-02](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-02), [REQ-DH-APP-04](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-04), [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13) · **Screens:** [application-register](../../design/screens/application-register.html), [application](../../design/screens/application.html)

The Footprint of an Application holds ([DEC-AP-03](#dec-ap-03)): its name and what it does; its owner at IT; internal or external; whether it has users, and on which user pool; the Feeds it reads, each on an Edition, with a Binding Rule when it has users; prepared or live; how often it needs new data; and the statement of [FR-AP-06](#fr-ap-06). Everything is required except the Binding Rule of an Application without users. The page of the Application shows it as written.

**Makes easy:** telling every Owner, in one place, what kind of application comes knocking and how it uses the data. **Makes hard:** an Application that nobody can explain, or whose use is only known to the colleague who registered it.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-03"></a>
### FR-AP-03 · Fill the Footprint from the platform

**Status:** Proposed · **Source:** [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13) · **Screens:** [application-register](../../design/screens/application-register.html)

The registration can be filled from the JSON of the Footprint that the platform of IT provides, pasted or dropped on the page ([OP-AP-08](#op-ap-08)). Data Hub fills every step the JSON holds and marks those fields "From the platform"; the User checks and completes the rest. A JSON that does not follow the schema, or names a user pool or Feed that Data Hub does not know, is refused with what is wrong, and fills nothing.

**Makes easy:** registering an app built on the platform without typing again what the platform already knows. **Makes hard:** a Footprint in Data Hub that says something else than the app on the platform.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-04"></a>
### FR-AP-04 · A user pool Data Hub knows

**Status:** Proposed · **Source:** [REQ-DH-APP-05](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-05) · **Screens:** [application-register](../../design/screens/application-register.html)

An Application with users names one user pool, chosen from the pools Data Hub knows, kept by IT: today Website users, Agencies and Private sellers ([DEC-AP-06](#dec-ap-06)). A new pool is added by the Data Team when IT makes one, with the claims it carries, so that a Binding Rule can use them.

**Makes easy:** naming who the users are in the words IT uses for them. **Makes hard:** an Application that says it has users without saying who vouches for them.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-05"></a>
### FR-AP-05 · A Binding Rule per Feed

**Status:** Proposed · **Source:** [REQ-DH-APP-04](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-04), [REQ-DH-APP-07](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-07) · **Screens:** [application-register](../../design/screens/application-register.html), [application-consent](../../design/screens/application-consent.html), [application](../../design/screens/application.html)

An Application with users has, for every Feed it reads, a Binding Rule: a field of the Feed set equal to a claim of its user pool, such as `leads.company_id = agencies.company_id` ([DEC-AP-03](#dec-ap-03)). Data Hub writes it out as a sentence and as code, and shows what it means for one user: "an agent of agency 1042 sees only the rows where company_id is 1042". A Feed without a field that a claim of the pool can match cannot be chosen for that Application ([OP-AP-09](#op-ap-09)).

**Makes easy:** an Owner seeing, in one line, exactly which user sees which rows. **Makes hard:** an application with users that reads every row of every customer.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-06"></a>
### FR-AP-06 · What the Application knows

**Status:** Proposed · **Source:** [REQ-DH-APP-10](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-10) · **Screens:** [application-register](../../design/screens/application-register.html), [application-consent](../../design/screens/application-consent.html)

Registering an Application asks one required statement, on behalf of the application's owner: that the data is analytical, made by the data platform; that it may come late or not at all, and the application copes with an error; and that the transactional system stays the master of transactional data ([DEC-AP-11](#dec-ap-11), [DEC-AP-10](#dec-ap-10)). Every Owner sees it on the Request for consent.

**Makes easy:** building an application that shows "figures of yesterday" as such, and falls back when they are not there. **Makes hard:** an application that treats a Feed as the truth of the transactional system, or breaks when a delivery is late.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-07"></a>
### FR-AP-07 · A Dock, of an Owner Unit

**Status:** Proposed · **Source:** [REQ-DH-APP-10](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-10), [REQ-DH-APP-R1](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r1) · **Screens:** [dock](../../design/screens/dock.html), [docks-start](../../design/screens/docks-start.html)

A Dock belongs to one Owner Unit, which makes it, names it and describes it. It holds the Feeds of that Owner Unit and the Applications registered on it: "this data can be asked for, and these Applications may ask for it" ([DEC-AP-02](#dec-ap-02)). Its page lists both, with their state. Every User sees the Docks; only its Owner Unit and the Data Team change one.

**Makes easy:** finding, in one place, what an Owner Unit offers to applications and who reads it. **Makes hard:** Feeds scattered over Collections, with no one who answers for what goes out.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-08"></a>
### FR-AP-08 · Make a Feed from a query

**Status:** Proposed · **Source:** [REQ-DH-APP-08](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-08), [REQ-DH-APP-R1](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r1) · **Screens:** [feed-new](../../design/screens/feed-new.html)

In Query, a query offers "Make it a Feed" beside "Make it a Lens". It opens, in five steps, what the Feed is and its Dock, its fields, its Minimum Volume, its delivery, and who must say yes ([DEC-AP-02](#dec-ap-02)). The User chooses a Dock of one of their Owner Units, which becomes the Owner Unit of the Feed. Saving makes Edition 1 of the Feed, a Draft until an Application reads it.

**Makes easy:** turning a query that answers an application's question into something that application may read. **Makes hard:** an application reading a Lens meant for people, whose query its author may change any day.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-09"></a>
### FR-AP-09 · Search keys

**Status:** Proposed · **Source:** [REQ-DH-APP-07](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-07) · **Screens:** [feed-new](../../design/screens/feed-new.html), [feed](../../design/screens/feed.html)

A Feed names at most three fields as search keys: the fields an Application may filter on, such as area_id, property_type and period_month ([DEC-AP-09](#dec-ap-09)). A prepared Feed can be searched on its search keys only, within the slice of the user; a question on another field is refused with which keys it has.

**Makes easy:** a copy that answers every question its Application asks quickly, from the start. **Makes hard:** an Application asking ad hoc questions of a copy that was never built to answer them.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-10"></a>
### FR-AP-10 · Count fields and the Minimum Volume

**Status:** Proposed · **Source:** [REQ-DH-APP-11](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-11), [REQ-DH-APP-R2](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r2) · **Screens:** [feed-new](../../design/screens/feed-new.html), [feed](../../design/screens/feed.html), [application-consent](../../design/screens/application-consent.html)

For every aggregated field, a Feed names the field that counts its observations, such as n_sales for price_median. Its Owner Unit sets the Minimum Volume, never below the floor of Data Hub, 5 ([OP-AP-02](#op-ap-02)). At every delivery, Data Hub leaves a value empty when its count is below the minimum, and says why, "too few observations"; the step shows how many values the last run would withhold now, per field ([DEC-AP-12](#dec-ap-12)).

**Makes easy:** publishing an average per street that gives away nobody's house, and falling back on the municipality. **Makes hard:** a figure that looks like statistics but is the price of one recognisable sale.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-11"></a>
### FR-AP-11 · Prepared or live

**Status:** Proposed · **Source:** [REQ-DH-APP-06](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-06), [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12), [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13) · **Screens:** [feed-new](../../design/screens/feed-new.html), [feed](../../design/screens/feed.html)

A Feed is delivered prepared or live ([DEC-AP-08](#dec-ap-08)). Prepared: Data Hub runs its query after a run of its Resources and serves the result from a copy. Live: Data Hub runs its query at every question, and only an internal Application may read it. A prepared Feed names how often: after every run of its Resources, at most hourly, or daily ([OP-AP-07](#op-ap-07)).

**Makes easy:** an internal tool that wants today's figures, and an external system that wants a stable copy, each getting what suits it. **Makes hard:** a transactional system that depends on BigQuery for every page it shows.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-12"></a>
### FR-AP-12 · A live Feed reads little

**Status:** Proposed · **Source:** [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13) · **Screens:** [feed-new](../../design/screens/feed-new.html)

A live Feed whose question reads more than 100 MB is refused for live, with why and with the offer to make it prepared ([OP-AP-06](#op-ap-06)), as Excel refuses a Lens it cannot run unasked ([OP-CH-04](13-channels.md#op-ch-04)). The Pre-flight of its query is shown in the step Delivery.

**Makes easy:** a live Feed that answers in seconds and costs little. **Makes hard:** an internal tool that scans gigabytes at every click without anyone choosing it.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-13"></a>
### FR-AP-13 · Who must say yes, known before anyone asks

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [feed-new](../../design/screens/feed-new.html), [feed](../../design/screens/feed.html)

From the Resources its query reads, a Feed lists every Owner Unit that must say yes, with its Resource and the fields of it that leave ([DEC-AP-04](#dec-ap-04)). It is shown while the Feed is made, so that its maker knows whom they will ask once an Application wants it; nobody is asked before.

**Makes easy:** knowing, before building an app on a Feed, whose yes it needs. **Makes hard:** a surprise refusal after the app was built.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-14"></a>
### FR-AP-14 · The page of a Feed

**Status:** Proposed · **Source:** [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12) · **Screens:** [feed](../../design/screens/feed.html)

The page of a Feed shows its Dock and Owner Unit, its Level, the lowest of its Resources, as a Lens takes it ([DEC-DH-72](../../overview/open-themes.md#dec-dh-72)), and its Editions. Its tabs: Overview, with its state, the deliveries of the last 14 days, the Applications that read it and on which Edition, and the answer of every Owner; Fields, per Edition, with search keys, count fields and Minimum Volume; Query, its SQL, read-only; and Log.

**Makes easy:** seeing at a glance whether a Feed is delivered, to whom, and with whose consent. **Makes hard:** a Feed that silently stopped delivering.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-15"></a>
### FR-AP-15 · A Feed reads on the rights of its Owner Unit

**Status:** Proposed · **Source:** [REQ-DH-APP-14](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-14), [REQ-DH-APP-R4](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r4) · **Screens:** [feed](../../design/screens/feed.html), [feed-new](../../design/screens/feed-new.html)

A Feed runs its query on the rights of its Owner Unit: the Resources it reads are those its Owner Unit may read ([DEC-AP-07](#dec-ap-07)). It does not depend on the person who made it, nor on the user of the Application. A Feed whose Owner Unit loses the right to read one of its Resources stops being delivered, as Broken ([DEC-DH-67](../../overview/data-hub.md#dec-dh-67)).

**Makes easy:** a link that lasts when its maker changes job. **Makes hard:** a Feed that keeps reading what its Owner Unit may no longer see.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-16"></a>
### FR-AP-16 · An Edition is a Draft until it is read, then frozen

**Status:** Proposed · **Source:** [REQ-DH-APP-R3](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r3) · **Screens:** [feed](../../design/screens/feed.html), [feed-edition-new](../../design/screens/feed-edition-new.html)

An Edition of a Feed can be changed while it is a Draft. From the moment an Application reads it, it is frozen: its query, fields, search keys, count fields, Minimum Volume and how often ([DEC-AP-14](#dec-ap-14)). An Application names the Edition it reads.

**Makes easy:** an Application that can rely on what it reads today being what it reads tomorrow. **Makes hard:** a change under an application that was never told.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-17"></a>
### FR-AP-17 · A new Edition, and when the old one ends

**Status:** Proposed · **Source:** [REQ-DH-APP-R3](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r3) · **Screens:** [feed-edition-new](../../design/screens/feed-edition-new.html), [feed](../../design/screens/feed.html)

The Owner Unit of a Feed changes it by making a new Edition, from the query of the current one, and sees what changes: fields added, removed or changed in type, search keys and Minimum Volume, and which Owners must say yes again: only those of a Resource it newly reads ([OP-AP-03](#op-ap-03)). When the new Edition is live, the Applications on the old one are told; the old one keeps being delivered until no Application reads it, at the latest 90 days later, which the Owner Unit may extend. At most two Editions are live at once.

**Makes easy:** improving a Feed, such as adding the standard deviation, without breaking the applications that read it. **Makes hard:** changing a Feed in place, or keeping old Editions alive for ever.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-18"></a>
### FR-AP-18 · Every Owner says yes before a Feed is read

**Status:** Proposed · **Source:** [REQ-DH-APP-03](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-03), [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [application-consent](../../design/screens/application-consent.html), [application](../../design/screens/application.html)

Before an Application reads a Feed, the Owner Unit of every Resource under it says yes ([DEC-AP-04](#dec-ap-04)). Registering the Application sends each a Request for consent; the Owner Unit of the Feed and the Data Team cannot answer in their place. An Application reads a Feed only once every answer for it is yes.

**Makes easy:** the Owners of the data deciding where it goes, each for their own. **Makes hard:** data leaving Data Hub because the colleague who wanted it could build the Feed.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-19"></a>
### FR-AP-19 · The Request for consent shows what leaves

**Status:** Proposed · **Source:** [REQ-DH-APP-04](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-04), [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [application-consent](../../design/screens/application-consent.html)

The Request for consent opens in the Message Centre ([OP-UX-128](../../design/principles.md#op-ux-128)) and shows, in this order: the Application and what it does, internal or external; who reads, the user pool or no users; the Binding Rule written out, and for one user; the Feed and its Edition, and the fields of the Owner's Resources that leave, those of other Owners greyed; the aggregates and their Minimum Volume; how often, prepared or live; the statement of [FR-AP-06](#fr-ap-06); and the answers of the other Owners.

**Makes easy:** an informed yes, from what the Owner can read in one screen. **Makes hard:** a yes to "an app wants your data" without knowing which rows, for whom, how often.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-20"></a>
### FR-AP-20 · No needs a reason

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [application-consent](../../design/screens/application-consent.html)

An Owner answers Yes, or No with a reason, required. The reason goes to the Owner Unit of the Feed and into the Log of the Application. A No can be changed to Yes later; a Yes is changed by withdrawing ([FR-AP-34](#fr-ap-34), [FR-AP-35](#fr-ap-35)).

**Makes easy:** a refusal that the colleague asking can act on, such as leaving out one field. **Makes hard:** a silent No, or a Request that stays unanswered without anyone knowing why.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-21"></a>
### FR-AP-21 · A change to the Footprint asks again

**Status:** Proposed · **Source:** [REQ-DH-APP-02](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-02) · **Screens:** [application](../../design/screens/application.html)

A change to the Footprint that touches what an Owner said yes to (another user pool, another Binding Rule, live in place of prepared, a Feed or Edition that reads a new Resource) sends that Owner a new Request; until they say yes, the Application keeps reading what was consented to. A change of its name or description asks nobody.

**Makes easy:** keeping a Footprint true to the application as it grows. **Makes hard:** widening what an application reads under a yes given for something smaller.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-22"></a>
### FR-AP-22 · The key: after every yes, shown once

**Status:** Proposed · **Source:** [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5) · **Screens:** [application](../../design/screens/application.html), [admin-applications](../../design/screens/admin-applications.html)

An Application gets its key once every Owner said yes to at least one of its Feeds ([DEC-AP-06](#dec-ap-06)). The User makes it on the page of the Application; it is shown once, to copy into the secret store of the platform of IT, and never again ([OP-AP-04](#op-ap-04)).

**Makes easy:** a key that exists only for an Application that may read something. **Makes hard:** a key handed out before the Owners decided, or one kept in a chat or a document.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-23"></a>
### FR-AP-23 · Revoke or renew a key

**Status:** Proposed · **Source:** [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5) · **Screens:** [application](../../design/screens/application.html), [admin-applications](../../design/screens/admin-applications.html)

The Owner Unit of the Dock and the Data Team revoke the key of an Application at once, or renew it, which stops the old key when the new one is first used or after a week. A revoked key answers "Not allowed" ([FR-AP-30](#fr-ap-30)).

**Makes easy:** stopping a leaked key in one click. **Makes hard:** an application that keeps reading with a key nobody can stop.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-24"></a>
### FR-AP-24 · Two identities on every question

**Status:** Proposed · **Source:** [REQ-DH-APP-05](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-05), [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5) · **Screens:** [application](../../design/screens/application.html)

Every question to the front door carries the key of the Application, and, for an Application with users, the Cognito token of its user ([DEC-AP-06](#dec-ap-06)). Data Hub checks both on every question: the key names the Application and the Feeds it may read; the token must be valid, of the user pool of the Footprint, and carry the claim its Binding Rule uses. Otherwise the answer is "Not allowed".

**Makes easy:** knowing, for every answer, which application asked and for whom. **Makes hard:** an application that asks in the name of any customer it likes.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-25"></a>
### FR-AP-25 · Only the slice of the user

**Status:** Proposed · **Source:** [REQ-DH-APP-04](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-04), [REQ-DH-APP-06](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-06), [REQ-DH-APP-07](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-07) · **Screens:** [application](../../design/screens/application.html), [application-consent](../../design/screens/application-consent.html)

For an Application with users, Data Hub answers only with the rows its Binding Rule allows for the user of the token ([DEC-AP-09](#dec-ap-09)): the copy of a prepared Feed is partitioned on that identity, and a live Feed adds the rule to its query. A user for whom no row exists gets an empty answer, not an error.

**Makes easy:** an agents' portal in which every agent sees their own figures and nothing else. **Makes hard:** a bug in an application showing one customer the figures of another.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-26"></a>
### FR-AP-26 · Only the Feeds and Editions consented to

**Status:** Proposed · **Source:** [REQ-DH-APP-03](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-03) · **Screens:** [application](../../design/screens/application.html)

An Application reads only the Feeds of its Footprint, on the Editions it named, that every Owner said yes to. A question for another Feed or Edition is answered "Not allowed", with which ones it may read.

**Makes easy:** an Application that reads exactly what was approved. **Makes hard:** reaching for a Feed nobody approved for this Application.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-27"></a>
### FR-AP-27 · A prepared Feed is delivered after a successful run

**Status:** Proposed · **Source:** [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12) · **Screens:** [feed](../../design/screens/feed.html), [dock](../../design/screens/dock.html)

Data Hub delivers a prepared Feed after a run of the Source Job that builds its Resources succeeded, as often as its Footprint asks ([DEC-AP-10](#dec-ap-10)): it runs the query on the rights of its Owner Unit, applies the Minimum Volume and the Rules of the Owners, writes the copy in its Firestore, sliced by the Binding Rule ([DEC-AP-09](#dec-ap-09)), and only then switches the front door over to it. A delivery is complete or not made at all.

**Makes easy:** an Application that only ever reads a whole, checked delivery. **Makes hard:** an Application reading a half-written copy, or data of a run that failed.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-28"></a>
### FR-AP-28 · Late: the last good delivery is served

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09), [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12) · **Screens:** [feed](../../design/screens/feed.html), [application](../../design/screens/application.html)

When a run fails or a delivery is not made, the Feed is Late: the front door keeps serving the last good delivery, and every answer carries its date ([DEC-AP-10](#dec-ap-10)). Late is not an error. Its Owner Unit hears it; the Applications see the date.

**Makes easy:** an application that always has data to show, and says from when. **Makes hard:** an empty page because one night's run failed.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-29"></a>
### FR-AP-29 · The Rules of the Owners guard a delivery

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09), [REQ-DH-APP-13](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-13) · **Screens:** [feed](../../design/screens/feed.html)

Before a delivery, the Rules of the Monitor of every Resource under the Feed are evaluated ([DEC-AP-13](#dec-ap-13)). A Rule with Quarantine cuts the Feed off: its Applications get "Cut off". A Rule with the Action Hold the deliveries ([OP-AP-12](#op-ap-12)) makes the Feed Held: the last good delivery is served until the Owner releases it. The Owner Unit of the Feed hears both, with the Rule that fired.

**Makes easy:** an Owner stopping bad data at the door, before an agent sees it in a portal. **Makes hard:** a wrong figure going out because the Monitor only told the Owner after the fact.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-30"></a>
### FR-AP-30 · A distinct answer per cause

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09), [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5) · **Screens:** [application](../../design/screens/application.html), [admin-applications](../../design/screens/admin-applications.html)

An answer of the front door that is not data says its cause, distinct per cause, with a sentence for the people who build the application ([DEC-AP-10](#dec-ap-10)): "Cut off by an Owner", "Not allowed" (a key, a token, a Feed or an Edition that is not allowed), and "Data Hub unavailable". Late and Held are no errors: they serve data with its date. The page of an Application counts its errors per cause, per day.

**Makes easy:** an application that reacts to each cause as it should: wait, fall back, or call IT. **Makes hard:** every problem looking like "500", and nobody knowing whose it is.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-31"></a>
### FR-AP-31 · A prepared Feed does not depend on BigQuery

**Status:** Proposed · **Source:** [REQ-DH-APP-06](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-06), [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12) · **Screens:** [feed](../../design/screens/feed.html)

The front door answers a question to a prepared Feed from its copy alone: when BigQuery, query or the database of Data Hub are unavailable, it keeps answering with the last delivery ([NFR-AVL-02](../non-functional/availability.md#nfr-avl-02)).

**Makes easy:** a portal that keeps working while the data platform is down. **Makes hard:** tying the uptime of a customer-facing system to that of the analytical stack.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-32"></a>
### FR-AP-32 · The state of a Feed and an Application, everywhere

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09), [REQ-DH-APP-12](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-12) · **Screens:** [dock](../../design/screens/dock.html), [feed](../../design/screens/feed.html), [application](../../design/screens/application.html), [docks-start](../../design/screens/docks-start.html)

Wherever a Feed or an Application is listed, its state shows in a word and a colour: Up to date, Late, Held, Cut off, Waiting for consent, Phasing out, or Draft ([OP-UX-122](../../design/principles.md#op-ux-122)). Late, Held and Phasing out are in the colour of a warning, Cut off in the urgent red.

**Makes easy:** seeing what needs attention in any list. **Makes hard:** a Feed that is cut off looking the same as one that is fine.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-33"></a>
### FR-AP-33 · Where a Resource goes

**Status:** Proposed · **Source:** [REQ-DH-APP-14](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-14) · **Screens:** [resource-applications](../../design/screens/resource-applications.html)

The page of a Resource has a tab Applications when a Feed reads it: every Feed that reads it, with its Dock, Edition and the fields of the Resource it reads, and every Application on that Feed, with the answer of the Resource's Owner Unit, when and by whom, and its state ([DEC-AP-04](#dec-ap-04)). Every User who sees the Resource sees the tab.

**Makes easy:** an Owner knowing at any time where their data goes. **Makes hard:** data that went out once and was forgotten.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-34"></a>
### FR-AP-34 · Phase out by a date

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [resource-applications](../../design/screens/resource-applications.html)

The Owner Unit of a Resource withdraws its yes for an Application by phasing out: by a date, 14 days ahead by default and never in the past ([DEC-AP-05](#dec-ap-05)). The Application and the Owner Unit of its Dock are told at once, and every day of the last week; on that date, every Feed that reads the Resource stops answering that Application with "Cut off by an Owner". The withdrawal stays listed, with when and by whom.

**Makes easy:** stopping an application's use of a Resource without breaking it overnight. **Makes hard:** a withdrawal that nobody on the side of the application heard of.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-35"></a>
### FR-AP-35 · Cut off now

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [resource-applications](../../design/screens/resource-applications.html), [application](../../design/screens/application.html)

The Owner Unit of a Resource cuts an Application off at once, with a reason, required ([DEC-AP-05](#dec-ap-05)): every Feed that reads the Resource answers that Application "Cut off by an Owner" from that moment. The Application, the Owner Unit of its Dock and the Data Team are told, with the reason. Cutting off is undone only by a new yes.

**Makes easy:** an Owner stopping a leak at once. **Makes hard:** cutting off without saying why, or by accident.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-36"></a>
### FR-AP-36 · An Owner Unit with a Feed in use stays

**Status:** Proposed · **Source:** [REQ-DH-APP-R4](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r4)

An Owner Unit that holds a Dock with a Feed that an Application reads cannot be deleted until the Dock moves to another Owner Unit, as one that owns a Collection cannot ([FR-UM-16](02-user-management.md#fr-um-16), [DEC-AP-15](#dec-ap-15)).

**Makes easy:** a link to an application that never loses its owner. **Makes hard:** an application reading a Feed that nobody answers for.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-37"></a>
### FR-AP-37 · The Log of a Feed and an Application

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [feed](../../design/screens/feed.html), [application](../../design/screens/application.html)

A Feed and an Application each keep a Log: every Edition, delivery that failed or was held, Request, answer, withdrawal, key made, renewed or revoked, and change of the Footprint, with when and by whom.

**Makes easy:** answering, months later, why an application got what it got. **Makes hard:** a consent or a withdrawal that left no trace.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-38"></a>
### FR-AP-38 · Who hears what

**Status:** Proposed · **Source:** [REQ-DH-APP-09](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-09) · **Screens:** [docks-start](../../design/screens/docks-start.html), [application-consent](../../design/screens/application-consent.html)

The Owner Unit of a Resource gets a Request for consent, and a Message when an Application it said yes to changes its Footprint or a new Edition is made. The Owner Unit of a Feed gets a Message when it is Late, Held or Cut off, and with every answer to a Request. An Application is told, through its owner at IT, of a phase-out, a cut-off and an ending Edition ([Log and notifications](07-log-and-notifications.md)).

**Makes easy:** each person hearing what they can act on. **Makes hard:** an Owner flooded with deliveries, or a builder who learns of a cut-off from a customer.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-39"></a>
### FR-AP-39 · Admin · Applications

**Status:** Proposed · **Source:** [REQ-DH-APP-R5](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-r5) · **Screens:** [admin-applications](../../design/screens/admin-applications.html)

Admin has a tool Applications for the Data Team: every Application of the environment, with its Dock, internal or external, user pool, state, last question, errors of the last day and its key. The Data Team revokes a key at once, confirmed in the row ([FR-AP-23](#fr-ap-23)).

**Makes easy:** the Data Team overseeing every flow that leaves Data Hub. **Makes hard:** an application nobody at the Data Team knows reads data.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="fr-ap-40"></a>
### FR-AP-40 · The start screen of Docks

**Status:** Proposed · **Source:** [REQ-DH-APP-02](../../workshops/2026-11-23-delivery-to-applications.md#req-dh-app-02) · **Screens:** [docks-start](../../design/screens/docks-start.html)

Docks open on a start screen: an intro that says how an application gets data, with "Register an Application"; for an Owner, the Requests for consent waiting for their answer; the Docks of the User's Owner Units with what needs attention; and what happened lately ([OP-UX-121](../../design/principles.md#op-ux-121)).

**Makes easy:** an Owner finding their pending answers first. **Makes hard:** a Request for consent waiting for weeks in a list nobody opens.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

## Edge cases

<a id="ec-ap-01"></a>
### EC-AP-01 · A Resource under a Feed is withdrawn by dbt

**Status:** Proposed · **Screens:** [feed](../../design/screens/feed.html)

The Feed is Broken ([DEC-DH-67](../../overview/data-hub.md#dec-dh-67)): a prepared Feed keeps serving its last good delivery, Late, until its Owner Unit makes an Edition without that Resource; a live Feed answers "Data Hub unavailable", with the reason Broken. Its Owner Unit and the Owner Units of its Applications are told.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="ec-ap-02"></a>
### EC-AP-02 · An Owner Unit that said yes changes or empties

**Status:** Proposed

A yes is given by an Owner Unit, not by a person, and stays when the person who answered leaves. When the Resource moves to a Collection of another Owner Unit, that Owner Unit gets a Message with the Applications reading it, and may withdraw; the yes of the former Owner Unit holds until then.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="ec-ap-03"></a>
### EC-AP-03 · A new Edition while a Request is open

**Status:** Proposed · **Screens:** [feed-edition-new](../../design/screens/feed-edition-new.html)

A Request names the Edition it is for. When a new Edition goes live while a Request for the old one is open, the Request stays for the old one; the Application can move to the new Edition only once the Owners it newly needs said yes.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="ec-ap-04"></a>
### EC-AP-04 · One Owner says No

**Status:** Proposed · **Screens:** [application](../../design/screens/application.html)

An Application reads no Feed whose Owners did not all say yes. It keeps its other Feeds, if any. The Owner Unit of its Dock sees the reason, and may change the Footprint, such as leaving out a field or a Resource, which asks again.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="ec-ap-05"></a>
### EC-AP-05 · A token of another user pool

**Status:** Proposed · **Screens:** [application](../../design/screens/application.html)

A question carrying a valid token of another user pool than the Footprint names is answered "Not allowed", and counted as such on the page of the Application: a sign that the application sends the wrong token, not that a user is wrong.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

<a id="ec-ap-06"></a>
### EC-AP-06 · A value hovers around the Minimum Volume

**Status:** Proposed · **Screens:** [feed](../../design/screens/feed.html)

A value whose count is the minimum one day and below it the next is delivered one day and left empty the next. Data Hub does not smooth it: the Application falls back on the level above for that day, which it must be able to do anyway.

*Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

## Out of scope

- Exports to people and their tools, such as Excel, and structural exports by the Data Team: [Channels](13-channels.md).
- Claude reading data for a User: [Claude](17-claude.md); it stays on the rights of that User.
- How IT builds applications and keeps its user pools: the platform of IT.
- Hardening a Beta Concept into a dbt model: [Beta and promotion](11-beta-and-promotion.md). A Feed reads Resources at any Level; its Level shows, as a Lens shows its own ([DEC-DH-72](../../overview/open-themes.md#dec-dh-72)).

## Open points

- [ ] <a id="op-ap-01"></a>**OP-AP-01** · Confirm the names Application, Footprint, Feed, Edition, Dock, Binding Rule and Minimum Volume, chosen by Claude at the request of Max. *Raised on 2026-11-23, when the names were chosen.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-02"></a>**OP-AP-02** · Decide how the Minimum Volume is set and kept. Proposal: a Feed names, for every aggregated field, the field that counts its observations; Data Hub withholds a value whose count is below the minimum, leaves it empty and says why ("too few observations"), so that an Application can fall back on a level above, such as the municipality for a street. The Owner Unit of the Feed sets the minimum, never below a floor of Data Hub of 5; every Owner who consents sees it and may ask for more. *Raised on 2026-11-23, in the review of the plan.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-03"></a>**OP-AP-03** · Decide how Editions live. Proposal: an Edition is a draft until an Application reads it, and frozen from then on; an Application names the Edition it reads; the old Edition keeps being delivered until no Application reads it, at the latest 90 days after the next one is live; at most two Editions are live at once; a new Edition that reads a Resource of another Owner needs that Owner's yes first, the others carry over. *Raised on 2026-11-23, in the review of the plan.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-04"></a>**OP-AP-04** · Decide, with IT, how an Application proves itself and how Data Hub checks the token of its user. Proposal: Data Hub issues every Application a key, as it does an Excel key, shown once and kept in the secret store of the platform of IT; Data Hub checks a Cognito token against the published keys of the user pool named in the Footprint. *Raised on 2026-11-23, in the review of the plan.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-05"></a>**OP-AP-05** · Work out how the front door is released without going down: new revisions take traffic gradually, a new release reads the copies of the one before, and a delivery switches over to a new copy only when it is complete. *Raised on 2026-11-23, in the review of the plan.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-06"></a>**OP-AP-06** · Decide what a live Feed may read per question. Proposal: up to 100 MB per question, as a run its User need not approve ([DEC-SR-29](04-stacks-and-resources.md#dec-sr-29)); a Feed whose question reads more is refused for live, with why, and offered as prepared, as Excel refuses such a Lens ([OP-CH-04](13-channels.md#op-ch-04)). *Raised on 2026-11-23, in the design.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-07"></a>**OP-AP-07** · Decide how often a prepared Feed can be delivered. Proposal: after every run of the Source Job that builds one of its Resources, at most once an hour, and the Footprint names how often the Application needs it: daily by default. *Raised on 2026-11-23, in the design.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-08"></a>**OP-AP-08** · Agree with IT on the JSON schema of the Footprint: who keeps it, how it is versioned, and how the platform hands it to Data Hub. *Raised on 2026-11-23, in the design.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-09"></a>**OP-AP-09** · Decide how a Binding Rule reaches a user pool whose identifier is not a field of the Feed, such as a user of an agency known only by their e-mail. Proposal: a Binding Rule may go through one Resource that maps the two, named in the rule and consented to like the others. *Raised on 2026-11-23, in the design.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-10"></a>**OP-AP-10** · Decide whether a Resource that holds personal data may go to an external Application at all, and how its Owner sees that on the request. *Raised on 2026-11-23, in the design: the Resource Card holds a level of confidentiality, and privacy has no requirements yet ([non-functional](../non-functional/README.md)).* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-11"></a>**OP-AP-11** · Decide what an Owner sees of how much an Application reads: the questions per day per Feed, or no more than that it reads. Usage reporting on Data Hub is not part of v1 ([DEC-DH-75](../../overview/data-hub.md#dec-dh-75)). *Raised on 2026-11-23, in the design.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*
- [ ] <a id="op-ap-12"></a>**OP-AP-12** · Decide whether a Rule of a Monitor gets a new Action, **Hold the deliveries**, next to Quarantine ([DEC-CM-09](08-checks-and-monitoring.md#dec-cm-09)): it keeps serving every Application the last good delivery of the Feeds that read the Resource, until the Owner releases it, where Quarantine cuts them off. Proposal: yes; it is what "late" means to an Application, chosen by the Owner. *Raised on 2026-11-23, in the design.* *Could, not in v1: set on 2026-11-23, by Max ([DEC-AP-18](#dec-ap-18)).*

## Builds on

- [Interview on delivery to applications, 2026-11-23](../../workshops/2026-11-23-delivery-to-applications.md)
- [Data Hub overview](../../overview/data-hub.md)
- [Checks and monitoring](08-checks-and-monitoring.md), for the Rules of the Owners and Quarantine
- [Permissions and Excel keys](12-permissions-and-library-cards.md), for the precedent of a key
