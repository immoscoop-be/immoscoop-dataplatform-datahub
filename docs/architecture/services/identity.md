# identity

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/identity` |
| Schema | `identity` |
| Domains | [User management](../../requirements/functional/02-user-management.md), [Permissions and library cards](../../requirements/functional/12-permissions-and-library-cards.md) |

**In one sentence:** identity knows who you are: it signs you in with Google, knows your Groups from Workspace, issues the Access Tokens every other service validates, and manages Library Cards.

## Responsibilities

- Sign in with Google through OpenID Connect, only for the own Workspace domain: [FR-UM-01](../../requirements/functional/02-user-management.md#fr-um-01), [FR-UM-02](../../requirements/functional/02-user-management.md#fr-um-02), [FR-UM-03](../../requirements/functional/02-user-management.md#fr-um-03)
- Groups from the Cloud Identity Groups API, nested groups included, and no other Google groups: [FR-UM-04](../../requirements/functional/02-user-management.md#fr-um-04) to [FR-UM-06](../../requirements/functional/02-user-management.md#fr-um-06), [FR-UM-08](../../requirements/functional/02-user-management.md#fr-um-08)
- Periodic Synchronisation of the members of all Groups: [FR-UM-07](../../requirements/functional/02-user-management.md#fr-um-07), [FR-UM-10](../../requirements/functional/02-user-management.md#fr-um-10)
- Issuing Access Tokens and publishing the public keys: [TR-PF-02](../../requirements/technical/00-platform.md#tr-pf-02)
- OAuth authorisation server for Claude: [TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06)
- Library Cards for Excel: issuing, revoking, renewing and exchanging them for Access Tokens: [DEC-DH-47](../../overview/data-hub.md#dec-dh-47), [TR-PF-07](../../requirements/technical/00-platform.md#tr-pf-07)

## API

First sketch; the exact contracts follow in the technical requirements of the domains.

| Endpoint | Purpose |
| --- | --- |
| `GET /login`, `GET /callback` | Sign in with Google for the web app |
| `POST /token/refresh` | Renew an Access Token ([OP-PF-02](../../requirements/technical/00-platform.md#op-pf-02)) |
| `GET /.well-known/jwks.json` | Public keys to validate Access Tokens |
| OAuth 2.1 metadata, `/authorize`, `/token`, client registration | Sign-in for MCP clients such as Claude |
| `GET /me` | The current User, Groups and roles |
| `POST /library-cards`, `DELETE /library-cards/{id}` | Issue and revoke a Library Card |
| `POST /exchange` | Exchange a Library Card for an Access Token; used by `@datahub/auth` |
| `POST /internal/sync-groups` | Synchronise the Groups; called by Cloud Scheduler with the service identity |

## Data

Users (by fixed Google ID), Groups (by fixed Google ID) and memberships, Library Cards (hashes only), OAuth clients and grants.

## Talks to

Google Sign-In (OpenID Connect) and the Cloud Identity Groups API.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): the Groups Reader admin role in Workspace, and Cloud SQL client.
