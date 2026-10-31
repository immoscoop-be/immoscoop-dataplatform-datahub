# identity

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/identity` |
| Schema | `identity` |
| Domains | [User management](../../requirements/functional/02-user-management.md), [Permissions and Excel keys](../../requirements/functional/12-permissions-and-library-cards.md) |

**In one sentence:** identity knows who you are: it signs you in with Google, knows your Groups from Workspace, issues the Access Tokens every other service validates, and manages Excel keys.

## Responsibilities

- Sign in with Google through OpenID Connect, only for the two domains of the own Workspace, `thenextimmoscoop.be` and `immoscoop.be` ([DEC-UM-09](../../requirements/functional/02-user-management.md#dec-um-09)): [FR-UM-01](../../requirements/functional/02-user-management.md#fr-um-01), [FR-UM-02](../../requirements/functional/02-user-management.md#fr-um-02), [FR-UM-03](../../requirements/functional/02-user-management.md#fr-um-03)
- A refused account is named back to the web app in the fragment of its callback, which no server receives or logs, so that the sign-in can say which account was refused ([DEC-UX-35](../../design/principles.md#dec-ux-35))
- Groups from the Cloud Identity Groups API, nested groups included: every group of the own Workspace domains, any of which can be an Owner Unit, and roles from the Role Groups only: [FR-UM-04](../../requirements/functional/02-user-management.md#fr-um-04), [FR-UM-06](../../requirements/functional/02-user-management.md#fr-um-06), [FR-UM-08](../../requirements/functional/02-user-management.md#fr-um-08), [FR-UM-11](../../requirements/functional/02-user-management.md#fr-um-11)
- Periodic Synchronisation of the members of all Groups: [FR-UM-07](../../requirements/functional/02-user-management.md#fr-um-07), [FR-UM-10](../../requirements/functional/02-user-management.md#fr-um-10)
- Issuing Access Tokens, signed with its key in Cloud KMS, and publishing the public keys: [TR-PF-02](../../requirements/technical/00-platform.md#tr-pf-02), [TR-PF-24](../../requirements/technical/00-platform.md#tr-pf-24)
- OAuth authorisation server for the server of the web app and for Claude: [TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06), [TR-PF-27](../../requirements/technical/00-platform.md#tr-pf-27)
- Keeping them signed in with Refresh Tokens, and checking Groups and account at every renewal: [TR-PF-25](../../requirements/technical/00-platform.md#tr-pf-25), [TR-PF-26](../../requirements/technical/00-platform.md#tr-pf-26)
- The settings of each User, as keys and values: [TR-PF-32](../../requirements/technical/00-platform.md#tr-pf-32)
- Who catalogue notifies: the Groups and roles of each User as last read, and which members of a Group Data Hub knows ([DEC-LN-07](../../requirements/functional/07-log-and-notifications.md#dec-ln-07), [TR-LN-02](../../requirements/technical/07-log-and-notifications.md#tr-ln-02))
- Excel keys for Excel: making, listing and revoking them, exchanging them for Access Tokens, and telling their User a month before one expires or when the Data Team revoked one: [DEC-DH-47](../../overview/data-hub.md#dec-dh-47), [TR-PF-07](../../requirements/technical/00-platform.md#tr-pf-07), built as [TR-PL-01](../../requirements/technical/12-permissions-and-library-cards.md#tr-pl-01) and [TR-PL-02](../../requirements/technical/12-permissions-and-library-cards.md#tr-pl-02)

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
| `GET /groups` | Every group of the own domains, for the Data Team to hand a Collection to any of them ([TR-CO-03](../../requirements/technical/03-collections.md#tr-co-03)) |
| `GET /me/settings`, `PUT /me/settings/{key}`, `DELETE /me/settings/{key}` | The settings of the current User: read them all, set one with `{ "value": … }`, or forget one ([TR-PF-32](../../requirements/technical/00-platform.md#tr-pf-32)) |
| `GET /me/excel-keys`, `POST /me/excel-keys`, `DELETE /me/excel-keys/{id}` | The Excel keys of the User, revoked ones included; a new one, whose key comes this once; and revoking one of their own ([TR-PL-01](../../requirements/technical/12-permissions-and-library-cards.md#tr-pl-01)) |
| `GET /excel-keys`, `DELETE /excel-keys/{id}` | For the Data Team: every Excel key with its User, and revoking any key, which tells its User ([TR-PL-02](../../requirements/technical/12-permissions-and-library-cards.md#tr-pl-02)) |
| `POST /internal/excel-keys/exchange` | From query, with its Google ID token for identity's address (`DATAHUB_QUERY_SERVICE_ACCOUNT`): an Excel key in the body, exchanged for an Access Token of its User; used by `@datahub/auth` ([TR-PF-07](../../requirements/technical/00-platform.md#tr-pf-07)) |
| `POST /internal/excel-keys/expiring` | Once a day, from Cloud Scheduler with the Google ID token of `datahub-scheduler` (`DATAHUB_SCHEDULER_SERVICE_ACCOUNT`): tells the User of each key that expires within a month, once ([TR-PL-02](../../requirements/technical/12-permissions-and-library-cards.md#tr-pl-02)) |
| `POST /internal/people` | From catalogue, with its Google ID token for identity's address (`DATAHUB_CATALOGUE_SERVICE_ACCOUNT`): the Users it names, and the members of the Groups and holders of the roles it names that Data Hub knows, with their address, name and language ([TR-LN-02](../../requirements/technical/07-log-and-notifications.md#tr-ln-02)) |
| `POST /internal/sync-groups` | Synchronise the Groups; called by Cloud Scheduler with the service identity |

## Data

Users (by fixed Google ID), with their Groups and roles as identity last read them at a sign-in or a renewal (migration `0004-groups`), Groups (by fixed Google ID) and memberships, Excel keys (hashes only, migration `0005-excel-keys`), Refresh Tokens (hashes only) and their sessions, OAuth clients and grants, and the settings of each User, a list of keys and values ([DEC-UX-96](../../design/principles.md#dec-ux-96), [TR-PF-32](../../requirements/technical/00-platform.md#tr-pf-32)).

## Talks to

Google Sign-In (OpenID Connect), the Cloud Identity Groups API, the Admin SDK Directory API to check accounts, and Cloud KMS to sign Access Tokens. It tells catalogue (`DATAHUB_CATALOGUE_URL`), with its Google ID token for catalogue's address, of an Excel key that expires within a month or that the Data Team revoked, at `POST /internal/excel-keys/notices` ([TR-PL-02](../../requirements/technical/12-permissions-and-library-cards.md#tr-pl-02)).

For the nested groups of [FR-UM-04](../../requirements/functional/02-user-management.md#fr-um-04), identity asks the Cloud Identity Groups API for the direct groups of the User, then for the direct groups of each of those groups, one level at a time, until no new group turns up. Google's search for every nested group in one call (`searchTransitiveGroups`) only works on Workspace Enterprise and Cloud Identity Premium, and answers 403 on other editions.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): the Groups Reader and Data Hub user reader admin roles in Workspace, Cloud SQL client, and Cloud KMS Signer/Verifier on the signing key alone.
