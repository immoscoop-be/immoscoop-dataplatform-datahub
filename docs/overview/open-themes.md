# Open themes

| | |
| --- | --- |
| Source of truth | This file |
| Migrated from | The sections "Uit te diepen" and "Verder te verduidelijken in de analyse" of [ptditt - Tooling - Data Hub](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1362428000) (Confluence, Dutch), last modified 2026-10-17, migrated 2026-10-17 |

What still needs its own elaboration for Data Hub as a whole. Open points that touch only one domain are in that domain's file under [functional requirements](../requirements/functional/README.md).

## To be worked out

Three themes still need their own elaboration. They are connected: the catalogue is where permissions are tied to and where the promotion loop ends up, so it comes first.

### 1. Catalogue management

The catalogue is layered. Whoever asks a question expects a chart or an action; whoever digs deeper sees that the answer is built from resources that are combined, aggregated and enriched. What the catalogue shows therefore goes from resources, through lenses, to reports.

- <a id="dec-dh-60"></a>**DEC-DH-60** · Business does not need to know the concept "intermediate". It works with resources, makes lenses and new concepts from them itself, and brings those together in reports.
- <a id="dec-dh-61"></a>**DEC-DH-61** · A new concept that business defines itself, such as buy session, is beta: it lives only in its own context in Data Hub and is at level 0 of the ladder, regardless of the level of the resources beneath it. What is built on it is beta too.
- <a id="dec-dh-62"></a>**DEC-DH-62** · There is no intermediate "alpha" step. A concept that is hardened comes back as a resource and is then on the normal ladder, from Described.

- [x] <a id="op-dh-01"></a>**OP-DH-01** · Work out how the data team puts a resource in the stacks and takes it out again: registration and deregistration by a data admin (see [Stacks and resources](../requirements/functional/04-stacks-and-resources.md)).
- [x] <a id="op-dh-02"></a>**OP-DH-02** · Decide who classifies resources into collections: the data team, and moving between collections does not exist (see [Collections](../requirements/functional/03-collections.md)).
- [ ] <a id="op-dh-03"></a>**OP-DH-03** · Work out what happens to users, lenses, reports and feeds when a resource disappears from the stacks or is renamed.
- [ ] <a id="op-dh-04"></a>**OP-DH-04** · Work out how Data Hub keeps track, per resource, of which lenses, reports, feeds and EDAs use it, for example via the tables touched in the BigQuery job log of its own account.
- [ ] <a id="op-dh-05"></a>**OP-DH-05** · Find out whether model contracts on the mart views in the stacks make sense, so that structural changes become a deliberate step.
- [ ] <a id="op-dh-06"></a>**OP-DH-06** · Work out how entities from the domain model are mapped onto the manifest of the dbt project of the domain model.
- [ ] <a id="op-dh-07"></a>**OP-DH-07** · Work out whether and how a beta concept or a beta report can be shared outside its own context before it is hardened.
- [ ] <a id="op-dh-08"></a>**OP-DH-08** · Agree how a beta concept relates to a lens: when does a lens define a new concept, and is it therefore at Beta?
- [ ] <a id="op-dh-09"></a>**OP-DH-09** · Work out the lens types. Provisional candidates: funnel, trend, breakdown, distribution, ranking, number, cohort and list.
- [ ] <a id="op-dh-10"></a>**OP-DH-10** · Work out how parameters are named and typed, and whether entity parameters such as agency or office take their type from the domain model.
- [ ] <a id="op-dh-11"></a>**OP-DH-11** · Choose whether lenses render in the browser (interactive) or on the server as SVG (guaranteed identical), and whether the rendering in Claude follows the light or dark mode of the host.
- [ ] <a id="op-dh-12"></a>**OP-DH-12** · Exercise: for each asset (resource, lens, report), map through which channels it is released (Data Hub itself, Claude as an MCP App, HTML report, Excel connector) and which form each channel carries, data or visual.
- [ ] <a id="op-dh-13"></a>**OP-DH-13** · Settle the final name of the dataset; the working name is `dbt_prod_stacks`.
- [ ] <a id="op-dh-14"></a>**OP-DH-14** · Work out the schema of the resource card in Postgres, with migrations in the Data Hub repository.
- [ ] <a id="op-dh-15"></a>**OP-DH-15** · Work out how anomalies, with their period, appear as annotations on lenses and charts that cover that period.
- [ ] <a id="op-dh-16"></a>**OP-DH-16** · Find out whether the resource cards are exported periodically to BigQuery, so that reporting on the catalogue is possible as well.
- [ ] <a id="op-dh-17"></a>**OP-DH-17** · At build time, record how the dbt projects (dbt-prod and Colleciónes) and their prod job are identified in dbt Cloud.
- [ ] <a id="op-dh-18"></a>**OP-DH-18** · Find out whether dbt Cloud can send a webhook after a successful run, or whether Data Hub polls after the scheduled time.
- [ ] <a id="op-dh-19"></a>**OP-DH-19** · Decide which automatic checks follow from the EDA and the monitors, and what happens when a check fails.
- [ ] <a id="op-dh-20"></a>**OP-DH-20** · Choose the channel and rhythm of notifications: Slack, email or only in Data Hub, immediately or as a digest.
- [ ] <a id="op-dh-21"></a>**OP-DH-21** · Work out what happens to a lens when a column it uses disappears.

### 2. Permissions and user/group management

- [ ] <a id="op-dh-22"></a>**OP-DH-22** · Work out access: how owner units and the access axis affect what someone sees through Data Hub.
- [x] <a id="op-dh-23"></a>**OP-DH-23** · Decide who creates and manages owner units, and how people get into them: Workspace groups following a convention (see [User management](../requirements/functional/02-user-management.md)).
- [ ] <a id="op-dh-24"></a>**OP-DH-24** · Define the roles in Data Hub: what a reader, an owner and the data team may do.
- [ ] <a id="op-dh-25"></a>**OP-DH-25** · Work out the issuing, revoking and renewing of personal keys, the library cards.

### 3. The promotion loop

Conceptually described in [Domain tooling](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975041) (Confluence, Dutch); practically still open. In ladder terms: a beta concept is hardened into a resource, with the beta query as its specification. The librarian puts it on the shelves; it starts at Described and climbs again, with a new EDA and monitoring.

- [ ] <a id="op-dh-26"></a>**OP-DH-26** · Work out where and how promotion happens technically, from a concept in Data Hub to a resource in the stacks.
- [ ] <a id="op-dh-27"></a>**OP-DH-27** · Decide the form of the request to the data team, and how it is linked to the owner unit, the collection and the domain model.
- [ ] <a id="op-dh-28"></a>**OP-DH-28** · Work out how the working version is realigned to the new resource after promotion.

## To be clarified in the analysis

- [ ] <a id="op-dh-29"></a>**OP-DH-29** · Draw up the functional and technical analysis of Data Hub, following the example of the one for the chart server. *Migration note: this analysis is now being built up under [requirements](../requirements/README.md).*
- [ ] <a id="op-dh-30"></a>**OP-DH-30** · Decide the scope of the documentation: which forms, in which order, and what the pilot needs.
- [ ] <a id="op-dh-31"></a>**OP-DH-31** · Decide whether Data Hub stays a separate application next to Domain Hub or merges with it.
- [ ] <a id="op-dh-32"></a>**OP-DH-32** · Decide the relation to our own manifest MCP server under construction, and to the broader connector rollout.
- [ ] <a id="op-dh-33"></a>**OP-DH-33** · Choose the form of the communication between colleagues.
- [ ] <a id="op-dh-34"></a>**OP-DH-34** · Check with Sibe and Philippe whether Colleciónes can provide `model_type` and `grain`.
- [ ] <a id="op-dh-35"></a>**OP-DH-35** · Connect to the existing Cloud Run setup of the Colleciónes server: deploy, internal reachability under internal-immoscoop.be, and monitoring.
- [ ] <a id="op-dh-36"></a>**OP-DH-36** · In the pilot with Hannelore, test whether lenses in Excel are enough, or whether business also needs whole resources.
- [ ] <a id="op-dh-37"></a>**OP-DH-37** · Bring the description of Q&A in the Glossary (Woordenlijst, Confluence) in line with the principle that is still open.
