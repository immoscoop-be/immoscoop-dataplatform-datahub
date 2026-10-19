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
- Groups from the Cloud Identity Groups API, nested groups included: every group of the own Workspace domain, any of which can be an Owner Unit, and roles from the Role Groups only: [FR-UM-04](../../requirements/functional/02-user-management.md#fr-um-04), [FR-UM-06](../../requirements/functional/02-user-management.md#fr-um-06), [FR-UM-08](../../requirements/functional/02-user-management.md#fr-um-08), [FR-UM-11](../../requirements/functional/02-user-management.md#fr-um-11)
- Periodic Synchronisation of the members of all Groups: [FR-UM-07](../../requirements/functional/02-user-management.md#fr-um-07), [FR-UM-10](../../requirements/functional/02-user-management.md#fr-um-10)
- Issuing Access Tokens, signed with its key in Cloud KMS, and publishing the public keys: [TR-PF-02](../../requirements/technical/00-platform.md#tr-pf-02), [TR-PF-24](../../requirements/technical/00-platform.md#tr-pf-24)
- OAuth authorisation server for the server of the web app and for Claude: [TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06), [TR-PF-27](../../requirements/technical/00-platform.md#tr-pf-27)
- Keeping them signed in with Refresh Tokens, and checking Groups and account at every renewal: [TR-PF-25](../../requirements/technical/00-platform.md#tr-pf-25), [TR-PF-26](../../requirements/technical/00-platform.md#tr-pf-26)
- Library Cards for Excel: issuing, revoking, renewing and exchanging them for Access Tokens: [DEC-DH-47](../../overview/data-hub.md#dec-dh-47), [TR-PF-07](../../requirements/technical/00-platform.md#tr-pf-07)

## API

First sketch; the exact contracts follow in the technical requirements of the domains.

| Endpoint | Purpose |
| --- | --- |
| `GET /callback` | Where Google sends the User back after signing in: the redirect URI of identity's OAuth client at Google |
| `GET /.well-known/jwks.json` | Public keys to validate Access Tokens |
| `/.well-known/oauth-authorization-server`, `/authorize`, `/token`, `/revoke`, `/register` | Signing in, renewing with a Refresh Token, and logging out, for the server of the web app and for MCP clients such as Claude; only Claude's callbacks may register |
| `DELETE /users/{googleId}/sessions` | The Data Team ends every session of a User at once ([TR-PF-25](../../requirements/technical/00-platform.md#tr-pf-25)) |
| `GET /me` | The current User, Groups and roles |
| `GET /me/groups` | The groups of the current User with their address and name, read from Workspace; for choosing an Owner Unit ([TR-CO-03](../../requirements/technical/03-collections.md#tr-co-03)) |
| `POST /library-cards`, `DELETE /library-cards/{id}` | Issue and revoke a Library Card |
| `POST /exchange` | Exchange a Library Card for an Access Token; used by `@datahub/auth` |
| `POST /internal/sync-groups` | Synchronise the Groups; called by Cloud Scheduler with the service identity |

## Data

Users (by fixed Google ID), Groups (by fixed Google ID) and memberships, Library Cards (hashes only), Refresh Tokens (hashes only) and their sessions, OAuth clients and grants.

## Talks to

Google Sign-In (OpenID Connect), the Cloud Identity Groups API, the Admin SDK Directory API to check accounts, and Cloud KMS to sign Access Tokens.

For the nested groups of [FR-UM-04](../../requirements/functional/02-user-management.md#fr-um-04), identity asks the Cloud Identity Groups API for the direct groups of the User, then for the direct groups of each of those groups, one level at a time, until no new group turns up. Google's search for every nested group in one call (`searchTransitiveGroups`) only works on Workspace Enterprise and Cloud Identity Premium, and answers 403 on other editions.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): the Groups Reader and Data Hub user reader admin roles in Workspace, Cloud SQL client, and Cloud KMS Signer/Verifier on the signing key alone.
