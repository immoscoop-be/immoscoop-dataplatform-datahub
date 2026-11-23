# Interview on delivery to applications, 2026-11-23

| | |
| --- | --- |
| Type | Source: the requirements for delivering data from Data Hub to applications, from an interview |
| Date | 2026-11-23 |
| Status | Answers of Max, in an interview of fifteen questions by Claude Code, and his review of the plan that followed; recorded as the domain [Applications](../requirements/functional/18-applications.md) |
| Origin | Interview Max × Claude Code, 23 November 2026 (session "data-hub - Build - data-passthrough") |
| Taken in | 2026-11-23, translated from Dutch |

**In one sentence:** why and how Data Hub may deliver its data to applications, which it never did before, as Max answered it question by question, and where each answer is recorded in this repository.

*Max opened the session by reconsidering a standing decision: that Data Hub never exposes its data to other systems ([DEC-DH-43](../overview/data-hub.md#dec-dh-43), [DEC-DH-44](../overview/data-hub.md#dec-dh-44), [FR-CH-01](../requirements/functional/13-channels.md#fr-ch-01), [FR-CH-02](../requirements/functional/13-channels.md#fr-ch-02)). Given the strength of the MCP, and that business can be in the lead over which data goes where, he asked to be interviewed about the idea, one question at a time. Each answer is translated faithfully, followed by what it became. Where a later answer or the review changed an earlier one, that is said under it; nothing is silently fixed.*

*Four names did not come from Max: he asked Claude to choose them, and may still change them ([OP-AP-01](../requirements/functional/18-applications.md#op-ap-01)). What Max called "app lens" (his working name) became **Feed**; the "connector", "collection" or "app" that holds them became **Dock**; a version of a Feed became an **Edition**; an app registered in Data Hub became an **Application** ([definitions](../definitions.md)).*

## 0. Key decisions (summary)

1. **A permanent flow of data to an application goes through Data Hub,** registered, with its footprint. Chatting with data while an app is being built stays as it is.
2. **The Owners say yes:** every Owner of every Resource the data comes from, informed by Data Hub about how it will be used. Each can withdraw at any time.
3. **What the Owner approves is a binding rule:** which user of which user pool may see which rows.
4. **Identity is IT's:** applications are built on the platform of IT and identify their users with AWS Cognito.
5. **A transactional system never queries BigQuery.** It reads its own copy, which Data Hub fills after every successful run, sliced per customer.
6. **Late or never:** the data is always there, but may be late; the answer to an application may be an error.
7. **The transactional system stays the master.** Data Hub only adds analytical data, and the application knows it.
8. **Aggregates need a minimum volume.**
9. **It runs on the rights of whoever made the link,** kept by an Owner Unit; Data Hub has no row-level privileges.
10. **The first case is the structured data of the SEO pages.**

**Recorded as:** the decisions [DEC-AP-01](../requirements/functional/18-applications.md#dec-ap-01) to [DEC-AP-18](../requirements/functional/18-applications.md#dec-ap-18) and [DEC-DH-85](../overview/data-hub.md#dec-dh-85); the requirements written from the designs the same night, [FR-AP-01](../requirements/functional/18-applications.md#fr-ap-01) to [FR-AP-40](../requirements/functional/18-applications.md#fr-ap-40), [EC-AP-01](../requirements/functional/18-applications.md#ec-ap-01) to [EC-AP-06](../requirements/functional/18-applications.md#ec-ap-06), [NFR-AVL-01](../requirements/non-functional/availability.md#nfr-avl-01), [NFR-AVL-02](../requirements/non-functional/availability.md#nfr-avl-02) and [NFR-SEC-05](../requirements/non-functional/security.md#nfr-sec-05), all Proposed, to be gone over with Max.

## 1. The interview

<a id="req-dh-app-01"></a>
### REQ-DH-APP-01 · Why now

*Question: today, everything that leaves Data Hub goes through the Data Team into dbt or the Domain Model ([DEC-DH-44](../overview/data-hub.md#dec-dh-44)). What goes wrong with that route?*

Max sees more and more artifacts, and applications too, being created. He does not find it bad at all that someone has an application built, mostly with Claude. Such an application should be able to say: "I now want to ask Data Hub this particular thing". Data Hub prepares it for them, but then it also gets hardened in some way.

**Recorded as:** the context of [Applications](../requirements/functional/18-applications.md).

<a id="req-dh-app-02"></a>
### REQ-DH-APP-02 · Chatting, or a permanent flow

*Question: from when may such an app use the data live, and who hardens it?*

Max asked first that the interview be questions only, without lists of options. Then: a colleague makes an application, wants to use data and can simply chat with that data; that is fine. If they want to set up a kind of permanent flow, they follow a process in which that flow is set up. Why: when the application comes knocking, Max wants to know what kind of application it is, and how the data sent to it will be used.

Today information is never sent to an application unless the Data Team does it. Max wants to prepare for it also being offered through Data Hub, with a register in which applications, when they come knocking, give their footprint. Then Data Hub knows, for example: this is an external application, authenticated on the user pool of customers; so it delivers only in parts, the application may only read by the key it has per customer, and there is clean partitioning across the customers.

**Recorded as:** [DEC-AP-01](../requirements/functional/18-applications.md#dec-ap-01), [DEC-AP-03](../requirements/functional/18-applications.md#dec-ap-03).

<a id="req-dh-app-03"></a>
### REQ-DH-APP-03 · Who says yes

*Question: who judges the registration and says "yes, this app may get this"?*

An Owner, and the Owner must be informed well enough, through Data Hub, about how their information is used.

**Recorded as:** [DEC-AP-04](../requirements/functional/18-applications.md#dec-ap-04).

<a id="req-dh-app-04"></a>
### REQ-DH-APP-04 · What the Owner sees

*Question: what must Data Hub show an Owner to say yes with peace of mind, and what is a reason to say no?*

Every app states whether it runs behind an authentication mechanism or not; that is the first step. If it does: on which user pool. With a user pool, for example the real estate agencies, Data Hub must set out how the data the app asks for is linked to that pool: how it matches that this agent may see this data. That is what the Owner says yes to. As Owner of the leads, Max wants to see somewhere `leads.companyid = usercoolagencies.companyid`, or something like it.

**Recorded as:** [DEC-AP-03](../requirements/functional/18-applications.md#dec-ap-03), with the Binding Rule ([definitions](../definitions.md#binding-rule)).

<a id="req-dh-app-05"></a>
### REQ-DH-APP-05 · Who vouches for the identity

*Question: how does Data Hub know for sure that it is agent X who asks, and not agent Y or a bug in an app Claude built?*

IT takes care of that, Ben in particular. Applications are meant to be built on his platform. An application connects to AWS Cognito, which can identify the users of the website, the agencies (the customers) and the private sellers who place their own listings. Those are the three user pools Max thinks of now; there may be more in the future.

**Recorded as:** [DEC-AP-06](../requirements/functional/18-applications.md#dec-ap-06).

<a id="req-dh-app-06"></a>
### REQ-DH-APP-06 · A database of its own

*Question: if Data Hub puts the leads of all agents in a database of the app, the platform guards the binding rule and no longer Data Hub. Is that fine, or must the slice per customer already be cut there?*

That is where Data Hub itself manages which data goes where. Max does not want a transactional system, for example one made for the agents, to query BigQuery directly. He much prefers that the transactional system has its own database, written periodically by BigQuery and Data Hub. What matters is that the partitioning is right, or that the components are there that make sure the right data goes to the right person: confidentiality.

**Recorded as:** [DEC-AP-08](../requirements/functional/18-applications.md#dec-ap-08), [DEC-AP-09](../requirements/functional/18-applications.md#dec-ap-09).

<a id="req-dh-app-07"></a>
### REQ-DH-APP-07 · One front door

*Question: who builds the part that guarantees that agent X reads only their own slice, and how far must the separation go?*

Max likes the idea of sending the Cognito token back along. If the agent, or whatever identification, can be derived from it, he sees a kind of app, next to Data Hub or in it, that makes information available. That app can make the choice: a connection A that comes from an internal system queries BigQuery; a connection B from an external application reads from a scalable set of MongoDB databases. The latter is more complex: the keys on which it can be searched must be decided up front. It is always partitioned on the token, so that someone can only search in their own pool; but within that data one also wants to search, and Max understands MongoDB is not very strong at that.

*Changed in the review of the plan: the serving store is Firestore ([REQ-DH-APP-R5](#req-dh-app-r5)).*

**Recorded as:** [DEC-AP-08](../requirements/functional/18-applications.md#dec-ap-08), [DEC-AP-09](../requirements/functional/18-applications.md#dec-ap-09).

<a id="req-dh-app-08"></a>
### REQ-DH-APP-08 · What an app asks for

*Question: is it a Lens with its Parameters, a whole Resource, or something else; and who makes it?*

Lenses are what Max is thinking of too. The only difference is that such a lens must be hardened, while today a Lens can be used quite flexibly. Whether it is called a Lens or something is put next to it is a functional discussion. Whoever makes it is an Owner: there may be an Owner who owns no Resources, but only "app lenses" ("I give the child a name for now"), who prepares data knowing that another application reads it.

*Changed in the review of the plan: from a query one makes a Lens or something for an application ([REQ-DH-APP-R1](#req-dh-app-r1)).*

**Recorded as:** [DEC-AP-02](../requirements/functional/18-applications.md#dec-ap-02).

<a id="req-dh-app-09"></a>
### REQ-DH-APP-09 · Two Owners in the chain

*Question: the "app lens" has an Owner, the leads under it belong to another Owner Unit. Who says yes, and what if the Owner of the Resources later says no?*

All the Owners: Data Hub falls back on the Owners of the Resources; they say yes. If Max wants to put an application outside and needs Resources from Immoscoop-only and from properties, those two people give him permission to set up a permanent connection to his application. The lens that brings it all together is his, and he prepares it to send it on to his app.

Every Owner should be able to say at any time: "I do not want this any more". There is a kind of escalation in it: "I phase it out", or "I cut it off at once".

Data Hub must always take into account that it may deliver late, or never. With monitoring, the Owner wants to be able to say: "if something happens to my data, switch it off", so that it is no longer accessible to external applications either. The contract will always say: it may come, and it may not come. *Added by Max during the answer:* by "it may come" he means: the app asks a question, and the answer may be a 500.

As an example he gave the many pages made for SEO, many of which carry structured data. A meeting on Thursday is about making that structured data, across different kinds of pages (SEO pages to attract private sellers, SEO pages for searchers, and so on), consistent.

**Recorded as:** [DEC-AP-04](../requirements/functional/18-applications.md#dec-ap-04), [DEC-AP-05](../requirements/functional/18-applications.md#dec-ap-05), [DEC-AP-10](../requirements/functional/18-applications.md#dec-ap-10), [DEC-AP-13](../requirements/functional/18-applications.md#dec-ap-13).

<a id="req-dh-app-10"></a>
### REQ-DH-APP-10 · The SEO case

*Question: what is in that structured data, and where does it come from? Figures that may be a day old fit Data Hub; the price of one listing on its own page has the transactional system as its source.*

Today it comes from the project dataplatformdata, where someone of the Data Team prepares the mart. For street names the average price is given; for municipalities the median price in one place and the average in another; with one, percentiles 25 and 75 are added; with the average, no standard deviation was given. The meeting aims at great consistency across pages. To Max a typical case for setting up a kind of collection, app or connector ("I give the child a name"), in which one says: this is the data you can ask for, and these applications may ask for it.

To be clear: it is always about transactional data, where the transactional system is effectively the master; so it will always be about additions of data that Data Hub makes. That data is owned by Data, and by extension by the Owner in Data Hub. The receiving application must be smart enough to know that the data travelled over the analytical layer, and is therefore not, or only late, representative of whatever is in the transactional system. The owner of the application must simply understand that.

**Recorded as:** [DEC-AP-11](../requirements/functional/18-applications.md#dec-ap-11), [DEC-AP-02](../requirements/functional/18-applications.md#dec-ap-02) (the container), [DEC-AP-17](../requirements/functional/18-applications.md#dec-ap-17) (the first case).

<a id="req-dh-app-11"></a>
### REQ-DH-APP-11 · A minimum volume

*Question: these pages are public. What does the Owner approve when there is no binding rule per user, and what of the average price of a street where one house was sold?*

That is indeed part of the evaluation: when aggregates are made, how much volume is needed before the aggregate is allowed. The rule holds just as well for authenticated environments.

**Recorded as:** [DEC-AP-12](../requirements/functional/18-applications.md#dec-ap-12).

<a id="req-dh-app-12"></a>
### REQ-DH-APP-12 · What "hardened" means

*Question: what may change in a hardened "app lens" without the apps knowing, what must be announced, and what needs a new version?*

Max thinks more of the agents' portal, where figures on, for example, performance are delivered to the agent. What matters there is that the data is always available, but may arrive later. He sees such applications as: the data is prepared daily, so the periodicity of the delivery matters, and Data Hub becomes part of it. It is executed from the data that was prepared, a cache. That is what he calls hardened: the application reads in such a way that there is never a dependency on BigQuery, and only when a run on the data succeeded is the data made available to the application.

**Recorded as:** [DEC-AP-08](../requirements/functional/18-applications.md#dec-ap-08), [DEC-AP-10](../requirements/functional/18-applications.md#dec-ap-10). What may change is answered in the review ([REQ-DH-APP-R3](#req-dh-app-r3)).

<a id="req-dh-app-13"></a>
### REQ-DH-APP-13 · Internal apps, a form and the Owner's rules

*Question: an internal app that runs permanently, does it keep asking BigQuery live, or must it be hardened too?*

Data Hub must be able to offer both: either the data is prepared, or it is passed on live. That depends purely on the kind of app that asks. When such an application is set up, Max wants a kind of form in which all these questions are asked, and that form can also be filled from a JSON schema that comes from Ben.

Besides, he wants to be able to enforce that the Owner whose data is used can set rules when data is created or added, such as "if field X is so much" or "under so much I do not want it", evaluated when a run has run.

**Recorded as:** [DEC-AP-03](../requirements/functional/18-applications.md#dec-ap-03), [DEC-AP-08](../requirements/functional/18-applications.md#dec-ap-08), [DEC-AP-13](../requirements/functional/18-applications.md#dec-ap-13).

<a id="req-dh-app-14"></a>
### REQ-DH-APP-14 · On whose rights

*Question: does a live question run on the rights of the colleague who opens the app, or on those of the app itself?*

Max wants clarity above all. Data is linked to an application by a query. It is whoever wrote the query and laid the link to the application whose rights are used to read. A system may still be needed that keeps it active when it is used, so that it does not all fall away; that will be part of it too. But it is their rights, also because it is that app that comes asking. Every underlying Owner has a good enough view of where their Resources are used, and always the possibility to intervene. *Interrupting:* important, Data Hub has no row-level privileges.

**Recorded as:** [DEC-AP-07](../requirements/functional/18-applications.md#dec-ap-07); keeping the link alive in the review ([REQ-DH-APP-R4](#req-dh-app-r4)).

<a id="req-dh-app-15"></a>
### REQ-DH-APP-15 · The first case

*Question: which case first, and what must be in it at least? SEO looks simplest: public, aggregated, prepared.*

Even there the notion of public will not apply: it will not be put fully public, it will always go through the backend of the transactional system. Max does not know whether he would take the notion "public" in at once.

**Recorded as:** [DEC-AP-16](../requirements/functional/18-applications.md#dec-ap-16), [DEC-AP-17](../requirements/functional/18-applications.md#dec-ap-17).

## 2. The review of the plan

*Max commented on the plan line by line. His comments, translated where they were in Dutch.*

<a id="req-dh-app-r1"></a>
### REQ-DH-APP-R1 · A query becomes a Lens, or something for an application

What is best: you create a query, and then you can make not only a Lens out of that query, but an application resource or something like that. On the name of the container: be creative, Claude may choose a name.

**Recorded as:** [DEC-AP-02](../requirements/functional/18-applications.md#dec-ap-02), with the names of [OP-AP-01](../requirements/functional/18-applications.md#op-ap-01).

<a id="req-dh-app-r2"></a>
### REQ-DH-APP-R2 · What is the minimum volume?

Max asked what the minimum volume is. Claude explained: the fewest observations behind one aggregated value before it is delivered, and proposed how Data Hub enforces it.

**Recorded as:** [DEC-AP-12](../requirements/functional/18-applications.md#dec-ap-12), the proposal in [OP-AP-02](../requirements/functional/18-applications.md#op-ap-02).

<a id="req-dh-app-r3"></a>
### REQ-DH-APP-R3 · Never change, only add a version

The owner of the application, and of the app data or whatever it is named, can change it. What Max would do: it can never be changed. One can only add a new version, keeping the old version alive or something like that. Claude was asked to make a proposal.

**Recorded as:** [DEC-AP-14](../requirements/functional/18-applications.md#dec-ap-14), the proposal in [OP-AP-03](../requirements/functional/18-applications.md#op-ap-03).

<a id="req-dh-app-r4"></a>
### REQ-DH-APP-R4 · The Owner Unit keeps the link

Keeping the link alive with an Owner Unit is a good one. An Owner Unit can therefore not be deleted as long as it holds an app connection, and that is a good thing. It should be applied to Resources and so on as well.

**Recorded as:** [DEC-AP-07](../requirements/functional/18-applications.md#dec-ap-07), [DEC-AP-15](../requirements/functional/18-applications.md#dec-ap-15).

<a id="req-dh-app-r5"></a>
### REQ-DH-APP-R5 · Two identities, Firestore, no downtime

How an application is recognised: a way must be found for applications to authenticate themselves. There are two things: not only the Cognito user who comes knocking, but also the application that carries the Cognito user. A distinct answer per cause of an error: agreed. The serving store: for now Firestore, which Max thinks is best, all managed by Data Hub. Important is how releases are done: it cannot go down.

**Recorded as:** [DEC-AP-06](../requirements/functional/18-applications.md#dec-ap-06), [DEC-AP-09](../requirements/functional/18-applications.md#dec-ap-09), [DEC-AP-10](../requirements/functional/18-applications.md#dec-ap-10); the mechanism in [OP-AP-04](../requirements/functional/18-applications.md#op-ap-04), the releases in [OP-AP-05](../requirements/functional/18-applications.md#op-ap-05).

<a id="req-dh-app-r6"></a>
### REQ-DH-APP-R6 · SEO first, designs first

SEO is a good first case. As soon as the plan is approved, the first step is the designs; based on them the requirements are created and discussed, and then building starts. Later the same evening: design every screen needed, and write out all requirements as well; afterwards Max goes over each of them.

**Recorded as:** [DEC-AP-17](../requirements/functional/18-applications.md#dec-ap-17), [DEC-AP-18](../requirements/functional/18-applications.md#dec-ap-18).
