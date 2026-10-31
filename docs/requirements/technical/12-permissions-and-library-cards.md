# Permissions and Excel keys: technical requirements

| | |
| --- | --- |
| Realises | [Permissions and Excel keys](../functional/12-permissions-and-library-cards.md) |
| Status | Under way |
| Source of truth | This file |

## Requirements

<a id="tr-pl-01"></a>
### TR-PL-01 · identity keeps Excel keys as hashes, each for a year

**Status:** Implemented · **Realises:** [FR-PL-01](../functional/12-permissions-and-library-cards.md#fr-pl-01), [FR-PL-02](../functional/12-permissions-and-library-cards.md#fr-pl-02), [FR-PL-03](../functional/12-permissions-and-library-cards.md#fr-pl-03), [DEC-DH-47](../../overview/data-hub.md#dec-dh-47)

identity keeps the Excel keys in the table `excel_keys` (migration `0005-excel-keys`): per key its User, its name of 1 to 80 characters, the SHA-256 hash of the key, when it was made, last used, expires, and, once revoked, when and by whom. A key is `dhx_` followed by 24 random bytes in base64url; identity answers it once, to `POST /me/excel-keys`, with `Cache-Control: no-store`, and never again. It expires 365 days after it was made.

`GET /me/excel-keys` lists the keys of the User, newest first, revoked ones included; `DELETE /me/excel-keys/{id}` revokes one of their own. For the Data Team, `GET /excel-keys` lists every key with its User, and `DELETE /excel-keys/{id}` revokes any key. A revoked key stays, so that the list can show it.

`POST /internal/excel-keys/exchange` takes a key in its body, only from query, with its Google ID token for identity's address (`DATAHUB_QUERY_SERVICE_ACCOUNT`). A key that is not known, revoked or expired, or whose User Workspace no longer knows as active, is refused with 401. Otherwise identity reads the Groups of the User from Workspace, applies the [Naming Convention](../functional/02-user-management.md#naming-convention), and answers an Access Token of the User with them, as at a sign-in ([TR-PF-07](00-platform.md#tr-pf-07)). It notes when the key was last used, at most once a minute.

<a id="tr-pl-02"></a>
### TR-PL-02 · The User of a key hears that it expires, or that the Data Team revoked it

**Status:** Implemented · **Realises:** [FR-PL-03](../functional/12-permissions-and-library-cards.md#fr-pl-03), [MSG-KEY-01](../functional/message-catalogue.md#msg-key-01), [MSG-KEY-02](../functional/message-catalogue.md#msg-key-02)

Cloud Scheduler calls `POST /internal/excel-keys/expiring` of identity once a day, at 07:43 in Brussels, with the Google ID token of `datahub-scheduler` for identity's address (`DATAHUB_SCHEDULER_SERVICE_ACCOUNT`). identity marks every key that is not revoked and expires within 30 days, once, and tells catalogue of each one with [MSG-KEY-01](../functional/message-catalogue.md#msg-key-01). When the Data Team revokes the key of another User, identity tells catalogue with [MSG-KEY-02](../functional/message-catalogue.md#msg-key-02), once per key; the key is revoked whether or not catalogue answers.

identity tells catalogue at `POST /internal/excel-keys/notices` (`DATAHUB_CATALOGUE_URL`), with its Google ID token for catalogue's address, which catalogue checks (`DATAHUB_IDENTITY_SERVICE_ACCOUNT`). catalogue writes the Message on the key (subject `excelKey`, migration `0016-excel-key-messages`), which only the User of the key sees, and notifies them as its author.
