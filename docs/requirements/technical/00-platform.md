# Platform: technical requirements

| | |
| --- | --- |
| Code | `PF`: technical choices that are not tied to one functional domain |
| Status | Specified where it restates a confirmed decision; Proposed where it adds detail |
| Source of truth | This file; the architecture that follows from it is described in [`docs/architecture/`](../../architecture/README.md) |

**In one sentence:** Data Hub is a set of TypeScript services on Cloud Run, each validating the User itself, behind several interfaces that all use the same APIs.

## Decisions

Decided on 2026-10-17, on the proposal for the architecture and technology.

- <a id="dec-pf-01"></a>**DEC-PF-01** · Data Hub is split into services, each with one responsibility and deployed separately. In v1 there are four backend services, identity, catalogue, registry and query, and two client applications, web and mcp. Lenses, Reports and notifications become services of their own once their domains are specified.
- <a id="dec-pf-02"></a>**DEC-PF-02** · Every service validates the User itself, on every request. A central identity service issues short-lived signed Access Tokens; every service verifies them locally against the public keys of identity, and decides on its own what the User may do.
- <a id="dec-pf-03"></a>**DEC-PF-03** · Every interface is a client of the same service APIs and holds no business logic. In v1: the web app, Claude through mcp, and Excel through Power Query. Other interfaces, such as HTML reports, plug in the same way.
- <a id="dec-pf-04"></a>**DEC-PF-04** · All code lives in one monorepo, this repository, with pnpm workspaces: `services/*`, `apps/*` and `packages/*`.
- <a id="dec-pf-05"></a>**DEC-PF-05** · There is one Cloud SQL Postgres instance, with one schema per service. A service only reads and writes its own schema; the data of another service is reached through that service's API.
- <a id="dec-pf-06"></a>**DEC-PF-06** · The web app is built in React. The components that render Lenses and Reports are shared between the web app and the MCP App, so that only one version exists ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15)).
- <a id="dec-pf-07"></a>**DEC-PF-07** · Services expose REST APIs with JSON, described in OpenAPI that is generated from zod schemas. Not tRPC: Excel and MCP clients need plain HTTP.
- <a id="dec-pf-08"></a>**DEC-PF-08** · Every service runs under its own GCP service account, with only the permissions its responsibility needs.
- <a id="dec-pf-09"></a>**DEC-PF-09** · Tooling: Node.js 24 LTS and TypeScript in strict mode; Fastify for HTTP; Kysely for Postgres; zod for schemas; jose for tokens; the official MCP TypeScript SDK; Vitest for tests; Terraform for infrastructure. Node.js moves to the next LTS release once it is available. These build on [DEC-DH-53](../../overview/data-hub.md#dec-dh-53) to [DEC-DH-55](../../overview/data-hub.md#dec-dh-55).
- <a id="dec-pf-10"></a>**DEC-PF-10** · All services and applications of Data Hub are publicly reachable. The protection comes from the login and the token check in every service, not from the network, so that the browser, Excel and Claude can reach Data Hub from anywhere. Claude in particular calls MCP servers from Anthropic's servers on the internet, so an internal-only mcp would be unreachable for it. This answers [OP-PF-04](#op-pf-04).
- <a id="dec-pf-11"></a>**DEC-PF-11** · The container images of the services are stored in Artifact Registry in GCP, not on Docker Hub: Cloud Run pulls from it with its own identity, without extra credentials, the images stay private, and they live in the same region as the services. The note in the [Artifact registry](../functional/01-artifact-registry.md) domain already assumed this.
- <a id="dec-pf-12"></a>**DEC-PF-12** · The repository lives in the organisation `immoscoop-be`, next to the data repository, as `immoscoop-be/immoscoop-dataplatform-datahub`. It was transferred there from a personal account on 2026-10-17, with its full history; the old address redirects. This answers [OP-PF-11](#op-pf-11).

## Requirements

<a id="tr-pf-01"></a>
### TR-PF-01 · Services and runtime

**Status:** Specified · **Realises:** [DEC-PF-01](#dec-pf-01), [DEC-DH-53](../../overview/data-hub.md#dec-dh-53), [DEC-DH-54](../../overview/data-hub.md#dec-dh-54)

Every backend service and client application is a TypeScript Node.js application in its own container, deployed as its own Cloud Run service. In v1: the services identity, catalogue, registry and query, and the applications web and mcp. See the [service map](../../architecture/README.md#services).

<a id="tr-pf-02"></a>
### TR-PF-02 · identity issues short-lived Access Tokens

**Status:** Specified · **Realises:** [DEC-PF-02](#dec-pf-02), [FR-UM-03](../functional/02-user-management.md#fr-um-03), [FR-UM-06](../functional/02-user-management.md#fr-um-06), [FR-UM-08](../functional/02-user-management.md#fr-um-08)

After a successful login, identity issues an Access Token: a JWT signed with an asymmetric key, valid for 15 minutes. It carries the fixed Google ID of the User, email, name, the Groups of the User (by their fixed Google ID) and the User's roles. identity publishes its public keys at a JWKS endpoint.

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

**Status:** Proposed · **Realises:** [NFR-SEC-01](../non-functional/security.md#nfr-sec-01), [FR-SR-11](../functional/04-stacks-and-resources.md#fr-sr-11)

A service that calls another service on behalf of a User forwards the Access Token of that User, and the receiving service validates it again. Work that no User started, such as processing Artifacts or synchronising Groups, uses the Google service-account identity of the calling service. Endpoints for such calls accept only the service accounts of Data Hub, and the Log records the actor as Data Hub itself.

<a id="tr-pf-06"></a>
### TR-PF-06 · Claude signs in through identity

**Status:** Proposed · **Realises:** [DEC-UM-02](../functional/02-user-management.md#dec-um-02), [DEC-PF-03](#dec-pf-03)

identity acts as the OAuth 2.1 authorisation server for MCP clients, following the MCP authorisation specification, and delegates the login itself to Google. mcp validates the resulting Access Tokens like every other service.

<a id="tr-pf-07"></a>
### TR-PF-07 · Excel uses the Library Card

**Status:** Proposed · **Realises:** [DEC-DH-47](../../overview/data-hub.md#dec-dh-47), [DEC-PF-02](#dec-pf-02)

Power Query sends the Library Card with every request. The shared package `@datahub/auth` exchanges it at identity for an Access Token, cached for the lifetime of that token, so that services only ever handle Access Tokens. identity keeps only a hash of each Library Card: it can be revoked or renewed, but never read back.

<a id="tr-pf-08"></a>
### TR-PF-08 · One schema per service

**Status:** Specified · **Realises:** [DEC-PF-05](#dec-pf-05), [DEC-DH-55](../../overview/data-hub.md#dec-dh-55)

Each service that stores data owns exactly one schema in the shared Cloud SQL Postgres instance, and connects with its own database role that has rights on that schema only. The data of another service is reached through the API of that service.

<a id="tr-pf-09"></a>
### TR-PF-09 · Migrations per service

**Status:** Specified · **Realises:** [DEC-DH-59](../../overview/data-hub.md#dec-dh-59)

Each service keeps its database migrations in its own folder. They run as a separate step at deploy, before the new revision of the service gets traffic.

<a id="tr-pf-10"></a>
### TR-PF-10 · API contracts from zod schemas

**Status:** Specified · **Realises:** [DEC-PF-07](#dec-pf-07), [DEC-PF-03](#dec-pf-03)

The request and response schemas of every service are defined with zod in `packages/contracts`. The OpenAPI document of each service is generated from them, and the web and mcp applications use the generated types.

<a id="tr-pf-11"></a>
### TR-PF-11 · Own service account per service

**Status:** Specified · **Realises:** [DEC-PF-08](#dec-pf-08), [DEC-DH-08](../../overview/data-hub.md#dec-dh-08), [DEC-DH-49](../../overview/data-hub.md#dec-dh-49), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

| Service | Permissions |
| --- | --- |
| identity | Groups Reader admin role in Workspace ([OP-UM-03](../functional/02-user-management.md#op-um-03)); Cloud SQL client |
| catalogue | Cloud SQL client |
| registry | Cloud SQL client; write access to the artifact bucket; the dbt Cloud token from Secret Manager |
| query | Read access to the Stacks and permission to run BigQuery jobs; no database access, because query stores nothing in v1 |
| web, mcp | None beyond calling the services |

<a id="tr-pf-12"></a>
### TR-PF-12 · Shared components for Lenses and Reports

**Status:** Specified · **Realises:** [DEC-DH-15](../../overview/data-hub.md#dec-dh-15), [DEC-PF-06](#dec-pf-06)

The React components that render Lenses and Reports live in `packages/ui`, and are used both by the web app and by the MCP App in mcp.

<a id="tr-pf-13"></a>
### TR-PF-13 · Infrastructure as code

**Status:** Proposed · **Realises:** [DEC-PF-09](#dec-pf-09), [EC-SR-04](../functional/04-stacks-and-resources.md#ec-sr-04)

All GCP resources of Data Hub (Cloud Run services, Cloud SQL, the artifact bucket, Secret Manager, service accounts and their roles, Cloud Scheduler) are defined in Terraform in `infra/`, per environment: uat and prod.

<a id="tr-pf-14"></a>
### TR-PF-14 · Public ingress, protected by the token checks

**Status:** Specified · **Realises:** [DEC-PF-10](#dec-pf-10), [NFR-SEC-01](../non-functional/security.md#nfr-sec-01)

Every service and application runs on Cloud Run with public ingress. Every endpoint requires a valid Access Token ([TR-PF-03](#tr-pf-03)), except the endpoints that start a login. Endpoints for work that no User started accept only the service accounts of Data Hub ([TR-PF-05](#tr-pf-05)).

<a id="tr-pf-15"></a>
### TR-PF-15 · One image per service, from one Dockerfile

**Status:** Implemented · **Realises:** [DEC-PF-01](#dec-pf-01), [DEC-PF-11](#dec-pf-11)

One Dockerfile builds the image of every service, chosen with the build argument `SERVICE`. It builds the workspace, then copies only that service and its production dependencies onto `node:24-slim`, and runs as a non-root user. Every image is tagged with the full git commit SHA. See [Build and deploy](../../architecture/build-and-deploy.md).

<a id="tr-pf-16"></a>
### TR-PF-16 · Images are built by GitHub Actions, without stored keys

**Status:** Implemented · **Realises:** [DEC-PF-11](#dec-pf-11), [NFR-SEC-02](../non-functional/security.md#nfr-sec-02)

GitHub Actions builds the image of every service on every pull request, and pushes them to Artifact Registry on every push to `main`. It authenticates to GCP with Workload Identity Federation, as a service account that can only push images; no service account key is stored.

<a id="tr-pf-17"></a>
### TR-PF-17 · Build once, deploy many

**Status:** Proposed · **Realises:** [DEC-PF-11](#dec-pf-11)

An image is built once, on `main`. uat runs that image by its commit tag, and prod runs the very same image after approval. An image is never rebuilt for another environment.

## Open points

- [ ] <a id="op-pf-01"></a>**OP-PF-01** · Decide how the processing of an Artifact Set runs: inside the registry service through Cloud Tasks, or as a Cloud Run job built from the same code ([DEC-DH-23](../../overview/data-hub.md#dec-dh-23)).
- [ ] <a id="op-pf-02"></a>**OP-PF-02** · Decide how the web app renews its Access Token (a refresh token in an http-only cookie, or a new login through Google), and how often identity reads the Groups again on renewal ([FR-UM-06](../functional/02-user-management.md#fr-um-06)).
- [ ] <a id="op-pf-03"></a>**OP-PF-03** · Decide where the signing key of identity lives (Cloud KMS or Secret Manager) and how it is rotated.
- [x] <a id="op-pf-04"></a>**OP-PF-04** · Decide the ingress of the services: public endpoints protected by their own token checks, or internal ingress under internal-immoscoop.be ([OP-DH-35](../../overview/open-themes.md#op-dh-35)), and in that case how Claude reaches mcp. *Decided on 2026-10-17: public ([DEC-PF-10](#dec-pf-10)).*
- [ ] <a id="op-pf-05"></a>**OP-PF-05** · Decide how registry hands its Changes to catalogue ([FR-AR-12](../functional/01-artifact-registry.md#fr-ar-12)): a direct call per Artifact Set, or a Pub/Sub topic.
- [ ] <a id="op-pf-06"></a>**OP-PF-06** · Decide where the Message Centre lives: in catalogue for v1, or in a separate notifications service once [Log and notifications](../functional/07-log-and-notifications.md) is specified.
- [ ] <a id="op-pf-07"></a>**OP-PF-07** · Decide how the web app is served: static files from a small Cloud Run service, or from Cloud Storage behind a load balancer.
- [ ] <a id="op-pf-08"></a>**OP-PF-08** · Choose the public domain names under which Data Hub and its services are reachable, per environment.
- [ ] <a id="op-pf-09"></a>**OP-PF-09** · Choose the GCP project or projects and the region of Data Hub, per environment, including where the Artifact Registry repository lives. [DEC-DH-48](../../overview/data-hub.md#dec-dh-48) rules out a separate project for Data Hub; the Stacks are in `immoscoop-dataplatform-398214`.
- [ ] <a id="op-pf-10"></a>**OP-PF-10** · Do the one-time GCP setup for the image pipeline: the Artifact Registry repository, the CI service account and Workload Identity Federation, and the GitHub repository variables ([Build and deploy](../../architecture/build-and-deploy.md#one-time-setup-in-gcp)).
- [x] <a id="op-pf-11"></a>**OP-PF-11** · Decide where this repository lives for good: under the personal account `maximethenextimmoscoopbe`, or in the organisation `immoscoop-be` next to the data repository. The trust condition of Workload Identity Federation names the repository, so this is best settled before [OP-PF-10](#op-pf-10). *Decided on 2026-10-17: `immoscoop-be` ([DEC-PF-12](#dec-pf-12)).*

## Builds on

- [Architecture](../../architecture/README.md)
- [Data Hub overview](../../overview/data-hub.md): infrastructure and storage decisions
- [User management](../functional/02-user-management.md)
- [Security](../non-functional/security.md)
