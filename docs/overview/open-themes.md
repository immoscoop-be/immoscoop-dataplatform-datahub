# Open themes

| | |
| --- | --- |
| Source of truth | This file |
| Migrated from | The sections "Uit te diepen" and "Verder te verduidelijken in de analyse" of [ptditt - Tooling - Data Hub](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1362428000) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17 |

What still needs its own elaboration for Data Hub as a whole. Open points that touch only one domain are in that domain's file under [functional requirements](../requirements/functional/README.md).

## To be worked out

Three themes still need their own elaboration. They are connected: the Catalogue is where permissions are tied to and where the Promotion Loop ends up, so it comes first.

### 1. Catalogue management

The Catalogue is layered. Whoever asks a question expects a chart or an action; whoever digs deeper sees that the answer is built from Resources that are combined, aggregated and enriched. What the Catalogue shows therefore goes from Resources, through Lenses, to Reports.

- <a id="dec-dh-60"></a>**DEC-DH-60** · Business does not need to know the concept "intermediate". It works with Resources, makes Lenses and new concepts from them itself, and brings those together in Reports.
- <a id="dec-dh-61"></a>**DEC-DH-61** · A new concept that business defines itself, such as buy session, is Beta: it lives only in its own context in Data Hub and is at Level 0 of the ladder, regardless of the Level of the Resources beneath it. What is built on it is Beta too.
- <a id="dec-dh-62"></a>**DEC-DH-62** · There is no intermediate "alpha" step. A concept that is hardened comes back as a Resource and is then on the normal ladder, from Described.

- [x] <a id="op-dh-01"></a>**OP-DH-01** · Work out how the Data Team puts a Resource in the Stacks and takes it out again: Registration and deregistration by a Data Admin (see [Stacks and resources](../requirements/functional/04-stacks-and-resources.md)).
- [x] <a id="op-dh-02"></a>**OP-DH-02** · Decide who classifies Resources into Collections: the Data Team, and moving between Collections does not exist (see [Collections](../requirements/functional/03-collections.md)).
- [ ] <a id="op-dh-03"></a>**OP-DH-03** · Work out what happens to Users, Lenses, Reports and feeds when a Resource disappears from the Stacks or is renamed.
- [ ] <a id="op-dh-04"></a>**OP-DH-04** · Work out how Data Hub keeps track, per Resource, of which Lenses, Reports, feeds and EDAs use it, for example via the tables touched in the BigQuery job log of its own account.
- [ ] <a id="op-dh-05"></a>**OP-DH-05** · Find out whether model contracts on the mart views in the Stacks make sense, so that structural Changes become a deliberate step.
- [ ] <a id="op-dh-06"></a>**OP-DH-06** · Work out how Entities from the Domain Model are mapped onto the manifest of the dbt project of the Domain Model.
- [ ] <a id="op-dh-07"></a>**OP-DH-07** · Work out whether and how a Beta Concept or a beta report can be shared outside its own context before it is hardened.
- [ ] <a id="op-dh-08"></a>**OP-DH-08** · Agree how a Beta Concept relates to a Lens: when does a Lens define a new concept, and is it therefore at Beta?
- [ ] <a id="op-dh-09"></a>**OP-DH-09** · Work out the Lens types. Provisional candidates: funnel, trend, breakdown, distribution, ranking, number, cohort and list.
- [ ] <a id="op-dh-10"></a>**OP-DH-10** · Work out how Parameters are named and typed, and whether Entity Parameters such as agency or office take their type from the Domain Model.
- [ ] <a id="op-dh-11"></a>**OP-DH-11** · Choose whether Lenses render in the browser (interactive) or on the server as SVG (guaranteed identical), and whether the rendering in Claude follows the light or dark mode of the host.
- [ ] <a id="op-dh-12"></a>**OP-DH-12** · Exercise: for each asset (Resource, Lens, Report), map through which channels it is released (Data Hub itself, Claude as an MCP App, HTML report, Excel connector) and which form each channel carries, data or visual.
- [ ] <a id="op-dh-13"></a>**OP-DH-13** · Settle the final name of the dataset; the working name is `dbt_prod_stacks`.
- [ ] <a id="op-dh-14"></a>**OP-DH-14** · Work out the schema of the Resource Card in Postgres, with migrations in the Data Hub repository.
- [ ] <a id="op-dh-15"></a>**OP-DH-15** · Work out how Anomalies, with their period, appear as annotations on Lenses and charts that cover that period.
- [ ] <a id="op-dh-16"></a>**OP-DH-16** · Find out whether the Resource Cards are exported periodically to BigQuery, so that reporting on the Catalogue is possible as well.
- [ ] <a id="op-dh-17"></a>**OP-DH-17** · At build time, record how the dbt projects (dbt-prod and Colleciónes) and their prod job are identified in dbt Cloud.
- [ ] <a id="op-dh-18"></a>**OP-DH-18** · Find out whether dbt Cloud can send a webhook after a successful run, or whether Data Hub polls after the scheduled time.
- [ ] <a id="op-dh-19"></a>**OP-DH-19** · Decide which automatic checks follow from the EDA and the monitors, and what happens when a check fails.
- [ ] <a id="op-dh-20"></a>**OP-DH-20** · Choose the channel and rhythm of notifications: Slack, email or only in Data Hub, immediately or as a digest.
- [ ] <a id="op-dh-21"></a>**OP-DH-21** · Work out what happens to a Lens when a column it uses disappears.

### 2. Permissions and User/Group management

- [ ] <a id="op-dh-22"></a>**OP-DH-22** · Work out access: how Owner Units and the access axis affect what someone sees through Data Hub. *Note of 2026-10-19: who sees a Collection and its Resources is decided in [DEC-CO-10](../requirements/functional/03-collections.md#dec-co-10) to [DEC-CO-12](../requirements/functional/03-collections.md#dec-co-12); the access axis remains open.*
- [x] <a id="op-dh-23"></a>**OP-DH-23** · Decide who creates and manages Owner Units, and how people get into them: Workspace groups following a convention (see [User management](../requirements/functional/02-user-management.md)).
- [ ] <a id="op-dh-24"></a>**OP-DH-24** · Define the roles in Data Hub: what a reader, an Owner and the Data Team may do. *Note of 2026-10-19: for Collections, see [DEC-CO-08](../requirements/functional/03-collections.md#dec-co-08) and [DEC-CO-11](../requirements/functional/03-collections.md#dec-co-11).*
- [ ] <a id="op-dh-25"></a>**OP-DH-25** · Work out the issuing, revoking and renewing of personal keys, the Library Cards.

### 3. The Promotion Loop

Conceptually described in [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch); practically still open. In ladder terms: a Beta Concept is hardened into a Resource, with the beta query as its specification. The librarian puts it on the shelves; it starts at Described and climbs again, with a new EDA and monitoring.

- [ ] <a id="op-dh-26"></a>**OP-DH-26** · Work out where and how promotion happens technically, from a concept in Data Hub to a Resource in the Stacks.
- [ ] <a id="op-dh-27"></a>**OP-DH-27** · Decide the form of the request to the Data Team, and how it is linked to the Owner Unit, the Collection and the Domain Model.
- [ ] <a id="op-dh-28"></a>**OP-DH-28** · Work out how the working version is realigned to the new Resource after promotion.

## To be clarified in the analysis

- [ ] <a id="op-dh-29"></a>**OP-DH-29** · Draw up the functional and technical analysis of Data Hub, following the example of the one for the Chart Server. *Migration note: this analysis is now being built up under [requirements](../requirements/README.md).*
- [ ] <a id="op-dh-30"></a>**OP-DH-30** · Decide the scope of the documentation: which forms, in which order, and what the pilot needs.
- [ ] <a id="op-dh-31"></a>**OP-DH-31** · Decide whether Data Hub stays a separate application next to Domain Hub or merges with it.
- [ ] <a id="op-dh-32"></a>**OP-DH-32** · Decide the relation to our own manifest MCP server under construction, and to the broader connector rollout.
- [ ] <a id="op-dh-33"></a>**OP-DH-33** · Choose the form of the communication between colleagues. *Note of 2026-10-23: every Message carries its Subject, the asset it is about, links to it, and can be found by it ([DEC-CV-01](../requirements/functional/14-conversations.md#dec-cv-01), [FR-CV-04](../requirements/functional/14-conversations.md#fr-cv-04)); the form remains open.*
- [ ] <a id="op-dh-34"></a>**OP-DH-34** · Check with Sibe and Philippe whether Colleciónes can provide `model_type` and `grain`.
- [ ] <a id="op-dh-35"></a>**OP-DH-35** · Connect to the existing Cloud Run setup of the Colleciónes server: deploy, internal reachability under internal-immoscoop.be, and monitoring. *Note of 2026-10-17: Data Hub is publicly reachable ([DEC-PF-10](../requirements/technical/00-platform.md#dec-pf-10)), so internal reachability under internal-immoscoop.be no longer applies; deploy and monitoring remain open.*
- [ ] <a id="op-dh-36"></a>**OP-DH-36** · In the pilot with Hannelore, test whether Lenses in Excel are enough, or whether business also needs whole Resources.
- [ ] <a id="op-dh-37"></a>**OP-DH-37** · Bring the description of Q&A in the Glossary (Woordenlijst, Confluence) in line with the principle that is still open.

## From the workshop of 2026-10-22

Raised by the [workshop on data agents and governance](../workshops/2026-10-22-data-agents-and-governance.md); the requirements it proposed are in the domain files.

- [x] <a id="op-dh-38"></a>**OP-DH-38** · Confirm the kinds of assets the workshop names: Resource, Collection, Lens, semgraph (a chart on a Lens or a Resource, through the Chart Server) and Report ([REQ-DH-ASSETS](../workshops/2026-10-22-data-agents-and-governance.md#req-dh-assets)). [From Stacks to Report](data-hub.md#from-stacks-to-report) has three: Resource, Lens and Report. Decide also what the Level of a Collection is, as every asset carries the lowest Level beneath it. *Raised while taking in the workshop.* *Decided on 2026-10-22: four kinds of assets, with the Collection as their container ([DEC-DH-64](data-hub.md#dec-dh-64)).*
- [ ] <a id="op-dh-39"></a>**OP-DH-39** · Later, on the roadmap: a process for data onboarding with new features, the chain IT → Data → business, which touches Data Hub through taking in new Resources (post-it 6).
