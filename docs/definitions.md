# Definitions

| | |
| --- | --- |
| Status | First version, 2026-10-17 |
| Source of truth | This file, for the meaning of every Defined Term |

This document defines the terms that have a specific meaning in Data Hub. As in a contract, a **Defined Term is written with capitals** wherever it is used in that meaning, so that a reader always knows when a word refers to a definition: a Data Admin registers a Resource in a Collection, and the Owner publishes it.

## How Defined Terms are written

- **Capitals, singular and plural.** Resource, Resources; Data Admin, Data Admins; Owner Unit, Owner Units.
- **Only in the defined meaning.** The same word in its ordinary meaning stays lowercase: a software release, a signing key, the logs of a service, a business question.
- **Nouns, not verbs.** A Data Admin registers, the Owner publishes and confirms. The nouns are Registration, Publication and Confirmation.
- **Not defined, on purpose:** lineage, manifest, catalog (the dbt file), check, monitor, business, data. The names of the services (identity, catalogue, registry, query, web, mcp) are names, not Defined Terms, and stay lowercase. The words of the library metaphor (librarian, curator, catalogue card, accession register, reading room, …) explain Data Hub, they do not define it, and stay lowercase.
- **The runtime is written Node.js,** so that it is never confused with a Node.
- **A new term is added here first,** then used with capitals everywhere.

## Defined Terms

| Defined Term | Meaning | Defined in |
| --- | --- | --- |
| <a id="access-token"></a>**Access Token** | The short-lived signed token that identity issues to a User after login, carrying the identity, Groups and roles of the User. Every service validates it itself. | [TR-PF-02](requirements/technical/00-platform.md#tr-pf-02), [TR-PF-03](requirements/technical/00-platform.md#tr-pf-03) |
| <a id="anomaly"></a>**Anomaly** | A recorded deviation in the data of a Resource, with a period, a description of what happened, the impact on the figures and who recorded it. Part of the Known Behaviour; a Signal can become one. | [DEC-DH-18](overview/data-hub.md#dec-dh-18), [FR-SR-30](requirements/functional/04-stacks-and-resources.md#fr-sr-30) |
| <a id="artifact-set"></a>**Artifact Set** | The Artifacts of one successful run of a Source Job, with run ID, git SHA and timestamp. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="artifacts"></a>**Artifacts** | `manifest.json` and `catalog.json`, the files dbt produces about a dbt project. Not to be confused with GCP's Artifact Registry, which holds the Docker images. | [The dbt Artifacts](overview/data-hub.md#the-dbt-artifacts) |
| <a id="beta-concept"></a>**Beta Concept** | A concept that business defines itself, such as buy session. It lives only in its own context in Data Hub and is at Level 0, Beta; whatever is built on it is Beta too. | [DEC-DH-61](overview/open-themes.md#dec-dh-61) |
| <a id="business-description"></a>**Business Description** | The description of a Resource, or of one of its fields, that its Owner or the Data Team writes in Data Hub. It stands next to the description from dbt and never replaces it; where there is none, the description from dbt stands alone. | [DEC-RC-01](requirements/functional/05-resource-card.md#dec-rc-01) |
| <a id="catalogue"></a>**Catalogue** | Everything Data Hub offers to find and browse, layered from Resources through Lenses to Reports. Not to be confused with the catalogue service or with dbt's catalog. | [1. Catalogue management](overview/open-themes.md#1-catalogue-management) |
| <a id="change"></a>**Change** | A difference for one Node between a new Artifact Set and the previous Current Version: a description, logic, type or structural change, or a Node added or removed. | [Artifact registry](requirements/functional/01-artifact-registry.md#kinds-of-change) |
| <a id="chart-server"></a>**Chart Server** | The service semgraph of Data Hub, which draws charts by what they mean, following the chart language. Until its users have moved over, its former version on AWS keeps running too. | [DEC-DH-53](overview/data-hub.md#dec-dh-53), [DEC-DH-63](overview/data-hub.md#dec-dh-63) |
| <a id="collection"></a>**Collection** | A functional domain of Immoscoop, such as web visits, leads or agencies, in which Resources sit together under one Owner Unit. Anyone can create one, and it is private or public. Not a dataset in BigQuery. | [Collections](requirements/functional/03-collections.md) |
| <a id="compass"></a>**Compass** | The Learning Cards on how data works at Immoscoop: the landscape, the tooling, governance and processes. Orientation for everyone, not a step from easy to advanced. | [Learning](requirements/functional/16-learning.md#terms) |
| <a id="confirmation"></a>**Confirmation** | The declaration by the Owner that a Resource is correct: what it is and what it stands for, as its descriptions say. It makes no claim about the data inside it, which the EDA explores. Stored with the Fingerprint of that moment. The first Publication is the first Confirmation. A Confirmation does not expire. | [DEC-DH-39](overview/data-hub.md#dec-dh-39), [DEC-MR-07](requirements/functional/06-maturity-and-release.md#dec-mr-07), [FR-MR-08](requirements/functional/06-maturity-and-release.md#fr-mr-08) |
| <a id="consumer"></a>**Consumer** | A User of the Lenses and Reports built on a Resource. Data Hub knows them through the lineage of those Lenses and Reports. | [FR-LN-03](requirements/functional/07-log-and-notifications.md#fr-ln-03) |
| <a id="current-version"></a>**Current Version** | Per dbt project, the most recent fully processed Artifact Set; the rest of Data Hub works on it. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="data-admin"></a>**Data Admin** | A member of the Role Group of the Data Team, who registers and manages Resources. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="data-team"></a>**Data Team** | The team that takes data in, describes it and puts it in the Stacks. In Data Hub: the members of its Role Group. | [DEC-CO-03](requirements/functional/03-collections.md#dec-co-03) |
| <a id="display-name"></a>**Display Name** | The readable, unique name of a Resource, as business sees it, for example "Agency purity". | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="domain-model"></a>**Domain Model** | The description of the entities of the business, maintained with Domain Hub and delivered to Data Hub as dbt Artifacts and as the overview the server of Colleciónes deploys ([FR-AR-15](requirements/functional/01-artifact-registry.md#fr-ar-15)). Data Hub describes the data; the Domain Model describes the business. | [Relation to existing work](overview/data-hub.md#relation-to-existing-work) |
| <a id="eda"></a>**EDA** | Exploratory data analysis: the exploration of a Resource by its Owner. A linked EDA document makes a Resource Explored. | [FR-MR-03](requirements/functional/06-maturity-and-release.md#fr-mr-03), [EDA](requirements/functional/15-eda.md) |
| <a id="edge"></a>**Edge** | A link in the lineage: one Node depends on another. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="entity"></a>**Entity** | An entity of the Domain Model, such as an agency or an office. A Resource is linked to the Entities found in its lineage. | [FR-SR-23](requirements/functional/04-stacks-and-resources.md#fr-sr-23) |
| <a id="fingerprint"></a>**Fingerprint** | A set of hashes of the structure, the types and the descriptions of a Resource at a given moment, plus the checksum of its code. | [FR-SR-08](requirements/functional/04-stacks-and-resources.md#fr-sr-08) |
| <a id="group"></a>**Group** | A Google group of the own Workspace domain that Data Hub knows. Owner Units and Role Groups are Groups. | [User management](requirements/functional/02-user-management.md#terms) |
| <a id="key"></a>**Key** | The full name of the view of a Resource in BigQuery, `project.dataset.table`. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="known-behaviour"></a>**Known Behaviour** | The block on the Resource Card with the intended use, the pitfalls and the Anomalies of a Resource. | [DEC-DH-18](overview/data-hub.md#dec-dh-18) |
| <a id="known-gap"></a>**Known Gap** | A structural gap in the data of a Resource, not an error in the strict sense: for example a field that was never stored for part of the rows. The final term is still open. | [FR-RC-04](requirements/functional/05-resource-card.md#fr-rc-04), [OP-RC-03](requirements/functional/05-resource-card.md#op-rc-03) |
| <a id="learning-card"></a>**Learning Card** | One topic of the master learning plan, with a page in Data Hub in five steps, from Why now to You can now. A User marks it understood with "I understand it". | [DEC-LR-01](requirements/functional/16-learning.md#dec-lr-01), [DEC-LR-10](requirements/functional/16-learning.md#dec-lr-10), [FR-LR-01](requirements/functional/16-learning.md#fr-lr-01) |
| <a id="learning-centre"></a>**Learning Centre** | The section of Data Hub with every Learning Card, and a silent count of the cards a User has seen. Its philosophy and guiding principles are on a page of their own on Confluence. | [DEC-LR-04](requirements/functional/16-learning.md#dec-lr-04) |
| <a id="learning-level"></a>**Learning Level** | One of the four levels of the master learning plan, from easy to advanced: 1 User, 2 Data-aware user, 3 Data analyst, 4 Data owner and expert. Not to be confused with the Level of a Resource. | [DEC-LR-02](requirements/functional/16-learning.md#dec-lr-02) |
| <a id="lens"></a>**Lens** | A rendering of a Resource, of a fixed type, with Parameters, made by business. Deliberately not called a view. Its Level is the lowest Level of the Resources beneath it. | [Lenses](overview/data-hub.md#lenses) |
| <a id="level"></a>**Level** | The maturity level of a Resource, Lens or Report, from Beta (0) to Monitored (5); see [Levels](#levels). | [Maturity and release](requirements/functional/06-maturity-and-release.md) |
| <a id="library-card"></a>**Library Card** | The personal key of a User, for example for Excel through Power Query. It can be revoked and renewed. | [DEC-DH-47](overview/data-hub.md#dec-dh-47) |
| <a id="log"></a>**Log** | Everything that happened to a Resource or a Collection, as Log Entries, including Changes deeper in the lineage. Not the technical logs of a service. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms), [FR-SR-11](requirements/functional/04-stacks-and-resources.md#fr-sr-11) |
| <a id="log-catalogue"></a>**Log Catalogue** | The fixed list of all Log IDs. | [Log catalogue](requirements/functional/log-catalogue.md) |
| <a id="log-entry"></a>**Log Entry** | One line in a Log: a Log ID, the Resource, the parameters as JSON, the actor and the time. Never free text. | [FR-SR-11](requirements/functional/04-stacks-and-resources.md#fr-sr-11) |
| <a id="log-id"></a>**Log ID** | The fixed code of a kind of Log Entry, with a template and a list of parameters, for example `RES-001`. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="message"></a>**Message** | What a User writes on an object in Data Hub, such as a Resource, a Lens or a query, to enrich its data and inform colleagues: a Question, Remark, Signal or Request on it, or a reply. It is never private and not a chat with a person, and it always carries its Subject. | [DEC-CV-01](requirements/functional/14-conversations.md#dec-cv-01) |
| <a id="message-centre"></a>**Message Centre** | Where a User finds the Messages that concern them and what Data Hub tells them, for example the Data Admins on every Registration. | [FR-SR-10](requirements/functional/04-stacks-and-resources.md#fr-sr-10) |
| <a id="naming-convention"></a>**Naming Convention** | The rule for the names of Role Groups: `datahub-<role>@<domain>`. An Owner Unit needs no convention. | [User management](requirements/functional/02-user-management.md#naming-convention) |
| <a id="node"></a>**Node** | A model, seed, snapshot, source or exposure in the manifest of a dbt project, with its columns. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="owner"></a>**Owner** | The Owner Unit of the Collection a Resource is in. It vouches for the Collection and confirms its Resources. | [DEC-CO-04](requirements/functional/03-collections.md#dec-co-04) |
| <a id="owner-unit"></a>**Owner Unit** | The Group that takes care of a Collection: any Google group of the own Workspace domain, chosen by whoever creates the Collection from the groups they are in. | [DEC-CO-09](requirements/functional/03-collections.md#dec-co-09) |
| <a id="parameter"></a>**Parameter** | A functionally named and typed input of a Lens, for example `dateFrom`, that can be combined across Lenses. | [DEC-DH-11](overview/data-hub.md#dec-dh-11) |
| <a id="pre-flight"></a>**Pre-flight** | What Data Hub shows before a query runs: the volume it will process, against the thresholds for approval and for a block. | [FR-SR-36](requirements/functional/04-stacks-and-resources.md#fr-sr-36), [FR-SR-37](requirements/functional/04-stacks-and-resources.md#fr-sr-37) |
| <a id="promotion-loop"></a>**Promotion Loop** | Hardening a Beta Concept into a Resource, with the beta query as its specification. | [The promotion loop](overview/open-themes.md#3-the-promotion-loop) |
| <a id="publication"></a>**Publication** | The switch with which the Owner makes a Resource visible to everyone who sees its Collection: the whole company when the Collection is public. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="query-id"></a>**Query ID**, <a id="query-log"></a>**Query Log** | The Query Log keeps every query Data Hub executes, with a unique Query ID, the SQL, who ran it, when, the bytes processed and the Resources beneath it. Every output carries the Query ID of its query. Not the Log of a Resource. | [FR-LN-05](requirements/functional/07-log-and-notifications.md#fr-ln-05), [FR-LN-06](requirements/functional/07-log-and-notifications.md#fr-ln-06) |
| <a id="reaction"></a>**Reaction** | A Question, Remark or Signal that someone who may see a Resource leaves on it. | [DEC-SR-20](requirements/functional/04-stacks-and-resources.md#dec-sr-20) |
| <a id="reading-card"></a>**Reading Card** | A Learning Card that explains how to read one standard chart of the chart language, and the trap it avoids. Every standard chart links to its Reading Card. | [FR-LR-10](requirements/functional/16-learning.md#fr-lr-10) |
| <a id="question"></a>**Question**, <a id="remark"></a>**Remark** | The Reactions that ask something about a Resource, and that leave a remark or tip for others. | [Kinds of Reaction](requirements/functional/04-stacks-and-resources.md#kinds-of-reaction) |
| <a id="refresh-token"></a>**Refresh Token** | The long-lived token, usable once, with which a client that signs in on behalf of a User (the server of the web app, or Claude) gets a new Access Token without a new login. Only identity accepts it; the other services never see it. | [DEC-PF-18](requirements/technical/00-platform.md#dec-pf-18), [TR-PF-25](requirements/technical/00-platform.md#tr-pf-25) |
| <a id="registration"></a>**Registration** | Making a table a Resource: an exposure with the tag `datahub` in its dbt project that depends on it. The Registrations together are the index of Data Hub. | [DEC-SR-22](requirements/functional/04-stacks-and-resources.md#dec-sr-22) |
| <a id="release"></a>**Release** | Making data available, in two steps that Data Hub enforces: from the Data Team to the Owner (Registration in a Collection), then from the Owner to everyone who sees the Collection (Publication). | [Release in two steps](overview/data-hub.md#release-in-two-steps) |
| <a id="report"></a>**Report** | One or more Lenses around a question, with text and explanation, made by business. It shares its Parameters with its Lenses; its Level is the lowest Level of the Lenses in it. | [Reports](overview/data-hub.md#reports) |
| <a id="request"></a>**Request** | A Message that asks the Data Team for a decision on its object, such as accepting a very large Lens. It is waiting, accepted or refused, and its reply is the decision. | [DEC-CV-06](requirements/functional/14-conversations.md#dec-cv-06) |
| <a id="resource"></a>**Resource** | A registered table of a dbt project: one book on the shelves. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="resource-card"></a>**Resource Card** | Everything Data Hub knows about one Resource, partly derived and partly kept by Data Hub itself. | [The Resource Card](overview/data-hub.md#the-resource-card) |
| <a id="role-group"></a>**Role Group** | A Group that gives its members a role in Data Hub, such as `datahub-datateam@` for the Data Team. | [User management](requirements/functional/02-user-management.md#naming-convention) |
| <a id="signal"></a>**Signal** | A Reaction reporting that something seems odd about the data of a Resource. It goes to the Owner and the Data Team, and can become an Anomaly. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="source-job"></a>**Source Job** | The one prod job in dbt Cloud, per dbt project, whose Artifacts Data Hub uses: a full build that also runs `dbt docs generate`. uat of Data Hub reads the UAT counterpart of each Source Job ([DEC-AR-01](requirements/functional/01-artifact-registry.md#dec-ar-01)). | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="stability"></a>**Stability** | Whether the data of a Resource is still settling or can change by nature, and from when it is final, for example "stable = D-3". The final term is still open. | [FR-RC-06](requirements/functional/05-resource-card.md#fr-rc-06), [OP-RC-04](requirements/functional/05-resource-card.md#op-rc-04) |
| <a id="stack"></a>**Stack**, **the Stacks** | A dataset in BigQuery with mart views that the Data Team releases, as authorized views onto the datasets behind them. Today there is one: `dbt_prod_stacks`. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="subject"></a>**Subject** | What a Message is about: the kind of object, such as a Resource, a Lens or a query, and its ID. Data Hub sets it from where the Message is written, builds the link to it, and finds all Messages about an object by it. The same for every kind of object. | [DEC-CV-01](requirements/functional/14-conversations.md#dec-cv-01) |
| <a id="synchronisation"></a>**Synchronisation** | Periodically pulling in the members of all Groups, so that Data Hub knows who is in which Group, also for Users who are not logged in. | [User management](requirements/functional/02-user-management.md#terms) |
| <a id="user"></a>**User** | Someone with an Immoscoop Google Workspace account who has logged in to Data Hub at least once. | [User management](requirements/functional/02-user-management.md#terms) |

Data Hub, Domain Hub, Colleciónes, Workspace and the names of products such as BigQuery are proper names and are capitalised as such.

<a id="maturity-levels"></a>

## Levels

The ladder itself is defined on [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch). How a Resource rises and drops is specified in [Maturity and release](requirements/functional/06-maturity-and-release.md#rising-and-dropping). The names of the Levels are Defined Terms.

| Level | Name | Reached when |
| --- | --- | --- |
| 0 | <a id="beta"></a>**Beta** | A Beta Concept, living only in its own context |
| 1 | <a id="available"></a>**Available** | Registered; the description is incomplete |
| 2 | <a id="described"></a>**Described** | The view and every column have a description |
| 3 | <a id="confirmed"></a>**Confirmed** | The Owner has confirmed the Resource |
| 4 | <a id="explored"></a>**Explored** | An EDA document is linked |
| 5 | <a id="monitored"></a>**Monitored** | At least one check is active |

## The library metaphor

Data Hub is explained as a library ([DEC-DH-01](overview/data-hub.md#dec-dh-01)). The mapping between the library and the Defined Terms is in [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library). The library words themselves are not Defined Terms.

## Translation reference

The Confluence pages are in Dutch, and so were the session in which the [design](design/README.md) of the web app was made and the [workshops](workshops/2026-10-22-data-agents-and-governance.md). This table maps their vocabulary to the English used here, so that terms can be found in both places. Defined Terms appear with their capitals. It is the only place in this repository where Dutch is used on purpose.

| Confluence (Dutch) | Repository (English) |
| --- | --- |
| aanbevolen, verdieping, verplicht | recommended, in depth, required |
| aanwinstenregister | accession register |
| access-as | access axis |
| begrip, beta-begrip | concept, Beta Concept |
| bekend gedrag | Known Behaviour |
| bekende hiaten | Known Gaps |
| bekrachtigen, bekrachtiging | confirm, Confirmation |
| Beschikbaar, Beschreven, Bekrachtigd, Verkend, Bewaakt | Available, Described, Confirmed, Explored, Monitored |
| bericht | Message |
| berichtencentrum | Message Centre |
| beslisregel | decision rule |
| beslissing | decision |
| bibliothecaris | librarian |
| bronjob | Source Job |
| businessbeschrijving | Business Description |
| collectie | Collection |
| collectiebeheer en wieden | collection management and weeding |
| confidentialiteitsniveau | level of confidentiality |
| conservator | curator |
| consumenten | Consumers |
| controlecijfers | control figures |
| datateam | Data Team |
| definitie in businesstaal | definition in business language |
| denkniveau: herkennen, toepassen, beoordelen | thinking level: recognise, apply, judge |
| doe-opdracht, doe-vraag | try-it task, try-it question |
| domeinmodel | Domain Model |
| fiche, catalogusfiche | Resource Card, catalogue card |
| functionele regel | functional requirement |
| Gebruikersbeheer | User management |
| gesprek | conversation |
| gewicht van een lens | weight of a Lens |
| grafiekserver | Chart Server |
| grafiektaal | chart language |
| holle hoek | concave corner (flare) |
| huidige versie | Current Version |
| Ik heb het begrepen | "I understand it" |
| inschrijving | Registration |
| interface-chrome | interface |
| kader | frame |
| kan-nu, opbrengst, keuzes (van "Je kan nu") | can now, gain, choices (of You can now) |
| kanalen | channels |
| kanttekeningen in de marge | margin notes |
| kompas | Compass |
| leerdoel, kern, misvatting | learning goal, core, misconception |
| leesbare naam | Display Name |
| leeskaart | Reading Card |
| leesvlak | reading surface |
| leeszaal | reading room |
| lens, lenzen | Lens, Lenses |
| lezerskaart | Library Card |
| master-leerplan | master learning plan |
| maturiteitsicoon | maturity icon |
| melding | notification |
| melding (op een scherm) | alert |
| naam (niet vertalen) | name (do not translate) |
| niveau (van het master-leerplan) | Learning Level |
| onderwerp (van een bericht) | Subject |
| onderwerp (van het master-leerplan) | Learning Card |
| ontsluiting, ontsluiten | Release, release |
| ontwerprichtlijnen | design principles |
| open punten | open points |
| open uitleen | general circulation |
| open vragen | open questions |
| opheffen | dissolve |
| pre-flight | Pre-flight |
| promotielus | Promotion Loop |
| query-ID, SQL-log | Query ID, Query Log |
| randgevallen | edge cases |
| rechten | permissions |
| rekken | shelves |
| signaal, opmerking, vraag | Signal, Remark, Question |
| signaalkleur | signal colour |
| sleutel | Key |
| snel pad, volledig pad | quick path, full path |
| stabiliteit | Stability |
| startscherm | start screen |
| steunt op | builds on |
| stille telling van bekeken kaarten | silent count of the cards seen |
| stroom | flow |
| taalprincipe | language principle |
| taalvoorkeur | language preference |
| tegel | tile |
| toegangsclassificatie | access classification |
| uit te diepen | to be worked out |
| uitschuifpaneel | slide-out panel |
| vergrootglas | magnifying glass |
| verhaal | story |
| verharden | harden |
| vertaalbestand | translation file |
| vingerafdruk | Fingerprint |
| voorspel, dan onthul | predict, then reveal |
| voortschrijdend | still settling |
| Waarom nu, Kernidee, Zie het, Check je begrip, Je kan nu | Why now, Core idea, See it, Check your understanding, You can now |
| wijziging | Change |
| wijzigings- en anomalielog | log of changes and Anomalies |
| Woordenlijst | Glossary |
| zin (tegenover naam) | sentence (as opposed to a name) |
