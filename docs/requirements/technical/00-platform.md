# Platform: technical requirements

| | |
| --- | --- |
| Code | `PF`: technical choices that are not tied to one functional domain |
| Status | Specified where it restates a confirmed decision; Proposed where it adds detail |
| Source of truth | This file; the architecture that follows from it is described in [`docs/architecture/`](../../architecture/README.md) |

**In one sentence:** Data Hub is a set of TypeScript services on Cloud Run, each validating the User itself, behind several interfaces that all use the same APIs.

## Decisions

Decided on 2026-10-17, on the proposal for the architecture and technology.

- <a id="dec-pf-01"></a>**DEC-PF-01** · Data Hub is split into services, each with one responsibility and deployed separately. In v1 there are four backend services, identity, catalogue, registry and query, and two client applications, web and mcp. Lenses, Reports and notifications become services of their own once their domains are specified. *Note of 2026-10-29: Lenses live in query ([DEC-PF-30](#dec-pf-30)).*
- <a id="dec-pf-02"></a>**DEC-PF-02** · Every service validates the User itself, on every request. A central identity service issues short-lived signed Access Tokens; every service verifies them locally against the public keys of identity, and decides on its own what the User may do.
- <a id="dec-pf-03"></a>**DEC-PF-03** · Every interface is a client of the same service APIs and holds no business logic. In v1: the web app, Claude through mcp, and Excel through Power Query. Other interfaces, such as HTML reports, plug in the same way. *Note of 2026-10-28: Claude comes in version 2 ([DEC-CH-02](../functional/13-channels.md#dec-ch-02)).*
- <a id="dec-pf-04"></a>**DEC-PF-04** · All code lives in one monorepo, this repository, with pnpm workspaces: `services/*`, `apps/*` and `packages/*`.
- <a id="dec-pf-05"></a>**DEC-PF-05** · There is one Cloud SQL Postgres instance, with one schema per service. A service only reads and writes its own schema; the data of another service is reached through that service's API.
- <a id="dec-pf-06"></a>**DEC-PF-06** · The web app is built in React. The components that render Lenses and Reports are shared between the web app and the MCP App, so that only one version exists ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15)). *Note of 2026-10-22: whether React builds the new design is open ([OP-UX-10](../../design/principles.md#op-ux-10)).* *Note of 2026-10-28: Svelte instead of React ([DEC-PF-28](#dec-pf-28)).*
- <a id="dec-pf-07"></a>**DEC-PF-07** · Services expose REST APIs with JSON, described in OpenAPI that is generated from zod schemas. Not tRPC: Excel and MCP clients need plain HTTP.
- <a id="dec-pf-08"></a>**DEC-PF-08** · Every service runs under its own GCP service account, with only the permissions its responsibility needs.
- <a id="dec-pf-09"></a>**DEC-PF-09** · Tooling: Node.js 24 LTS and TypeScript in strict mode; Fastify for HTTP; Kysely for Postgres; zod for schemas; jose for tokens; the official MCP TypeScript SDK; Vitest for tests; Terraform for infrastructure. Node.js moves to the next LTS release once it is available. These build on [DEC-DH-53](../../overview/data-hub.md#dec-dh-53) to [DEC-DH-55](../../overview/data-hub.md#dec-dh-55).
- <a id="dec-pf-10"></a>**DEC-PF-10** · All services and applications of Data Hub are publicly reachable. The protection comes from the login and the token check in every service, not from the network, so that the browser, Excel and Claude can reach Data Hub from anywhere. Claude in particular calls MCP servers from Anthropic's servers on the internet, so an internal-only mcp would be unreachable for it. This answers [OP-PF-04](#op-pf-04).
- <a id="dec-pf-11"></a>**DEC-PF-11** · The container images of the services are stored in Artifact Registry in GCP, not on Docker Hub: Cloud Run pulls from it with its own identity, without extra credentials, the images stay private, and they live in the same region as the services. The note in the [Artifact registry](../functional/01-artifact-registry.md) domain already assumed this.
- <a id="dec-pf-12"></a>**DEC-PF-12** · The repository lives in the organisation `immoscoop-be`, next to the data repository, as `immoscoop-be/immoscoop-dataplatform-datahub`. It was transferred there from a personal account on 2026-10-17, with its full history; the old address redirects. This answers [OP-PF-11](#op-pf-11).
- <a id="dec-pf-13"></a>**DEC-PF-13** · Each environment runs in the existing GCP project of the data platform for that environment: prod in `immoscoop-dataplatform-398214`, uat in `immoscoop-dataplatform`, both in the region `europe-west1`, where all their BigQuery data lives. Each environment has its own Cloud SQL instance, service accounts, bucket and Cloud Run services, and reads the Stacks of its own project. This answers [OP-PF-09](#op-pf-09) for the projects and the region.
- <a id="dec-pf-14"></a>**DEC-PF-14** · Every change goes first to uat, then from uat to prod. Work lands in the branch `uat` through a pull request; the branch `main`, which is prod, only receives merges from `uat`. The same strategy as the data repository.
- <a id="dec-pf-15"></a>**DEC-PF-15** · The infrastructure of Data Hub is defined in Terraform in this repository, in `infra/`. There is no other Terraform for these projects, and Data Hub keeps its own.
- <a id="dec-pf-16"></a>**DEC-PF-16** · GitHub Actions applies the Terraform: a push to `uat` applies it to uat, a merge into `main` applies it to prod. Nobody applies it from their own machine. Only the one-time bootstrap that makes this possible is run by hand ([GCP setup](../../architecture/gcp-setup.md)).
- <a id="dec-pf-17"></a>**DEC-PF-17** · The private key that signs Access Tokens lives in Cloud KMS: it is created there, never leaves it, and nobody can read it, not even a project Owner. Only identity may sign with it. It is rotated once a year, and immediately on any suspicion of misuse.
- <a id="dec-pf-18"></a>**DEC-PF-18** · A client that signs in on behalf of a User keeps that User signed in with a Refresh Token from identity: the server of the web app, and MCP clients such as Claude. One mechanism for every client. The Refresh Token of the web app lasts 12 hours, once a working day through Google; that of an MCP client 30 days, renewed as it is used. At every renewal identity reads the Groups again and checks the account in Workspace.
- <a id="dec-pf-19"></a>**DEC-PF-19** · The web app is served by a small Cloud Run service of its own. That service also keeps the Refresh Token of the User, in a cookie of its own address, so that no browser treats it as a third-party cookie and Data Hub works on any address. It holds no business logic.
- <a id="dec-pf-20"></a>**DEC-PF-20** · Heavy work that a request starts runs as a Cloud Run job, built from the same image as its service and running under the same service account. The first is the processing of an Artifact Set ([DEC-DH-23](../../overview/data-hub.md#dec-dh-23)): the service only records what has to be done and starts the job, which works through it without the time limit of a request.
- <a id="dec-pf-21"></a>**DEC-PF-21** · People look into the database only as members of the Role Group of the Data Team, read-only, through Cloud SQL Studio, and never with a password. They see the schemas of registry and catalogue; the schema of identity, with sessions and personal data, stays closed to people. *Note of 2026-10-29: and the schema of query, with the Query Log ([DEC-PF-29](#dec-pf-29)).*
- <a id="dec-pf-22"></a>**DEC-PF-22** · The web app is built with the component library Mantine, in the look of the Immoscoop brandbook: its colours and the font Poppins, white and light, with plenty of space. In the terms of the brandbook, Data Hub is a trusted environment, where teal may cover larger areas than in a first contact. There is one light look; no dark mode for now. This works out [DEC-PF-06](#dec-pf-06). *Note of 2026-10-22: the [design](../../design/principles.md) has warm greys, colour only on content, and a light and a dark theme; whether it replaces this is open ([OP-UX-09](../../design/principles.md#op-ux-09), [OP-UX-10](../../design/principles.md#op-ux-10)).* *Note of 2026-10-28: no Mantine; the look comes from the design ([DEC-PF-28](#dec-pf-28)); whether the colours of the brandbook and one light look still hold is [OP-UX-09](../../design/principles.md#op-ux-09).* *Note of 2026-10-28: its look is replaced by that of the design, with a light and a dark theme ([DEC-UX-104](../../design/principles.md#dec-ux-104)).*
- <a id="dec-pf-23"></a>**DEC-PF-23** · semgraph, the Chart Server, becomes a backend service of Data Hub, in `services/semgraph`, next to the four of [DEC-PF-01](#dec-pf-01) ([DEC-DH-63](../../overview/data-hub.md#dec-dh-63)). It draws every chart in Data Hub, for the web app and for Claude; the web app has no chart library of its own. Like every service, it validates the Access Token itself and is publicly reachable ([DEC-PF-02](#dec-pf-02), [DEC-PF-10](#dec-pf-10)). How it moves in is open ([OP-PF-15](#op-pf-15) to [OP-PF-18](#op-pf-18)). *Note of 2026-10-18: semgraph is open to everyone, without login ([DEC-PF-24](#dec-pf-24)).*
- <a id="dec-pf-24"></a>**DEC-PF-24** · semgraph is open to everyone, worldwide, without login: its API, its MCP server and its gallery. It holds no data and has access to none; what it draws comes in the request, from a caller that already has that data. A rate limit per address protects it against abuse instead of a login. It is the one exception to [DEC-PF-02](#dec-pf-02) and [DEC-PF-10](#dec-pf-10), and it stays possible only as long as semgraph never gets access to data or secrets. A limit to requests from Belgium was considered and not chosen: it would block Claude, whose calls come from the servers of Anthropic, and colleagues abroad, while anyone with a Belgian VPN would still get through.
- <a id="dec-pf-25"></a>**DEC-PF-25** · semgraph moved into this repository with its history: its 73 commits, rewritten so that every file sits under `services/semgraph/`. It keeps running its TypeScript directly, without a build, because it reads its definitions (the semgraphs, the vocabulary, the texts and the tokens) next to its code; every image therefore starts with `node .`, the entry point its package names. Its tests run under Vitest, as a project of their own with a longer time limit, and keep their assertions of `node:assert`. Its own Dockerfile, CI and deploy to the internal-tools platform did not come along: the one Dockerfile and the one workflow build it like every service. This answers [OP-PF-15](#op-pf-15).
- <a id="dec-pf-26"></a>**DEC-PF-26** · registry hands catalogue what concerns it with a direct call per Artifact Set that becomes a Current Version, not with a Pub/Sub topic. The call carries the whole state of that dbt project, not what changed since the last call, so a call that gets lost is repaired by the next run; that makes a queue with its own retries unnecessary. registry proves who it is with a Google ID token of its own service account ([TR-PF-05](#tr-pf-05)). This answers [OP-PF-05](#op-pf-05), for the Registration of Resources ([TR-AR-08](01-artifact-registry.md#tr-ar-08)) and later for the Changes.
- <a id="dec-pf-27"></a>**DEC-PF-27** · The services of Data Hub are watched: an uptime check in Cloud Monitoring on the health check of every service and of the web app, and an alert by e-mail to the Data Team when one is down or keeps failing for five minutes. All of it is Terraform in `infra/`, with a test that every service has its check. *Decided on 2026-10-28, by Max ([OP-PF-20](#op-pf-20)).*
- <a id="dec-pf-28"></a>**DEC-PF-28** · The web app is built in Svelte, as other repositories of Immoscoop are, not in React with Mantine. Its look comes from the design: the values of `docs/design/tokens.css` and the components of [components.md](../../design/components.md). The components that render Lenses and Reports stay shared in `packages/ui`, for the web app and later the MCP App ([DEC-CH-02](../functional/13-channels.md#dec-ch-02)). What is built today in React is rebuilt ([DEC-DH-74](../../overview/data-hub.md#dec-dh-74)). This replaces React in [DEC-PF-06](#dec-pf-06) and Mantine in [DEC-PF-22](#dec-pf-22). *Decided on 2026-10-28, by Max ([OP-UX-10](../../design/principles.md#op-ux-10)).*
- <a id="dec-pf-29"></a>**DEC-PF-29** · query keeps its queries, their runs and the Query Log in a schema of its own, `query`, in the same Postgres as the other services ([DEC-LN-01](../functional/07-log-and-notifications.md#dec-ln-01)). The Data Team reads it in Cloud SQL Studio, read-only, as it reads registry and catalogue ([TR-PF-28](#tr-pf-28)): it sees every query in the app already. *Decided on 2026-10-29, by Max.*
- <a id="dec-pf-30"></a>**DEC-PF-30** · Lenses are no service of their own: query keeps them, with their versions, in its schema next to the queries, and runs them. A Lens is a query with its Parameters ([DEC-LE-06](../functional/09-lenses.md#dec-le-06)), and every run of it is a query in the Query Log ([FR-LE-12](../functional/09-lenses.md#fr-le-12)). catalogue keeps the Collections and decides who sees which Resource, as for every query, and keeps the Requests on a Lens as its Messages. This replaces, for Lenses, the last sentence of [DEC-PF-01](#dec-pf-01). *Decided on 2026-10-29, by Max.*
- <a id="dec-pf-31"></a>**DEC-PF-31** · Data Hub sends e-mail through the SMTP relay of Google Workspace, from an address of Immoscoop such as `datahub@`, with replies going nowhere. The relay admits Data Hub by its fixed outgoing IP address, not by a login: the service that sends gets a static address through Cloud NAT, in Terraform, and a Workspace admin adds that address to the relay once, as a step of the bootstrap. No password is kept. *Decided on 2026-10-29, by Max ([OP-PF-19](#op-pf-19)).*

## Requirements

<a id="tr-pf-01"></a>
### TR-PF-01 · Services and runtime

**Status:** Specified · **Realises:** [DEC-PF-01](#dec-pf-01), [DEC-DH-53](../../overview/data-hub.md#dec-dh-53), [DEC-DH-54](../../overview/data-hub.md#dec-dh-54)

Every backend service and client application is a TypeScript Node.js application in its own container, deployed as its own Cloud Run service. In v1: the services identity, catalogue, registry and query, and the applications web and mcp. See the [service map](../../architecture/README.md#services).

<a id="tr-pf-02"></a>
### TR-PF-02 · identity issues short-lived Access Tokens

**Status:** Implemented · **Realises:** [DEC-PF-02](#dec-pf-02), [FR-UM-03](../functional/02-user-management.md#fr-um-03), [FR-UM-06](../functional/02-user-management.md#fr-um-06), [FR-UM-08](../functional/02-user-management.md#fr-um-08), [FR-UM-11](../functional/02-user-management.md#fr-um-11)

After a successful login, identity issues an Access Token: a JWT signed with an asymmetric key in Cloud KMS ([TR-PF-24](#tr-pf-24)), valid for 15 minutes. It carries the fixed Google ID of the User, email, name, the Groups of the User (by their fixed Google ID: every group of the own Workspace domain the User is in, so that a service can check membership of an Owner Unit) and the User's roles. identity publishes its public keys at a JWKS endpoint.

<a id="tr-pf-03"></a>
### TR-PF-03 · Every service validates the token itself

**Status:** Implemented · **Realises:** [DEC-PF-02](#dec-pf-02), [NFR-SEC-01](../non-functional/security.md#nfr-sec-01)

Every request to every service is checked by the shared package `@datahub/auth`: the signature against the public keys of identity (cached), the issuer, the audience and the expiry. A request without a valid token gets `401`. No service implements its own check.

<a id="tr-pf-04"></a>
### TR-PF-04 · Every service authorises itself

**Status:** Specified · **Realises:** [NFR-SEC-01](../non-functional/security.md#nfr-sec-01), [FR-SR-16](../functional/04-stacks-and-resources.md#fr-sr-16), [FR-SR-18](../functional/04-stacks-and-resources.md#fr-sr-18)

After validating the token, each service decides with its own data whether the User may do what they ask, and answers `403` otherwise. For example, catalogue checks visibility before showing a Resource, and ownership before publishing one.

<a id="tr-pf-05"></a>
### TR-PF-05 · Calls between services

**Status:** Implemented · **Realises:** [NFR-SEC-01](../non-functional/security.md#nfr-sec-01), [FR-SR-11](../functional/04-stacks-and-resources.md#fr-sr-11)

A service that calls another service on behalf of a User forwards the Access Token of that User, and the receiving service validates it again. Work that no User started, such as processing Artifacts or synchronising Groups, uses the Google service-account identity of the calling service. Endpoints for such calls accept only the service accounts of Data Hub, and the Log records the actor as Data Hub itself.

*Note of 2026-10-29, on building part 7a: query also tells catalogue about its Lenses as itself when a change of a User starts it, and records the decision of a member of the Data Team on a Request on a Lens, naming them: what it tells is query's own, which catalogue must not take from anyone else ([TR-CV-02](14-conversations.md#tr-cv-02)).*

<a id="tr-pf-06"></a>
### TR-PF-06 · Claude signs in through identity

**Status:** Implemented · **Realises:** [DEC-UM-02](../functional/02-user-management.md#dec-um-02), [DEC-PF-03](#dec-pf-03)

identity acts as the OAuth 2.1 authorisation server for MCP clients, following the MCP authorisation specification, and delegates the login itself to Google. It keeps them signed in with Refresh Tokens ([TR-PF-25](#tr-pf-25)). MCP clients register themselves (RFC 7591), but only with a callback on a fixed list, Claude's, so no other site can have a User's sign-in sent to it. mcp tells clients where to sign in through its protected resource metadata (RFC 9728), and validates the resulting Access Tokens like every other service.

*Could, not in v1: set on 2026-10-28, by Max; Claude comes in version 2 ([DEC-CH-02](../functional/13-channels.md#dec-ch-02)).*

<a id="tr-pf-07"></a>
### TR-PF-07 · Excel uses the Excel key

**Status:** Specified · **Realises:** [DEC-DH-47](../../overview/data-hub.md#dec-dh-47), [DEC-PF-02](#dec-pf-02)

Power Query sends the Excel key with every request. The shared package `@datahub/auth` exchanges it at identity for an Access Token, cached for the lifetime of that token, so that services only ever handle Access Tokens. identity keeps only a hash of each Excel key: it can be revoked or renewed, but never read back.

*Note of 2026-10-31: Power Query sends the key with Basic, as password, with the e-mail of the User as user name, in the header `Authorization` ([DEC-CH-06](../functional/13-channels.md#dec-ch-06)).*

<a id="tr-pf-08"></a>
### TR-PF-08 · One schema per service

**Status:** Specified · **Realises:** [DEC-PF-05](#dec-pf-05), [DEC-DH-55](../../overview/data-hub.md#dec-dh-55)

Each service that stores data owns exactly one schema in the shared Cloud SQL Postgres instance, and connects with its own database role that has rights on that schema only. The data of another service is reached through the API of that service.

<a id="tr-pf-09"></a>
### TR-PF-09 · Migrations per service

**Status:** Implemented · **Realises:** [DEC-DH-59](../../overview/data-hub.md#dec-dh-59)

Each service keeps its database migrations in its own folder, `services/<name>/src/migrations`. They run as a separate step at deploy, before the new revision of the service gets traffic: a Cloud Run job per service, `datahub-<name>-migrate`, with the new image of the service, which Terraform runs and waits for before it changes the service. A failed migration stops the deploy, and the running revision keeps serving. Running them again is safe: migrations that already ran are skipped, and two runs at once wait for each other.

<a id="tr-pf-10"></a>
### TR-PF-10 · API contracts from zod schemas

**Status:** Specified · **Realises:** [DEC-PF-07](#dec-pf-07), [DEC-PF-03](#dec-pf-03)

The request and response schemas of every service are defined with zod in `packages/contracts`. The OpenAPI document of each service is generated from them, and the web and mcp applications use the generated types.

<a id="tr-pf-11"></a>
### TR-PF-11 · Own service account per service

**Status:** Specified · **Realises:** [DEC-PF-08](#dec-pf-08), [DEC-DH-08](../../overview/data-hub.md#dec-dh-08), [DEC-DH-49](../../overview/data-hub.md#dec-dh-49), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

| Service | Permissions |
| --- | --- |
| identity | Groups Reader and Data Hub user reader admin roles in Workspace ([OP-UM-03](../functional/02-user-management.md#op-um-03), [TR-PF-26](#tr-pf-26)); Cloud SQL client; signing with its key in Cloud KMS ([TR-PF-24](#tr-pf-24)) |
| catalogue | Cloud SQL client |
| registry | Cloud SQL client; write access to the artifact bucket; the dbt Cloud token and the webhook secret from Secret Manager; starting its ingest job ([TR-AR-01](01-artifact-registry.md#tr-ar-01)), which runs as the same service account |
| query | BigQuery Data Viewer on the project of Data Hub, where the tables of its dbt projects are ([DEC-SR-32](../functional/04-stacks-and-resources.md#dec-sr-32)), and BigQuery Job User; Cloud SQL client, for its queries and the Query Log ([DEC-PF-29](#dec-pf-29)) |
| semgraph | None: no data and no secrets, as it is open to everyone ([DEC-PF-24](#dec-pf-24)) |
| web, mcp | None beyond calling the services; web keeps the Refresh Tokens of its Users in their cookies, not in a store of its own |
| `datahub-scheduler`, not a service | None: Cloud Scheduler calls query with its Google ID token once a day to check every Lens, and query checks the token itself ([TR-LE-06](09-lenses.md#tr-le-06)) |
| `datahub-migrator`, not a service | Cloud SQL client and login, as a member of `cloudsqlsuperuser`; only the migration jobs run as it ([TR-PF-22](#tr-pf-22)) |
| The Data Team, not a service | Cloud SQL Studio User, as its Role Group `datahub-datateam@`; read-only on the tables of registry, catalogue and query ([TR-PF-28](#tr-pf-28)) |

<a id="tr-pf-12"></a>
### TR-PF-12 · Shared components for Lenses and Reports

**Status:** Specified · **Realises:** [DEC-DH-15](../../overview/data-hub.md#dec-dh-15), [DEC-PF-06](#dec-pf-06)

The React components that render Lenses and Reports live in `packages/ui`, and are used both by the web app and by the MCP App in mcp.

*Note of 2026-10-25: the steps of a Learning Card are designed to be shared the same way ([DEC-LR-08](../functional/16-learning.md#dec-lr-08)); not yet specified.*

*Note of 2026-10-28: the shared components are Svelte ([DEC-PF-28](#dec-pf-28)).*

<a id="tr-pf-13"></a>
### TR-PF-13 · Infrastructure as code

**Status:** Implemented · **Realises:** [DEC-PF-09](#dec-pf-09), [DEC-PF-15](#dec-pf-15), [EC-SR-04](../functional/04-stacks-and-resources.md#ec-sr-04)

All GCP resources of Data Hub (Cloud Run services, Cloud SQL, the artifact bucket, Secret Manager, service accounts and their roles, Cloud Scheduler) are defined in Terraform in `infra/`, per environment: uat and prod. Only what Terraform needs in order to run is created by hand, once ([GCP setup](../../architecture/gcp-setup.md)).

<a id="tr-pf-14"></a>
### TR-PF-14 · Public ingress, protected by the token checks

**Status:** Specified · **Realises:** [DEC-PF-10](#dec-pf-10), [NFR-SEC-01](../non-functional/security.md#nfr-sec-01)

Every service and application runs on Cloud Run with public ingress. Every endpoint requires a valid Access Token ([TR-PF-03](#tr-pf-03)), except the endpoints that start a login. Endpoints for work that no User started accept only the service accounts of Data Hub ([TR-PF-05](#tr-pf-05)). semgraph is the one exception: it is open without Access Token, behind a rate limit ([DEC-PF-24](#dec-pf-24), [TR-PF-30](#tr-pf-30)).

<a id="tr-pf-15"></a>
### TR-PF-15 · One image per service, from one Dockerfile

**Status:** Implemented · **Realises:** [DEC-PF-01](#dec-pf-01), [DEC-PF-11](#dec-pf-11)

One Dockerfile builds the image of every service, chosen with the build argument `SERVICE`. It builds the workspace, then copies only that service and its production dependencies onto `node:24-slim`, and runs as a non-root user. The image starts the entry point the package names in `main`: `dist/main.js`, or for semgraph its TypeScript ([DEC-PF-25](#dec-pf-25)). Every image is tagged with the git tree hash of its code (`tree-<hash>`) and with the commit SHA. See [Build and deploy](../../architecture/build-and-deploy.md).

<a id="tr-pf-16"></a>
### TR-PF-16 · Images are built by GitHub Actions, without stored keys

**Status:** Implemented · **Realises:** [DEC-PF-11](#dec-pf-11), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

GitHub Actions builds the image of every service on every pull request, and pushes them to Artifact Registry on every push to `main`. It authenticates to GCP with Workload Identity Federation, as a service account that can only push images; no service account key is stored.

<a id="tr-pf-17"></a>
### TR-PF-17 · Build once, deploy many

**Status:** Proposed · **Realises:** [DEC-PF-11](#dec-pf-11)

An image is built once, when a change lands on `uat`, and is tagged with the git tree hash of its code. uat runs it. When `uat` is merged into `main`, the code on `main` has the same tree hash, because `main` only receives merges from `uat` ([DEC-PF-14](#dec-pf-14)); prod therefore runs the very same image, found by that tag. An image is never rebuilt for another environment.

<a id="tr-pf-18"></a>
### TR-PF-18 · One image repository, shared by both environments

**Status:** Proposed · **Realises:** [TR-PF-17](#tr-pf-17), [DEC-PF-13](#dec-pf-13)

The Artifact Registry repository `datahub`, the CI service account and Workload Identity Federation live in the prod project, `immoscoop-dataplatform-398214`, in `europe-west1`. Cloud Run in the uat project may read images from that repository, so that uat and prod run the very same image. The Terraform service account of each environment may read them too, because Cloud Run only deploys an image that the deploying identity may read.

<a id="tr-pf-19"></a>
### TR-PF-19 · Only uat merges into main

**Status:** Implemented · **Realises:** [DEC-PF-14](#dec-pf-14)

A pull request into `main` fails the job "Verify source branch is uat", and therefore the check `ci` ([TR-PF-20](#tr-pf-20)), unless it comes from `uat`. Together with the rules on the branches in GitHub ([OP-PF-12](#op-pf-12)), nothing reaches `main` except through a reviewed merge from `uat`, and nothing reaches `uat` except through a pull request.

<a id="tr-pf-20"></a>
### TR-PF-20 · One required check, whatever the pipeline contains

**Status:** Implemented · **Realises:** [DEC-PF-14](#dec-pf-14), [TR-PF-19](#tr-pf-19)

CI is one workflow that ends in one gate job, `ci`, which passes only when every other job passed. The branch rules in GitHub require only `ci`. The services to build are found from the folders under `services/`, so adding a service or a job changes neither the workflow's list nor the settings in GitHub.

<a id="tr-pf-21"></a>
### TR-PF-21 · Terraform runs in GitHub Actions, per environment

**Status:** Implemented · **Realises:** [DEC-PF-16](#dec-pf-16), [NFR-SEC-04](../non-functional/security.md#nfr-sec-04)

A push to `uat` plans and applies the Terraform in `infra/` to the uat project; a push to `main` does the same for the prod project. The job runs in the GitHub environment of that project, authenticates with Workload Identity Federation as the `datahub-terraform` service account of that project, and keeps its state in that project's state bucket. Workload Identity Federation only lets a run on `uat` act as the uat identity and a run on `main` act as the prod identity.

<a id="tr-pf-22"></a>
### TR-PF-22 · Services log in to Postgres with their Google identity

**Status:** Specified · **Realises:** [TR-PF-08](#tr-pf-08), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

Every service that keeps data logs in to Cloud SQL as its own service account, through IAM database authentication and the Cloud SQL connector. No database password exists for a service, and no network may connect to the database directly. The migrations run as a separate identity, `datahub-migrator`, a member of `cloudsqlsuperuser`: it creates the schema of each service and its tables, and gives the service's own login read and write access to the rows of that schema, nothing more ([TR-PF-09](#tr-pf-09)). A service cannot change its tables, and cannot see the schema of another service ([TR-PF-08](#tr-pf-08)).

<a id="tr-pf-23"></a>
### TR-PF-23 · Secrets are created by Terraform and filled by a person

**Status:** Specified · **Realises:** [DEC-PF-08](#dec-pf-08), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

Terraform creates every secret in Secret Manager and gives exactly one service read access to it; the value is added by a person ([GCP setup](../../architecture/gcp-setup.md), step 8) and never passes through GitHub or the repository. A service reads a secret through the API when it needs it, so a secret without a value does not block a deployment.

<a id="tr-pf-24"></a>
### TR-PF-24 · The signing key of identity

**Status:** Implemented · **Realises:** [DEC-PF-17](#dec-pf-17), [TR-PF-02](#tr-pf-02), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

Terraform creates the key in each environment: key ring `datahub`, key `access-token`, algorithm ES256 (EC P-256 with SHA-256), the only algorithm `@datahub/auth` accepts. Only the service account of identity may sign with it; the Terraform identity manages the key but cannot sign. In prod, Terraform refuses to destroy the key.

identity signs with the newest enabled version of the key, and publishes the public key of every enabled version at its JWKS endpoint. A rotation adds a version; the previous one is disabled a day later, when every token it signed has long expired. Disabling a version at once, on suspicion, makes every token it signed invalid: Users sign in again. The steps are in [Rotating the signing key](../../../infra/README.md#rotating-the-signing-key).

<a id="tr-pf-25"></a>
### TR-PF-25 · Refresh Tokens

**Status:** Implemented · **Realises:** [DEC-PF-18](#dec-pf-18), [TR-PF-06](#tr-pf-06), [NFR-SEC-01](../non-functional/security.md#nfr-sec-01)

identity issues a Refresh Token with every Access Token to the server of the web app and to MCP clients, through its OAuth 2.1 token endpoint. Each Refresh Token works once: a renewal returns a new Access Token and a new Refresh Token. A Refresh Token that is used a second time has been copied, so identity then ends the whole session it belongs to. identity keeps only a hash of each Refresh Token.

| Client | Lifetime of the session |
| --- | --- |
| Server of the web app | 12 hours from the login, not extended by renewals |
| MCP client, such as Claude | 30 days, counted again from every renewal |

Logging out ends the session at once. The Data Team can end all sessions of a User at once.

<a id="tr-pf-26"></a>
### TR-PF-26 · Every renewal checks the User again

**Status:** Implemented · **Realises:** [DEC-PF-18](#dec-pf-18), [FR-UM-06](../functional/02-user-management.md#fr-um-06), [FR-UM-10](../functional/02-user-management.md#fr-um-10), [NFR-SEC-03](../non-functional/security.md#nfr-sec-03)

At every renewal, identity reads the Groups of the User again, as at login, and checks the account through the Admin SDK Directory API. For that, its service account has the custom Workspace admin role "Data Hub user reader", which may only read users. A suspended or removed account, or one outside `thenextimmoscoop.be` ([DEC-UM-06](../functional/02-user-management.md#dec-um-06)), gets no new Access Token, and all its sessions end. A change in Workspace thus reaches Data Hub within the lifetime of one Access Token.

<a id="tr-pf-27"></a>
### TR-PF-27 · The server of the web app

**Status:** Implemented · **Realises:** [DEC-PF-19](#dec-pf-19), [DEC-PF-03](#dec-pf-03)

The Cloud Run service `datahub-web` serves the web app and signs in through identity as an OAuth client, like an MCP client does. It keeps the Refresh Token in a cookie of its own address that JavaScript cannot read, is only sent over HTTPS, and is never sent along from another site (`HttpOnly`, `Secure`, `SameSite=Strict`). It gives the browser only the Access Token, with which the app calls the services itself. It holds no business logic and no data.

<a id="tr-pf-28"></a>
### TR-PF-28 · The Data Team reads the tables in Cloud SQL Studio

**Status:** Implemented · **Realises:** [DEC-PF-21](#dec-pf-21), [TR-PF-22](#tr-pf-22), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

Terraform makes the Role Group of the Data Team, `datahub-datateam@thenextimmoscoop.be`, a database login through IAM group authentication, and gives the group the role Cloud SQL Studio User. Whoever is in the group in Workspace can log in, with their own Google account; whoever leaves it can no longer. The migration jobs of registry, catalogue and query give the group's login `USAGE` on their schema and `SELECT` on all its tables, again at every deploy, so new tables are included. identity's migration job gives it nothing.

To look: Google Cloud console → SQL → the instance `datahub-<environment>` → Cloud SQL Studio, database `datahub`, with IAM database authentication.

<a id="tr-pf-29"></a>
### TR-PF-29 · The look and the page of the web app

**Status:** Withdrawn · **Realises:** [DEC-PF-22](#dec-pf-22), [DEC-PF-06](#dec-pf-06)

The Mantine theme lives in `packages/ui`, so the MCP App can use it too. Each colour of the brandbook is a scale of ten shades: magenta runs from light pink through the brand magenta into bordeaux, so hover and pressed states stay within the brand, and the greys run from light grey to the text grey. Titles are in bordeaux, text in the text grey, and both in Poppins. Links take a darker magenta: the brand magenta has a contrast of 4.4:1 on white, just under the 4.5:1 that running text needs. Buttons keep the brand magenta.

Vite builds the page into `apps/web/dist/client`, with Poppins included: the page loads nothing from another address, not even Google Fonts. The server of the web app ([TR-PF-27](#tr-pf-27)) serves it under a Content-Security-Policy that allows scripts, styles and fonts only from its own address. Mantine adds `<style>` elements; they need a nonce that is new for every page.

*Note of 2026-10-28: built with Mantine today; rebuilt in Svelte with the look of the design ([DEC-PF-28](#dec-pf-28)).* *Note of 2026-10-28: withdrawn; the web app is rebuilt in Svelte, with the look of the design ([TR-PF-33](#tr-pf-33)).*

<a id="tr-pf-30"></a>
### TR-PF-30 · semgraph is open, behind a rate limit

**Status:** Specified · **Realises:** [DEC-PF-24](#dec-pf-24), [DEC-PF-23](#dec-pf-23)

A global external Application Load Balancer stands in front of the Cloud Run service of semgraph, with a Cloud Armor policy. Its rule counts the requests per client address and answers 429 above the limit. The limit starts generous, at 300 requests per minute per address, and is adjusted once real use is known: one page of charts, and certainly the gallery, asks for many charts at once, and many people can share one address, such as everyone in the office, or every Claude conversation from the servers of Anthropic.

The Cloud Run service accepts traffic only through the load balancer, so its own `run.app` address cannot be used to get around the limit, and a maximum number of instances caps the cost. The load balancer needs a domain name with a Google-managed certificate ([OP-PF-08](#op-pf-08)). The service account of semgraph gets no permission on any data and no secret ([DEC-PF-24](#dec-pf-24)). All of it is Terraform in `infra/`, like the rest ([TR-PF-13](#tr-pf-13)).

<a id="tr-pf-31"></a>
### TR-PF-31 · Pages of every site may call semgraph

**Status:** Implemented · **Realises:** [DEC-PF-24](#dec-pf-24), [DEC-PF-23](#dec-pf-23)

semgraph answers every request with `Access-Control-Allow-Origin: *`, and the preflight of the browser for a `POST` with JSON, so a page on any site can call it from the browser: the web app of Data Hub, and a dashboard or document elsewhere. It allows no credentials, as there are none. The page of the web app may load pictures and call only semgraph besides its own server, identity and registry ([TR-PF-33](#tr-pf-33)).

<a id="tr-pf-32"></a>
### TR-PF-32 · The settings of a User live in identity

**Status:** Implemented · **Realises:** [DEC-UX-96](../../design/principles.md#dec-ux-96), [NFR-LOC-06](../non-functional/localisation.md#nfr-loc-06)

identity keeps the settings of every User in its schema, as keys and values, and gives a User only their own: `GET /me/settings` reads them all, `PUT /me/settings/{key}` sets one and `DELETE /me/settings/{key}` forgets one, so that its default applies again. The keys and their values are fixed in `@datahub/contracts` (`settings.ts`): the language, the theme, the background by day and by night, whether the panel is open, and the version of every intro dismissed; any other key or value is refused. A setting goes with its User.

<a id="tr-pf-33"></a>
### TR-PF-33 · The web app in Svelte, with the look of the design

**Status:** Implemented · **Realises:** [DEC-PF-28](#dec-pf-28), [DEC-PF-19](#dec-pf-19), [DEC-UX-104](../../design/principles.md#dec-ux-104)

The page of the web app is Svelte 5, built by Vite into `apps/web/dist/client`; the server of the web app ([TR-PF-27](#tr-pf-27)) serves it for every address that is a page of Data Hub, and the page shows what the address asks for. The look lives in `packages/ui`, in the layers of [components.md](../../design/components.md), so the MCP App can use it later: the foundations, the primitives, the containers and the components. A behaviour lives in its component, never in a screen.

Every value of the look has one place: `docs/design/tokens.css`. The stylesheet of `packages/ui` imports that file as it is, as the prototypes do, and the components only refer to its tokens; where code needs a value, such as the narrowest window, it reads the token from the page. A test fails on any colour, font, radius or duration written in a component instead of a token, and on a token that `tokens.css` does not have. The pictures of the backgrounds and of the sign-in are those of `docs/design/backgrounds`, taken along by the build.

The page loads nothing from another address: Poppins and the Phosphor icons are part of the build, and the grain over a flowing background is a small picture in its stylesheet. The Content-Security-Policy allows scripts, styles and fonts only from its own address; Svelte puts every style in the stylesheet, so no style needs a nonce. *Note of 2026-10-29, on building part 5: the editor of Query, CodeMirror, adds `<style>` elements of its own; the server gives every page a nonce that is new each time, the policy allows styles with it, and the editor puts it on its styles.* *Note of 2026-10-30: the Lineage draws with Svelte Flow, whose stylesheet is part of the build and which adds no `<style>` of its own ([DEC-UX-152](../../design/principles.md#dec-ux-152)).* Sentences come from translation files, one per language ([NFR-LOC-02](../non-functional/localisation.md#nfr-loc-02)), and the settings of the User from identity ([TR-PF-32](#tr-pf-32)).

## Open points

- [x] <a id="op-pf-01"></a>**OP-PF-01** · Decide how the processing of an Artifact Set runs: inside the registry service through Cloud Tasks, or as a Cloud Run job built from the same code ([DEC-DH-23](../../overview/data-hub.md#dec-dh-23)). *Decided on 2026-10-18: a Cloud Run job ([DEC-PF-20](#dec-pf-20)).*
- [x] <a id="op-pf-02"></a>**OP-PF-02** · Decide how the web app renews its Access Token (a refresh token in an http-only cookie, or a new login through Google), and how often identity reads the Groups again on renewal ([FR-UM-06](../functional/02-user-management.md#fr-um-06)). *Decided on 2026-10-18: a Refresh Token, for the web app through its own server and for MCP clients alike; Groups and account are checked at every renewal ([DEC-PF-18](#dec-pf-18), [TR-PF-25](#tr-pf-25), [TR-PF-26](#tr-pf-26)).*
- [x] <a id="op-pf-03"></a>**OP-PF-03** · Decide where the signing key of identity lives (Cloud KMS or Secret Manager) and how it is rotated. *Decided on 2026-10-17: Cloud KMS, rotated once a year and immediately on any suspicion ([DEC-PF-17](#dec-pf-17), [TR-PF-24](#tr-pf-24)).*
- [x] <a id="op-pf-04"></a>**OP-PF-04** · Decide the ingress of the services: public endpoints protected by their own token checks, or internal ingress under internal-immoscoop.be ([OP-DH-35](../../overview/open-themes.md#op-dh-35)), and in that case how Claude reaches mcp. *Decided on 2026-10-17: public ([DEC-PF-10](#dec-pf-10)).*
- [x] <a id="op-pf-05"></a>**OP-PF-05** · Decide how registry hands its Changes to catalogue ([FR-AR-12](../functional/01-artifact-registry.md#fr-ar-12)): a direct call per Artifact Set, or a Pub/Sub topic. *Decided on 2026-10-19: a direct call per Artifact Set, with the whole state of the dbt project ([DEC-PF-26](#dec-pf-26)).*
- [x] <a id="op-pf-06"></a>**OP-PF-06** · Decide where the Message Centre lives: in catalogue for v1, or in a separate notifications service once [Log and notifications](../functional/07-log-and-notifications.md) is specified. *Decided on 2026-10-28, by Max: the Message Centre is part of the navigation of the web app ([DEC-UX-29](../../design/principles.md#dec-ux-29)); its Messages stay in the schema of catalogue, as the [architecture](../../architecture/README.md) has them, and no separate notifications service is needed for v1.*
- [x] <a id="op-pf-07"></a>**OP-PF-07** · Decide how the web app is served: static files from a small Cloud Run service, or from Cloud Storage behind a load balancer. *Decided on 2026-10-18: a small Cloud Run service, which also keeps the Refresh Token ([DEC-PF-19](#dec-pf-19), [TR-PF-27](#tr-pf-27)).*
- [x] <a id="op-pf-08"></a>**OP-PF-08** · Choose the public domain names under which Data Hub and its services are reachable, per environment. *Decided on 2026-10-28, by Max: the domain names are chosen as part of the build.*
- [x] <a id="op-pf-09"></a>**OP-PF-09** · Choose the GCP project or projects and the region of Data Hub, per environment, including where the Artifact Registry repository lives. [DEC-DH-48](../../overview/data-hub.md#dec-dh-48) rules out a separate project for Data Hub; the Stacks are in `immoscoop-dataplatform-398214`. *Decided on 2026-10-17: prod in `immoscoop-dataplatform-398214`, uat in `immoscoop-dataplatform`, both in `europe-west1` ([DEC-PF-13](#dec-pf-13)); where the image repository lives is proposed in [TR-PF-18](#tr-pf-18).*
- [ ] <a id="op-pf-10"></a>**OP-PF-10** · Run the one-time bootstrap in both projects and set up the GitHub environments and variables, as described in [GCP setup](../../architecture/gcp-setup.md).
- [x] <a id="op-pf-11"></a>**OP-PF-11** · Decide where this repository lives for good: under the personal account `maximethenextimmoscoopbe`, or in the organisation `immoscoop-be` next to the data repository. The trust condition of Workload Identity Federation names the repository, so this is best settled before [OP-PF-10](#op-pf-10). *Decided on 2026-10-17: `immoscoop-be` ([DEC-PF-12](#dec-pf-12)).*
- [ ] <a id="op-pf-12"></a>**OP-PF-12** · Set up the branch rules in GitHub: rulesets for `main` and `uat`, the required checks, and `uat` as the default branch ([Build and deploy](../../architecture/build-and-deploy.md#rules-in-github)).
- [ ] <a id="op-pf-13"></a>**OP-PF-13** · Decide whether pull requests show a Terraform plan before merging. That needs a separate, read-only identity that pull requests may use, because the Terraform identities only trust `uat` and `main`.
- [x] <a id="op-pf-14"></a>**OP-PF-14** · Decide who gives query its read access on the Stacks: Terraform, which then needs rights on the Stacks dataset, or dbt, which creates that dataset. *Decided on 2026-10-26, by Max: Terraform grants the service account of Data Hub read access to every table in the GCP projects of the dbt projects it follows ([DEC-SR-32](../functional/04-stacks-and-resources.md#dec-sr-32)).*
- [x] <a id="op-pf-15"></a>**OP-PF-15** · Decide how semgraph moves into this repository ([DEC-PF-23](#dec-pf-23)): with its git history or as a copy of a named commit; and how it joins the workspace. Node runs its TypeScript directly, without a build, and its tests run with `node --test` against SVG files that hold the expected drawing; Data Hub compiles with `tsc -b` and tests with Vitest. *Decided on 2026-10-18: with its history, running its TypeScript directly, tested with Vitest ([DEC-PF-25](#dec-pf-25)).*
- [ ] <a id="op-pf-16"></a>**OP-PF-16** · Decide how the requirements of semgraph, REQ-000 to REQ-107 in Dutch with a register of their own, become part of `docs/requirements`: translated into English, under which domain code, keeping REQ-xxx as an alias the way the Confluence IDs are kept. Decide too where new requirements of the chart language are collected from then on; today that is Confluence, and the most recent decision wins. *Note of 2026-10-18: semgraph has moved in without its register; until it is translated, the register stays in Dutch in the former repository `immoscoop-be/immoscoop-ptditt-semgraph`, and a requirement implemented in the meantime is described in its pull request.*
- [ ] <a id="op-pf-17"></a>**OP-PF-17** · Decide how semgraph knows who calls it within Data Hub: Access Tokens of identity, instead of the login of the internal-tools platform for its API and the Cognito tokens of its MCP server. Decide too whether its MCP tools and its MCP App stay on its own `/mcp`, or move into mcp ([DEC-PF-03](#dec-pf-03)). *Partly decided on 2026-10-18: no login at all, everyone may call it ([DEC-PF-24](#dec-pf-24)); where its MCP tools and MCP App live is still open.*
- [ ] <a id="op-pf-18"></a>**OP-PF-18** · Plan the switch from AWS: the current users of the Chart Server (dashboards, documents, Claude) move to its address in Data Hub, its dev environment becomes uat and its prod becomes prod, and after that the deploy through the internal-tools platform and the old repository stop. Users find the address on [Chart server - Environments and documentation](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361412109) (Confluence, Dutch), which then changes. *Note of 2026-10-18: the code has moved in ([DEC-PF-25](#dec-pf-25)) and runs on Cloud Run as `datahub-semgraph`; changes to semgraph are made here from now on. Until the switch, the former repository keeps deploying the version on the internal-tools platform.*
- [x] <a id="op-pf-19"></a>**OP-PF-19** · Choose how Data Hub sends e-mail ([DEC-LN-02](../functional/07-log-and-notifications.md#dec-ln-02)): GCP sends none itself. The options: the SMTP relay of Google Workspace, from an address of Immoscoop; the Gmail API with a service account; or a sending service, such as the one Immoscoop already uses elsewhere. Proposal: the SMTP relay of Workspace, as Data Hub signs Users in with Google already, from an address such as datahub@ with replies going nowhere. *Raised on 2026-10-28, in the review of Max.* *Decided on 2026-10-29, by Max: the SMTP relay of Workspace, which admits Data Hub by its fixed outgoing IP address ([DEC-PF-31](#dec-pf-31)).*
- [x] <a id="op-pf-20"></a>**OP-PF-20** · Decide how the services of Data Hub are monitored: today each logs to Cloud Logging and has a health check, but nothing watches them. Proposal: an uptime check in Cloud Monitoring on the health check of every service and the web app, and an alert to the Data Team by e-mail when one fails or answers with errors for five minutes; all in Terraform. *Raised on 2026-10-28, from [OP-DH-35](../../overview/open-themes.md#op-dh-35).* *Decided on 2026-10-28, by Max: as proposed ([DEC-PF-27](#dec-pf-27)).*

## Builds on

- [Architecture](../../architecture/README.md)
- [Data Hub overview](../../overview/data-hub.md): infrastructure and storage decisions
- [User management](../functional/02-user-management.md)
- [Security](../non-functional/security.md)
