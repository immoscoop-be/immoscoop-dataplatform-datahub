# web

| | |
| --- | --- |
| Kind | Client application: React, in the browser |
| Code | `apps/web` |
| Schema | None |

**In one sentence:** web is the Data Hub interface in the browser; it shows what the services return and holds no business logic of its own ([DEC-PF-03](../../requirements/technical/00-platform.md#dec-pf-03)).

## Responsibilities

- Signing in through identity
- Finding, reading and discussing Resources: the tabs of a Resource ([FR-SR-24](../../requirements/functional/04-stacks-and-resources.md#fr-sr-24)), search and browsing per Collection ([FR-SR-21](../../requirements/functional/04-stacks-and-resources.md#fr-sr-21), [FR-SR-22](../../requirements/functional/04-stacks-and-resources.md#fr-sr-22))
- The admin for Data Admins and the Data Team: registering Resources and managing Collections
- Showing the Level everywhere ([FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10))
- All texts in English ([FR-SR-15](../../requirements/functional/04-stacks-and-resources.md#fr-sr-15))
- Later: Lenses and Reports, with the shared components in `packages/ui` ([TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12))

## Talks to

identity, catalogue, registry and query, with the Access Token of the User. How the app is served is open ([OP-PF-07](../../requirements/technical/00-platform.md#op-pf-07)).
