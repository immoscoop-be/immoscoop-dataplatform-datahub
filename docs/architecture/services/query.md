# query

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/query` |
| Schema | None in v1 |
| Domains | [Stacks and resources](../../requirements/functional/04-stacks-and-resources.md) (querying), [Channels](../../requirements/functional/13-channels.md) |

**In one sentence:** query is the only service that reads the stacks: it shows previews, runs free SQL for Claude, and serves feeds to Excel, always only over resources the user may see.

## Responsibilities

- The preview of the first rows: [FR-SR-25](../../requirements/functional/04-stacks-and-resources.md#fr-sr-25)
- Free SQL through Claude, only over visible resources: [FR-SR-26](../../requirements/functional/04-stacks-and-resources.md#fr-sr-26)
- A limit on scanned bytes and a label with the user on every query: [FR-SR-27](../../requirements/functional/04-stacks-and-resources.md#fr-sr-27)
- Feeds for Excel through Power Query: [DEC-DH-46](../../overview/data-hub.md#dec-dh-46)

## How a query is checked

1. A dry run in BigQuery returns the tables the query touches and the bytes it would scan.
2. query asks catalogue which of those tables the user may see. If one is not visible, the query is refused.
3. The query runs with a maximum on the bytes billed and a label with the user.

Executed queries are not stored ([DEC-SR-18](../../requirements/functional/04-stacks-and-resources.md#dec-sr-18)), so query has no schema in v1.

## API

First sketch; the exact contracts follow in the technical requirements of the domains.

| Endpoint | Purpose |
| --- | --- |
| `GET /resources/{id}/preview` | The first rows of a resource |
| `POST /queries` | Run free SQL |
| `GET /feeds/{id}` | A feed for Power Query, with a library card ([TR-PF-07](../../requirements/technical/00-platform.md#tr-pf-07)) |

## Talks to

BigQuery (the stacks only) and catalogue (visibility, with the token of the user).

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): read access to the stacks and permission to run BigQuery jobs. The only service with access to data.
