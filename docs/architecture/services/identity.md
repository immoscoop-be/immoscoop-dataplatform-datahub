# identity

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/identity` |
| Schema | `identity` |
| Domains | [User management](../../requirements/functional/02-user-management.md), [Permissions and library cards](../../requirements/functional/12-permissions-and-library-cards.md) |

**In one sentence:** identity knows who you are: it signs you in with Google, knows your groups from Workspace, issues the access tokens every other service validates, and manages library cards.

## Responsibilities

- Sign in with Google through OpenID Connect, only for the own Workspace domain: [FR-UM-01](../../requirements/functional/02-user-management.md#fr-um-01), [FR-UM-02](../../requirements/functional/02-user-management.md#fr-um-02), [FR-UM-03](../../requirements/functional/02-user-management.md#fr-um-03)
- Groups from the Cloud Identity Groups API, nested groups included, convention groups only: [FR-UM-04](../../requirements/functional/02-user-management.md#fr-um-04) to [FR-UM-06](../../requirements/functional/02-user-management.md#fr-um-06), [FR-UM-08](../../requirements/functional/02-user-management.md#fr-um-08)
- Periodic synchronisation of the members of all convention groups: [FR-UM-07](../../requirements/functional/02-user-management.md#fr-um-07), [FR-UM-10](../../requirements/functional/02-user-management.md#fr-um-10)
- Issuing access tokens and publishing the public keys: [TR-PF-02](../../requirements/technical/00-platform.md#tr-pf-02)
- OAuth authorisation server for Claude: [TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06)
- Library cards for Excel: issuing, revoking, renewing and exchanging them for access tokens: [DEC-DH-47](../../overview/data-hub.md#dec-dh-47), [TR-PF-07](../../requirements/technical/00-platform.md#tr-pf-07)

## API

First sketch; the exact contracts follow in the technical requirements of the domains.

| Endpoint | Purpose |
| --- | --- |
| `GET /login`, `GET /callback` | Sign in with Google for the web app |
| `POST /token/refresh` | Renew an access token ([OP-PF-02](../../requirements/technical/00-platform.md#op-pf-02)) |
| `GET /.well-known/jwks.json` | Public keys to validate access tokens |
| OAuth 2.1 metadata, `/authorize`, `/token`, client registration | Sign-in for MCP clients such as Claude |
| `GET /me` | The current user, groups and roles |
| `POST /library-cards`, `DELETE /library-cards/{id}` | Issue and revoke a library card |
| `POST /exchange` | Exchange a library card for an access token; used by `@datahub/auth` |
| `POST /internal/sync-groups` | Synchronise the convention groups; called by Cloud Scheduler with the service identity |

## Data

Users (by fixed Google ID), groups (by fixed Google ID) and memberships, library cards (hashes only), OAuth clients and grants.

## Talks to

Google Sign-In (OpenID Connect) and the Cloud Identity Groups API.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): the Groups Reader admin role in Workspace, and Cloud SQL client.
