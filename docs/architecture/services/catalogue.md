# catalogue

| | |
| --- | --- |
| Kind | Backend service on Cloud Run |
| Code | `services/catalogue` |
| Schema | `catalogue` |
| Domains | [Resources](../../requirements/functional/04-stacks-and-resources.md), [Collections](../../requirements/functional/03-collections.md), [Maturity and release](../../requirements/functional/06-maturity-and-release.md), [Resource card](../../requirements/functional/05-resource-card.md), [Log and notifications](../../requirements/functional/07-log-and-notifications.md), [Conversations](../../requirements/functional/14-conversations.md) |

**In one sentence:** catalogue is the library itself: what is on the shelves, in which Collection, at which Level, who may see it, and everything that happened to it.

## Responsibilities

- Registering, renaming and withdrawing Resources, from the exposures registry hands over: [FR-SR-04](../../requirements/functional/04-stacks-and-resources.md#fr-sr-04) to [FR-SR-10](../../requirements/functional/04-stacks-and-resources.md#fr-sr-10), [FR-SR-14](../../requirements/functional/04-stacks-and-resources.md#fr-sr-14), [FR-SR-32](../../requirements/functional/04-stacks-and-resources.md#fr-sr-32) to [FR-SR-35](../../requirements/functional/04-stacks-and-resources.md#fr-sr-35), built as [TR-SR-01](../../requirements/technical/04-stacks-and-resources.md#tr-sr-01) to [TR-SR-05](../../requirements/technical/04-stacks-and-resources.md#tr-sr-05)
- The Log with fixed Log IDs: [FR-SR-11](../../requirements/functional/04-stacks-and-resources.md#fr-sr-11), [FR-SR-12](../../requirements/functional/04-stacks-and-resources.md#fr-sr-12), and the entries for Changes that registry hands over ([FR-AR-12](../../requirements/functional/01-artifact-registry.md#fr-ar-12))
- Publication and visibility: [FR-SR-16](../../requirements/functional/04-stacks-and-resources.md#fr-sr-16) to [FR-SR-20](../../requirements/functional/04-stacks-and-resources.md#fr-sr-20)
- Search, browsing per Collection and Entities: [FR-SR-13](../../requirements/functional/04-stacks-and-resources.md#fr-sr-13), [FR-SR-21](../../requirements/functional/04-stacks-and-resources.md#fr-sr-21) to [FR-SR-23](../../requirements/functional/04-stacks-and-resources.md#fr-sr-23)
- The Resource Card and Known Behaviour: [FR-SR-24](../../requirements/functional/04-stacks-and-resources.md#fr-sr-24), [FR-SR-28](../../requirements/functional/04-stacks-and-resources.md#fr-sr-28)
- Reactions and Signals: [FR-SR-29](../../requirements/functional/04-stacks-and-resources.md#fr-sr-29), [FR-SR-30](../../requirements/functional/04-stacks-and-resources.md#fr-sr-30)
- Collections: [FR-CO-02](../../requirements/functional/03-collections.md#fr-co-02) to [FR-CO-17](../../requirements/functional/03-collections.md#fr-co-17), built as [TR-CO-01](../../requirements/technical/03-collections.md#tr-co-01) to [TR-CO-04](../../requirements/technical/03-collections.md#tr-co-04)
- Maturity Levels, derived and logged: [FR-MR-01](../../requirements/functional/06-maturity-and-release.md#fr-mr-01) to [FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10)
- The Message Centre, for v1 ([OP-PF-06](../../requirements/technical/00-platform.md#op-pf-06))

## API

First sketch; the exact contracts follow in the technical requirements of the domains. The routes of Collections ([TR-CO-02](../../requirements/technical/03-collections.md#tr-co-02)) and of Resources in Collections ([TR-SR-04](../../requirements/technical/04-stacks-and-resources.md#tr-sr-04), [TR-SR-05](../../requirements/technical/04-stacks-and-resources.md#tr-sr-05)) are built; the others are still a sketch.

| Endpoint | Purpose |
| --- | --- |
| `POST /internal/resources` | The exposed tables of one dbt project, from registry with its service identity: registers, renames, withdraws and brings back Resources ([TR-SR-01](../../requirements/technical/04-stacks-and-resources.md#tr-sr-01)) |
| `GET /resources?collection=none` | The Resources without Collection (Data Team) |
| `PUT /resources/{id}/collection`, `DELETE /resources/{id}/collection` | Add a Resource to a Collection, or remove it (Data Team) |
| `GET /collections/{id}/resources` | The Resources of a Collection, as far as the User may see them |
| `GET /resources/{id}` | The Resource Card, as far as the User may see it |
| `PUT /resources/{id}/publication`, `POST /resources/{id}/confirmations` | Publish and confirm (Owner) |
| `GET /resources/{id}/log` | History, filterable by kind of Log Entry |
| `POST /resources/{id}/reactions` | Question, Remark or Signal |
| `GET /search`, `GET /collections/{id}/resources` | Find and browse |
| `GET /collections`, `POST /collections` | The Collections the User sees; create one (everyone) |
| `GET /collections/{id}`, `PATCH /collections/{id}`, `DELETE /collections/{id}` | Read one; change or dissolve it (its Owner Unit and the Data Team) |
| `GET /collections/{id}/log` | The Log of a Collection |
| `POST /visibility` | Which of these Keys the User may see; used by query |
| `POST /internal/changes` | Changes of a new Artifact Set, from registry, with the service identity ([DEC-PF-26](../../requirements/technical/00-platform.md#dec-pf-26)) |

## Data

Resources, Collections, Fingerprints, Confirmations, Publications, Log Entries, Known Behaviour and Anomalies, Reactions, messages.

## Talks to

registry, for Nodes, descriptions and lineage, with the token of the User. identity, for the groups of the User when they choose an Owner Unit ([TR-CO-03](../../requirements/technical/03-collections.md#tr-co-03)), also with the token of the User.

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): Cloud SQL client only.
