# catalogue

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/catalogue` |
| Schema | `catalogue` |
| Domains | [Stacks and resources](../../requirements/functional/04-stacks-and-resources.md), [Collections](../../requirements/functional/03-collections.md), [Maturity and release](../../requirements/functional/06-maturity-and-release.md), [Resource card](../../requirements/functional/05-resource-card.md), [Log and notifications](../../requirements/functional/07-log-and-notifications.md), [Conversations](../../requirements/functional/14-conversations.md) |

**In one sentence:** catalogue is the library itself: what is on the shelves, in which Collection, at which Level, who may see it, and everything that happened to it.

## Responsibilities

- Registering, renaming and deregistering Resources: [FR-SR-01](../../requirements/functional/04-stacks-and-resources.md#fr-sr-01) to [FR-SR-10](../../requirements/functional/04-stacks-and-resources.md#fr-sr-10), [FR-SR-14](../../requirements/functional/04-stacks-and-resources.md#fr-sr-14)
- The Log with fixed Log IDs: [FR-SR-11](../../requirements/functional/04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](../../requirements/functional/04-stacks-and-resources.md#fr-sr-12), and the entries for Changes that registry hands over ([FR-AR-12](../../requirements/functional/01-artifact-registry.md#fr-ar-12))
- Publication and visibility: [FR-SR-16](../../requirements/functional/04-stacks-and-resources.md#fr-sr-16) to [FR-SR-20](../../requirements/functional/04-stacks-and-resources.md#fr-sr-20)
- Search, browsing per Collection and Entities: [FR-SR-13](../../requirements/functional/04-stacks-and-resources.md#fr-sr-13), [FR-SR-21](../../requirements/functional/04-stacks-and-resources.md#fr-sr-21) to [FR-SR-23](../../requirements/functional/04-stacks-and-resources.md#fr-sr-23)
- The Resource Card and Known Behaviour: [FR-SR-24](../../requirements/functional/04-stacks-and-resources.md#fr-sr-24), [FR-SR-28](../../requirements/functional/04-stacks-and-resources.md#fr-sr-28)
- Reactions and Signals: [FR-SR-29](../../requirements/functional/04-stacks-and-resources.md#fr-sr-29), [FR-SR-30](../../requirements/functional/04-stacks-and-resources.md#fr-sr-30)
- Collections: [FR-CO-01](../../requirements/functional/03-collections.md#fr-co-01) to [FR-CO-11](../../requirements/functional/03-collections.md#fr-co-11)
- Maturity Levels, derived and logged: [FR-MR-01](../../requirements/functional/06-maturity-and-release.md#fr-mr-01) to [FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10)
- The Message Centre, for v1 ([OP-PF-06](../../requirements/technical/00-platform.md#op-pf-06))

## API

First sketch; the exact contracts follow in the technical requirements of the domains.

| Endpoint | Purpose |
| --- | --- |
| `POST /resources`, `PATCH /resources/{id}`, `DELETE /resources/{id}` | Register, rename, deregister (Data Admins) |
| `GET /resources/{id}` | The Resource Card, as far as the User may see it |
| `PUT /resources/{id}/publication`, `POST /resources/{id}/confirmations` | Publish and confirm (Owner) |
| `GET /resources/{id}/log` | History, filterable by kind of Log Entry |
| `POST /resources/{id}/reactions` | Question, Remark or Signal |
| `GET /search`, `GET /collections/{id}/resources` | Find and browse |
| `/collections` | Manage Collections (Data Team) |
| `POST /visibility` | Which of these Keys the User may see; used by query |
| `POST /internal/changes` | Changes of a new Artifact Set, from registry, with the service identity ([OP-PF-05](../../requirements/technical/00-platform.md#op-pf-05)) |

## Data

Resources, Collections, Fingerprints, Confirmations, Publications, Log Entries, Known Behaviour and Anomalies, Reactions, messages.

## Talks to

registry, for Nodes, descriptions and lineage, with the token of the User.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): Cloud SQL client only.
