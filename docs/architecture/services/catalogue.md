# catalogue

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/catalogue` |
| Schema | `catalogue` |
| Domains | [Stacks and resources](../../requirements/functional/04-stacks-and-resources.md), [Collections](../../requirements/functional/03-collections.md), [Maturity and release](../../requirements/functional/06-maturity-and-release.md), [Resource card](../../requirements/functional/05-resource-card.md), [Log and notifications](../../requirements/functional/07-log-and-notifications.md), [Conversations](../../requirements/functional/14-conversations.md) |

**In one sentence:** catalogue is the library itself: what is on the shelves, in which collection, at which level, who may see it, and everything that happened to it.

## Responsibilities

- Registering, renaming and deregistering resources: [FR-SR-01](../../requirements/functional/04-stacks-and-resources.md#fr-sr-01) to [FR-SR-10](../../requirements/functional/04-stacks-and-resources.md#fr-sr-10), [FR-SR-14](../../requirements/functional/04-stacks-and-resources.md#fr-sr-14)
- The log with fixed log IDs: [FR-SR-11](../../requirements/functional/04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](../../requirements/functional/04-stacks-and-resources.md#fr-sr-12), and the entries for changes that registry hands over ([FR-AR-12](../../requirements/functional/01-artifact-registry.md#fr-ar-12))
- Publication and visibility: [FR-SR-16](../../requirements/functional/04-stacks-and-resources.md#fr-sr-16) to [FR-SR-20](../../requirements/functional/04-stacks-and-resources.md#fr-sr-20)
- Search, browsing per collection and entities: [FR-SR-13](../../requirements/functional/04-stacks-and-resources.md#fr-sr-13), [FR-SR-21](../../requirements/functional/04-stacks-and-resources.md#fr-sr-21) to [FR-SR-23](../../requirements/functional/04-stacks-and-resources.md#fr-sr-23)
- The resource card and known behaviour: [FR-SR-24](../../requirements/functional/04-stacks-and-resources.md#fr-sr-24), [FR-SR-28](../../requirements/functional/04-stacks-and-resources.md#fr-sr-28)
- Reactions and signals: [FR-SR-29](../../requirements/functional/04-stacks-and-resources.md#fr-sr-29), [FR-SR-30](../../requirements/functional/04-stacks-and-resources.md#fr-sr-30)
- Collections: [FR-CO-01](../../requirements/functional/03-collections.md#fr-co-01) to [FR-CO-11](../../requirements/functional/03-collections.md#fr-co-11)
- Maturity levels, derived and logged: [FR-MR-01](../../requirements/functional/06-maturity-and-release.md#fr-mr-01) to [FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10)
- The message centre, for v1 ([OP-PF-06](../../requirements/technical/00-platform.md#op-pf-06))

## API

First sketch; the exact contracts follow in the technical requirements of the domains.

| Endpoint | Purpose |
| --- | --- |
| `POST /resources`, `PATCH /resources/{id}`, `DELETE /resources/{id}` | Register, rename, deregister (data admins) |
| `GET /resources/{id}` | The resource card, as far as the user may see it |
| `PUT /resources/{id}/publication`, `POST /resources/{id}/confirmations` | Publish and confirm (owner) |
| `GET /resources/{id}/log` | History, filterable by kind of log entry |
| `POST /resources/{id}/reactions` | Question, remark or signal |
| `GET /search`, `GET /collections/{id}/resources` | Find and browse |
| `/collections` | Manage collections (data team) |
| `POST /visibility` | Which of these keys the user may see; used by query |
| `POST /internal/changes` | Changes of a new artifact set, from registry, with the service identity ([OP-PF-05](../../requirements/technical/00-platform.md#op-pf-05)) |

## Data

Resources, collections, fingerprints, confirmations, publications, log entries, known behaviour and anomalies, reactions, messages.

## Talks to

registry, for nodes, descriptions and lineage, with the token of the user.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): Cloud SQL client only.
