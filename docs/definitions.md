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
| <a id="catalogue"></a>**Catalogue** | Everything Data Hub offers to find and browse, layered from Resources through Lenses to Reports. Not to be confused with the catalogue service or with dbt's catalog. | [1. Catalogue management](overview/open-themes.md#1-catalogue-management) |
| <a id="change"></a>**Change** | A difference for one Node between a new Artifact Set and the previous Current Version: a description, logic, type or structural change, or a Node added or removed. | [Artifact registry](requirements/functional/01-artifact-registry.md#kinds-of-change) |
| <a id="chart-server"></a>**Chart Server** | The server that renders charts, running on AWS, with which Data Hub works together. | [DEC-DH-53](overview/data-hub.md#dec-dh-53) |
| <a id="collection"></a>**Collection** | A functional domain of Immoscoop, such as web visits, leads or agencies, in which Resources sit together under one Owner Unit. Not a dataset in BigQuery. | [Collections](requirements/functional/03-collections.md) |
| <a id="confirmation"></a>**Confirmation** | The declaration by the Owner that the data of a Resource is correct, stored with the Fingerprint of that moment. The first Publication is the first Confirmation. A Confirmation does not expire. | [DEC-DH-39](overview/data-hub.md#dec-dh-39), [FR-MR-08](requirements/functional/06-maturity-and-release.md#fr-mr-08) |
| <a id="current-version"></a>**Current Version** | Per dbt project, the most recent fully processed Artifact Set; the rest of Data Hub works on it. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="data-admin"></a>**Data Admin** | A member of the Role Group of the Data Team, who registers and manages Resources. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="data-team"></a>**Data Team** | The team that takes data in, describes it and puts it in the Stacks. In Data Hub: the members of its Role Group. | [DEC-CO-03](requirements/functional/03-collections.md#dec-co-03) |
| <a id="display-name"></a>**Display Name** | The readable, unique name of a Resource, as business sees it, for example "Agency purity". | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="domain-model"></a>**Domain Model** | The description of the entities of the business, maintained with Domain Hub and delivered to Data Hub only as dbt Artifacts. Data Hub describes the data; the Domain Model describes the business. | [Relation to existing work](overview/data-hub.md#relation-to-existing-work) |
| <a id="eda"></a>**EDA** | Exploratory data analysis: the exploration of a Resource by its Owner. A linked EDA document makes a Resource Explored. | [FR-MR-03](requirements/functional/06-maturity-and-release.md#fr-mr-03), [EDA](requirements/functional/15-eda.md) |
| <a id="edge"></a>**Edge** | A link in the lineage: one Node depends on another. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="entity"></a>**Entity** | An entity of the Domain Model, such as an agency or an office. A Resource is linked to the Entities found in its lineage. | [FR-SR-23](requirements/functional/04-stacks-and-resources.md#fr-sr-23) |
| <a id="fingerprint"></a>**Fingerprint** | A set of hashes of the structure, the types and the descriptions of a Resource at a given moment, plus the checksum of its code. | [FR-SR-08](requirements/functional/04-stacks-and-resources.md#fr-sr-08) |
| <a id="group"></a>**Group** | A Google group in Workspace that follows the Naming Convention. Owner Units and Role Groups are Groups. | [User management](requirements/functional/02-user-management.md#terms) |
| <a id="key"></a>**Key** | The full name of the view of a Resource in BigQuery, `project.dataset.table`. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="known-behaviour"></a>**Known Behaviour** | The block on the Resource Card with the intended use, the pitfalls and the Anomalies of a Resource. | [DEC-DH-18](overview/data-hub.md#dec-dh-18) |
| <a id="lens"></a>**Lens** | A rendering of a Resource, of a fixed type, with Parameters, made by business. Deliberately not called a view. Its Level is the lowest Level of the Resources beneath it. | [Lenses](overview/data-hub.md#lenses) |
| <a id="level"></a>**Level** | The maturity level of a Resource, Lens or Report, from Beta (0) to Monitored (5); see [Levels](#levels). | [Maturity and release](requirements/functional/06-maturity-and-release.md) |
| <a id="library-card"></a>**Library Card** | The personal key of a User, for example for Excel through Power Query. It can be revoked and renewed. | [DEC-DH-47](overview/data-hub.md#dec-dh-47) |
| <a id="log"></a>**Log** | Everything that happened to a Resource or a Collection, as Log Entries, including Changes deeper in the lineage. Not the technical logs of a service. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms), [FR-SR-11](requirements/functional/04-stacks-and-resources.md#fr-sr-11) |
| <a id="log-catalogue"></a>**Log Catalogue** | The fixed list of all Log IDs. | [Log catalogue](requirements/functional/log-catalogue.md) |
| <a id="log-entry"></a>**Log Entry** | One line in a Log: a Log ID, the Resource, the parameters as JSON, the actor and the time. Never free text. | [FR-SR-11](requirements/functional/04-stacks-and-resources.md#fr-sr-11) |
| <a id="log-id"></a>**Log ID** | The fixed code of a kind of Log Entry, with a template and a list of parameters, for example `RES-001`. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="message-centre"></a>**Message Centre** | Where Data Hub delivers its messages, for example to the Data Admins on every Registration. | [FR-SR-10](requirements/functional/04-stacks-and-resources.md#fr-sr-10) |
| <a id="naming-convention"></a>**Naming Convention** | The rule for the names of Groups: `datahub-owner-<name>@<domain>` for an Owner Unit, `datahub-<role>@<domain>` for a Role Group. | [User management](requirements/functional/02-user-management.md#naming-convention) |
| <a id="node"></a>**Node** | A model, seed, snapshot, source or exposure in the manifest of a dbt project, with its columns. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="owner"></a>**Owner** | The Owner Unit of the Collection a Resource is in. It vouches for the Collection and confirms its Resources. | [DEC-CO-04](requirements/functional/03-collections.md#dec-co-04) |
| <a id="owner-unit"></a>**Owner Unit** | A Group that takes care of a Collection. Deliberately not a team from the organisational structure, but a Group that exists only for this purpose. | [User management](requirements/functional/02-user-management.md#terms) |
| <a id="parameter"></a>**Parameter** | A functionally named and typed input of a Lens, for example `dateFrom`, that can be combined across Lenses. | [DEC-DH-11](overview/data-hub.md#dec-dh-11) |
| <a id="promotion-loop"></a>**Promotion Loop** | Hardening a Beta Concept into a Resource, with the beta query as its specification. | [The promotion loop](overview/open-themes.md#3-the-promotion-loop) |
| <a id="publication"></a>**Publication** | The switch with which the Owner makes a Resource visible to the whole company. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="reaction"></a>**Reaction** | A Question, Remark or Signal that someone who may see a Resource leaves on it. | [DEC-SR-20](requirements/functional/04-stacks-and-resources.md#dec-sr-20) |
| <a id="question"></a>**Question**, <a id="remark"></a>**Remark** | The Reactions that ask something about a Resource, and that leave a remark or tip for others. | [Kinds of Reaction](requirements/functional/04-stacks-and-resources.md#kinds-of-reaction) |
| <a id="refresh-token"></a>**Refresh Token** | The long-lived token, usable once, with which a client that signs in on behalf of a User (the server of the web app, or Claude) gets a new Access Token without a new login. Only identity accepts it; the other services never see it. | [DEC-PF-18](requirements/technical/00-platform.md#dec-pf-18), [TR-PF-25](requirements/technical/00-platform.md#tr-pf-25) |
| <a id="registration"></a>**Registration** | The act by which a Data Admin makes a view in a Stack a Resource, with a Display Name and a Collection. The Registrations together are the index of Data Hub. | [DEC-SR-02](requirements/functional/04-stacks-and-resources.md#dec-sr-02) |
| <a id="release"></a>**Release** | Making data available, in two steps that Data Hub enforces: from the Data Team to the Owner (Registration in a Collection), then from the Owner to the company (Publication). | [Release in two steps](overview/data-hub.md#release-in-two-steps) |
| <a id="report"></a>**Report** | One or more Lenses around a question, with text and explanation, made by business. It shares its Parameters with its Lenses; its Level is the lowest Level of the Lenses in it. | [Reports](overview/data-hub.md#reports) |
| <a id="resource"></a>**Resource** | A registered view from a Stack: one book on the shelves. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="resource-card"></a>**Resource Card** | Everything Data Hub knows about one Resource, partly derived and partly kept by Data Hub itself. | [The Resource Card](overview/data-hub.md#the-resource-card) |
| <a id="role-group"></a>**Role Group** | A Group that gives its members a role in Data Hub, such as `datahub-datateam@` for the Data Team. | [User management](requirements/functional/02-user-management.md#naming-convention) |
| <a id="signal"></a>**Signal** | A Reaction reporting that something seems odd about the data of a Resource. It goes to the Owner and the Data Team, and can become an Anomaly. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| <a id="source-job"></a>**Source Job** | The one prod job in dbt Cloud, per dbt project, whose Artifacts Data Hub uses: a full build that also runs `dbt docs generate`. | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| <a id="stack"></a>**Stack**, **the Stacks** | A dataset in BigQuery with mart views that the Data Team releases, as authorized views onto the datasets behind them. Today there is one: `dbt_prod_stacks`. | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
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

The Confluence pages are in Dutch. This table maps their vocabulary to the English used here, so that terms can be found in both places. Defined Terms appear with their capitals. It is the only place in this repository where Dutch is used on purpose.

| Confluence (Dutch) | Repository (English) |
| --- | --- |
| aanwinstenregister | accession register |
| access-as | access axis |
| begrip, beta-begrip | concept, Beta Concept |
| bekend gedrag | Known Behaviour |
| bekrachtigen, bekrachtiging | confirm, Confirmation |
| Beschikbaar, Beschreven, Bekrachtigd, Verkend, Bewaakt | Available, Described, Confirmed, Explored, Monitored |
| berichtencentrum | Message Centre |
| beslissing | decision |
| bibliothecaris | librarian |
| bronjob | Source Job |
| collectie | Collection |
| collectiebeheer en wieden | collection management and weeding |
| conservator | curator |
| datateam | Data Team |
| domeinmodel | Domain Model |
| fiche, catalogusfiche | Resource Card, catalogue card |
| functionele regel | functional requirement |
| Gebruikersbeheer | User management |
| gesprek | conversation |
| grafiekserver | Chart Server |
| grafiektaal | chart language |
| huidige versie | Current Version |
| inschrijving | Registration |
| kanalen | channels |
| kanttekeningen in de marge | margin notes |
| leesbare naam | Display Name |
| leeszaal | reading room |
| lens, lenzen | Lens, Lenses |
| lezerskaart | Library Card |
| melding | notification |
| ontsluiting, ontsluiten | Release, release |
| open punten | open points |
| open uitleen | general circulation |
| opheffen | dissolve |
| promotielus | Promotion Loop |
| randgevallen | edge cases |
| rechten | permissions |
| rekken | shelves |
| signaal, opmerking, vraag | Signal, Remark, Question |
| sleutel | Key |
| steunt op | builds on |
| stroom | flow |
| toegangsclassificatie | access classification |
| uit te diepen | to be worked out |
| vergrootglas | magnifying glass |
| verharden | harden |
| vingerafdruk | Fingerprint |
| wijziging | Change |
