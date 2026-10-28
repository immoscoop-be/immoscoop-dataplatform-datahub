# Non-functional requirements

The qualities Data Hub must have, across domains: how secure, how fast, how cheap, how observable. A non-functional requirement can apply to the whole of Data Hub, or to specific functional requirements through an `**Applies to:**` line.

| | |
| --- | --- |
| Status | [Security](security.md) started; [Localisation](localisation.md) specified; the other categories follow |
| Source of truth | This folder |

## Categories

Each category gets its own file and code. The categories below are a proposal; adjusting them is allowed.

| Code | Category | File |
| --- | --- | --- |
| `SEC` | Security: authentication, authorisation, secrets | [security.md](security.md) |
| `PRV` | Privacy and data protection: personal data, access classification | `privacy.md` |
| `PRF` | Performance and scalability | `performance.md` |
| `AVL` | Availability and resilience | `availability.md` |
| `CST` | Cost: BigQuery scanning, infrastructure | `cost.md` |
| `OBS` | Observability: logging, monitoring, alerting of Data Hub itself | `observability.md` |
| `MNT` | Maintainability: migrations, deployment, tests | `maintainability.md` |
| `LOC` | Localisation: language of the app | [localisation.md](localisation.md) |
| `ACC` | Accessibility: colour, contrast, keyboard use | `accessibility.md` |

IDs follow `NFR-<code>-<NN>`, for example `NFR-SEC-01`. Start a new file from the [non-functional requirements template](../_templates/non-functional-category.md). The ID scheme, statuses and commit conventions are in the [requirements conventions](../README.md).

## Candidates already in the functional documentation

Some rules and decisions migrated from Confluence are, by nature, non-functional. They stay where they are for now; when the category files are written, they can be referenced or taken over.

| Candidate | Category |
| --- | --- |
| All texts in the app are in English: [FR-SR-15](../functional/04-stacks-and-resources.md#fr-sr-15), [DEC-DH-02](../../overview/data-hub.md#dec-dh-02); replaced on 2026-10-25 by the language principle ([localisation](localisation.md)) | `LOC` |
| A limit on scanned bytes for every query: [FR-SR-27](../functional/04-stacks-and-resources.md#fr-sr-27), [DEC-SR-17](../functional/04-stacks-and-resources.md#dec-sr-17) | `CST` |
| Costs tracked via the own service account: [DEC-DH-49](../../overview/data-hub.md#dec-dh-49) | `CST` |
| The service account reaches only the tables of the projects Data Hub follows: [DEC-DH-08](../../overview/data-hub.md#dec-dh-08), [DEC-SR-32](../functional/04-stacks-and-resources.md#dec-sr-32); now covered by [NFR-SEC-02](security.md#nfr-sec-02) | `SEC` |
| No passwords stored, Google identity only: [FR-UM-01](../functional/02-user-management.md#fr-um-01), [FR-UM-03](../functional/02-user-management.md#fr-um-03) | `SEC` |
| Access classification for personal data: [The Resource Card](../../overview/data-hub.md#the-resource-card) | `PRV` |
| Horizontal scalability is not a requirement: [DEC-DH-59](../../overview/data-hub.md#dec-dh-59) | `PRF` |
| Logged-in Users keep working while Google is briefly unreachable: [EC-UM-03](../functional/02-user-management.md#ec-um-03) | `AVL` |
| Database migrations run in a separate step before a new version goes live: [DEC-DH-59](../../overview/data-hub.md#dec-dh-59) | `MNT` |
