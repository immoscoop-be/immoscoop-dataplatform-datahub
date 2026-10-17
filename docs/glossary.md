# Glossary

The terms used throughout this documentation and in the app. Everything in Data Hub is in English ([FR-SR-15](requirements/functional/04-stacks-and-resources.md#fr-sr-15)), so these terms are also the vocabulary of the interface.

Many terms have a counterpart in the library that Data Hub is modelled on ([DEC-DH-01](overview/data-hub.md#dec-dh-01)). The full mapping is in [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library).

Spelling: British English. "Catalog" is spelled the dbt way only when it means dbt's `catalog.json`; everywhere else it is "catalogue".

## Terms

| Term | Meaning | Defined in |
| --- | --- | --- |
| Accession register | Library term for the dbt artifacts: what changed in the collection at every prod run | [Artifact registry](requirements/functional/01-artifact-registry.md) |
| Anomaly | A recorded deviation in the data, with a period, a description of what happened, the impact on the figures and who recorded it. Part of known behaviour; a signal can become one | [DEC-DH-18](overview/data-hub.md#dec-dh-18), [FR-SR-30](requirements/functional/04-stacks-and-resources.md#fr-sr-30) |
| Artifact set | The artifacts of one successful run of a source job: `manifest.json` and `catalog.json`, with run ID, git SHA and timestamp | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| Artifacts (dbt) | `manifest.json` and `catalog.json`, the files dbt produces about a project. Not to be confused with GCP's Artifact Registry | [The dbt artifacts](overview/data-hub.md#the-dbt-artifacts) |
| Beta concept | A concept that business defines itself, such as buy session. It lives only in its own context and is at level 0; whatever is built on it is beta too | [DEC-DH-61](overview/open-themes.md#dec-dh-61) |
| Catalog (dbt) | dbt's `catalog.json`: the actual columns and types in BigQuery | [The dbt artifacts](overview/data-hub.md#the-dbt-artifacts) |
| Catalogue | Searching and browsing in Data Hub, via table, catalogue or domain model | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |
| Change | A difference for one node between a new artifact set and the previous current version. Five kinds: description, logic, type, structural, node added or removed | [Artifact registry](requirements/functional/01-artifact-registry.md#kinds-of-change) |
| Chart language | The visual language for charts, kept in Figma. The source for the visualisation of lenses and for chart colours | [DEC-DH-13](overview/data-hub.md#dec-dh-13), [Collections](requirements/functional/03-collections.md#colour-palette) |
| Chart server | The server that renders charts, working together with Data Hub; it runs on AWS | [DEC-DH-53](overview/data-hub.md#dec-dh-53) |
| Collection | A functional domain of Immoscoop, such as leads or agencies, in which resources sit together under one owner unit | [Collections](requirements/functional/03-collections.md) |
| Confirmation | The owner's declaration that the data of a resource is correct, stored with the schema fingerprint of that moment. The first publication is the first confirmation | [DEC-DH-39](overview/data-hub.md#dec-dh-39), [FR-SR-17](requirements/functional/04-stacks-and-resources.md#fr-sr-17) |
| Curator | Library counterpart of the owner | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |
| Current version | Per dbt project, the most recent fully processed artifact set; the rest of Data Hub works on it | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| Data admin | A member of the role group of the data team, who registers and manages resources | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| Data team | The librarian: takes data in, describes it and puts it on the shelves | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |
| Display name | The readable, unique name of a resource, as business sees it, for example "Agency purity" | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| Dossier | Library counterpart of a report | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |
| Edge | A link in the lineage: this node depends on that node | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| EDA | Exploratory data analysis: the exploration of a resource by its owner. A linked EDA document makes a resource Explored | [FR-MR-03](requirements/functional/06-maturity-and-release.md#fr-mr-03), [EDA](requirements/functional/15-eda.md) |
| Fingerprint | A set of hashes of the structure, the types and the descriptions of a resource at a given moment | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| General circulation | Library counterpart of a published resource | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |
| Group | A Google group from Workspace that follows the naming convention | [User management](requirements/functional/02-user-management.md#terms) |
| Key | The full name of a view in BigQuery, `project.dataset.table` | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| Known behaviour | The block on the resource card with intended use, pitfalls and anomalies | [DEC-DH-18](overview/data-hub.md#dec-dh-18) |
| Lens | A rendering of one resource, of a fixed type, with parameters, made by business. Deliberately not called a view. Its level is the lowest level of the resources beneath it | [Lenses](overview/data-hub.md#lenses) |
| Library card | A personal key per user, for example for Excel via Power Query; it can be revoked and renewed | [DEC-DH-47](overview/data-hub.md#dec-dh-47) |
| Log ID | The fixed code of a kind of log entry, with a template and a list of parameters, for example `RES-001` | [Log catalogue](requirements/functional/log-catalogue.md) |
| Log of a resource | Everything that touches a resource, including changes deeper in the lineage | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| Margin notes | Library counterpart of the conversation between colleagues, attached to the object it is about | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |
| Message centre | Where Data Hub delivers its messages, for example to the data admins on every registration | [FR-SR-10](requirements/functional/04-stacks-and-resources.md#fr-sr-10), [Log and notifications](requirements/functional/07-log-and-notifications.md) |
| Node | A model, seed, snapshot, source or exposure from the manifest, with its columns | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| Owner | The owner unit of the collection a resource is in. It vouches for the collection and confirms its resources | [DEC-CO-04](requirements/functional/03-collections.md#dec-co-04) |
| Owner unit | A Google group that takes care of a collection. Deliberately not a team from the organisational structure, but a group that exists only for this purpose | [User management](requirements/functional/02-user-management.md#terms) |
| Parameter | A functionally named and typed input of a lens, for example `dateFrom`, that can be combined across lenses | [DEC-DH-11](overview/data-hub.md#dec-dh-11) |
| Promotion loop | Hardening a beta concept into a resource, with the beta query as its specification | [The promotion loop](overview/open-themes.md#3-the-promotion-loop) |
| Publication | The switch with which the owner makes a resource visible to the whole company | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| Reading room | Where business makes lenses and reports | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |
| Release | Making data available, in two steps that Data Hub enforces: data to owner (registration in a collection), then owner to company (publication) | [Release in two steps](overview/data-hub.md#release-in-two-steps) |
| Report | One or more lenses around a question, with text and explanation, made by business. It shares its parameters with its lenses; its level is the lowest level of the lenses in it | [Reports](overview/data-hub.md#reports) |
| Resource | A registered view from a stack: one book on the shelves | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| Resource card | Everything Data Hub knows about one resource, partly derived and partly kept by Data Hub itself. The library counterpart is the catalogue card | [The resource card](overview/data-hub.md#the-resource-card) |
| Signal | A remark reporting that something seems odd about the data; it can grow into an anomaly | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| Source job | The one prod job in dbt Cloud, per dbt project, whose artifacts Data Hub uses | [Artifact registry](requirements/functional/01-artifact-registry.md#terms) |
| Stack, the stacks | A dataset in BigQuery with mart views that the data team releases, as authorized views onto the datasets behind them. Today there is one: `dbt_prod_stacks` | [Stacks and resources](requirements/functional/04-stacks-and-resources.md#terms) |
| Synchronisation | Periodically pulling in the members of all convention groups | [User management](requirements/functional/02-user-management.md#terms) |
| User | Someone with an Immoscoop Google Workspace account who has logged in to Data Hub at least once | [User management](requirements/functional/02-user-management.md#terms) |
| Weeding | Library counterpart of deregistering resources and removing them from collections | [Data Hub as a library](overview/data-hub.md#data-hub-as-a-library) |

## Maturity levels

The ladder itself is defined on [Maturity levels of data](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361608858) (Confluence, Dutch). How a resource rises and drops is specified in [Maturity and release](requirements/functional/06-maturity-and-release.md#rising-and-dropping).

| Level | Name | Reached when |
| --- | --- | --- |
| 0 | Beta | A concept that business defines itself, living only in its own context |
| 1 | Available | Registered; the description is incomplete |
| 2 | Described | The view and every column have a description |
| 3 | Confirmed | The owner has confirmed the resource |
| 4 | Explored | An EDA document is linked |
| 5 | Monitored | At least one check is active |

## Translation reference

The Confluence pages are in Dutch. This table maps their vocabulary to the English used here, so that terms can be found in both places. It is the only place in this repository where Dutch is used on purpose.

| Confluence (Dutch) | Repository (English) |
| --- | --- |
| aanwinstenregister | accession register |
| access-as | access axis |
| begrip, beta-begrip | concept, beta concept |
| bekend gedrag | known behaviour |
| bekrachtigen, bekrachtiging | confirm, confirmation |
| Beschikbaar, Beschreven, Bekrachtigd, Verkend, Bewaakt | Available, Described, Confirmed, Explored, Monitored |
| berichtencentrum | message centre |
| beslissing | decision |
| bibliothecaris | librarian |
| bronjob | source job |
| collectie | collection |
| collectiebeheer en wieden | collection management and weeding |
| conservator | curator |
| datateam | data team |
| domeinmodel | domain model |
| fiche, catalogusfiche | resource card, catalogue card |
| functionele regel | functional requirement |
| Gebruikersbeheer | User management |
| gesprek | conversation |
| grafiekserver | chart server |
| grafiektaal | chart language |
| huidige versie | current version |
| inschrijving | registration |
| kanalen | channels |
| kanttekeningen in de marge | margin notes |
| leesbare naam | display name |
| leeszaal | reading room |
| lens, lenzen | lens, lenses |
| lezerskaart | library card |
| melding | notification |
| ontsluiting, ontsluiten | release |
| open punten | open points |
| open uitleen | general circulation |
| opheffen | dissolve |
| promotielus | promotion loop |
| randgevallen | edge cases |
| rechten | permissions |
| rekken | shelves |
| signaal, opmerking, vraag | signal, remark, question |
| sleutel | key |
| steunt op | builds on |
| stroom | flow |
| toegangsclassificatie | access classification |
| uit te diepen | to be worked out |
| vergrootglas | magnifying glass |
| verharden | harden |
| vingerafdruk | fingerprint |
| wijziging | change |
