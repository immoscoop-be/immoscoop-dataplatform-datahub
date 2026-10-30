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
- The Message Centre and the Messages on every object, with replies, read marks and the decision on a Request: [FR-CV-01](../../requirements/functional/14-conversations.md#fr-cv-01) to [FR-CV-09](../../requirements/functional/14-conversations.md#fr-cv-09), built as [TR-CV-01](../../requirements/technical/14-conversations.md#tr-cv-01) and [TR-CV-02](../../requirements/technical/14-conversations.md#tr-cv-02)
- Notifications of every Message, by e-mail through the SMTP relay of Workspace and as a direct message in Slack, to the recipients of its type: [FR-LN-01](../../requirements/functional/07-log-and-notifications.md#fr-ln-01), [FR-CV-03](../../requirements/functional/14-conversations.md#fr-cv-03), [FR-CV-15](../../requirements/functional/14-conversations.md#fr-cv-15), built as [TR-LN-01](../../requirements/technical/07-log-and-notifications.md#tr-ln-01) to [TR-LN-04](../../requirements/technical/07-log-and-notifications.md#tr-ln-04)

## API

First sketch; the exact contracts follow in the technical requirements of the domains. The routes of Collections ([TR-CO-02](../../requirements/technical/03-collections.md#tr-co-02)) and of Resources in Collections ([TR-SR-04](../../requirements/technical/04-stacks-and-resources.md#tr-sr-04), [TR-SR-05](../../requirements/technical/04-stacks-and-resources.md#tr-sr-05)) are built; the others are still a sketch.

| Endpoint | Purpose |
| --- | --- |
| `POST /internal/resources` | The exposed tables of one dbt project, from registry with its service identity: registers, renames, withdraws and brings back Resources ([TR-SR-01](../../requirements/technical/04-stacks-and-resources.md#tr-sr-01)) |
| `GET /resources?collection=none` | The Resources without Collection, each with its Level (Data Team) |
| `POST /collections/{id}/resources` | Add Resources to a Collection, all of them or none, each with its grain, model type, storage and mappings ([TR-CO-05](../../requirements/technical/03-collections.md#tr-co-05)) (Data Team) |
| `PUT /resources/{id}/collection`, `DELETE /resources/{id}/collection` | Add a Resource to a Collection, or remove it (Data Team) |
| `GET /collections/{id}/resources` | The Resources of a Collection, as far as the User may see them |
| `GET /resources/{id}` | The Resource Card, as far as the User may see it; built: the Resource with its fields and their Business Descriptions, the columns left out of it ([TR-SR-06](../../requirements/technical/04-stacks-and-resources.md#tr-sr-06)), what was recorded when it was added ([TR-CO-05](../../requirements/technical/03-collections.md#tr-co-05)) and what the Owner and the Data Team keep about it ([TR-SR-10](../../requirements/technical/04-stacks-and-resources.md#tr-sr-10)) |
| `PATCH /resources/{id}`, `PUT /resources/{id}/fields` | Edit the Resource Card in place, and the Business Descriptions of its fields (Owner and Data Team, [TR-SR-10](../../requirements/technical/04-stacks-and-resources.md#tr-sr-10)) |
| `PUT /resources/{id}/details` | Edit relations: the grain, storage and mappings again (Data Team) |
| `GET /resources/{id}/related`, `GET /resources/{id}/lineage` | What it relates to through its identities, and the lineage around it, from registry ([TR-SR-11](../../requirements/technical/04-stacks-and-resources.md#tr-sr-11)) |
| `POST /resources/{id}/publication` | Publish, the first Confirmation (Owner, [TR-SR-12](../../requirements/technical/04-stacks-and-resources.md#tr-sr-12)) |
| `POST /resources/{id}/changes/seen` | Mark the changes since the last Confirmation seen (Owner Unit and Data Team, [TR-SR-13](../../requirements/technical/04-stacks-and-resources.md#tr-sr-13)) |
| `PUT /resources/{id}/deprecation`, `DELETE /resources/{id}/deprecation` | Deprecate a published Resource, and take it away (Owner Unit and Data Team, [TR-SR-14](../../requirements/technical/04-stacks-and-resources.md#tr-sr-14)) |
| `GET /resources/{id}/log` | History, filterable by kind of Log Entry |
| `GET /messages?view=…&kind=…&on=…&search=…`, `GET /messages/unread` | The Message Centre: the conversations of a view, For you, unread, written by the User or everything they may see, with its counts; and the number unread for the rail ([TR-CV-01](../../requirements/technical/14-conversations.md#tr-cv-01)) |
| `GET /messages/{id}`, `GET /messages/on/{kind}/{id}` | One conversation with its replies; the conversations on a Collection, a Resource or a Lens |
| `POST /messages`, `POST /messages/{id}/replies`, `POST /messages/{id}/read` | A Question, Remark or Signal on an object the User sees, a reply, and reading a conversation |
| `POST /messages/{id}/decision` | The decision on a Request to run a query (Data Team, [TR-CV-02](../../requirements/technical/14-conversations.md#tr-cv-02)) |
| `PUT /internal/lenses/{id}`, `POST /internal/lenses/{id}/requests`, `POST /internal/lenses/{id}/growth`, `POST /internal/messages/{id}/decision` | From query, with its service identity: what decides who sees the Messages on a Lens, the Request of Data Hub on a Lens that stopped, what Data Hub tells the author of a Lens that grew into large ([MSG-LEN-02](../../requirements/functional/message-catalogue.md#msg-len-02)), and the decision on a Request on a Lens ([TR-CV-02](../../requirements/technical/14-conversations.md#tr-cv-02)) |
| `POST /internal/notifications/deliver` | From Cloud Scheduler every five minutes, with the Google ID token of `datahub-scheduler`: sends the notifications that did not go out at once, and tries again what failed ([TR-LN-01](../../requirements/technical/07-log-and-notifications.md#tr-ln-01)) |
| `GET /search`, `GET /collections/{id}/resources` | Find and browse |
| `GET /collections`, `POST /collections` | The Collections the User sees, each with the Resources in it they see and its last change; create one (everyone) |
| `GET /search?question=…` | The Collections and Resources the User sees that share words with a question, the shared words marked, for the start screen of Collections ([TR-CO-06](../../requirements/technical/03-collections.md#tr-co-06)) |
| `GET /collections/{id}`, `PATCH /collections/{id}`, `DELETE /collections/{id}` | Read one; change or dissolve it (its Owner Unit and the Data Team) |
| `GET /collections/{id}/log` | The Log of a Collection |
| `POST /visibility` | Which of these Keys the User may see; used by query |
| `POST /requests`, `GET /requests?subjectKind=query`, `…?subjectKind=lens` | A Request to the Data Team on a query or a very large Lens, sent by query for its User, and the User's own Requests; the Data Team's on one query or Lens ([TR-SR-18](../../requirements/technical/04-stacks-and-resources.md#tr-sr-18), [TR-LE-01](../../requirements/technical/09-lenses.md#tr-le-01)) |
| `POST /internal/changes` | Changes of a new Artifact Set, from registry, with the service identity ([DEC-PF-26](../../requirements/technical/00-platform.md#dec-pf-26)) |

## Data

Resources, Collections, Fingerprints, Confirmations, Publications, Log Entries, Known Behaviour and Anomalies, Reactions, messages.

Built today: the Collections and their Log; the Resources with their Level, their plain fields and the columns left out of them, their Fingerprints and their Log ([TR-SR-02](../../requirements/technical/04-stacks-and-resources.md#tr-sr-02), [TR-SR-06](../../requirements/technical/04-stacks-and-resources.md#tr-sr-06) to [TR-SR-08](../../requirements/technical/04-stacks-and-resources.md#tr-sr-08)); and the Messages, each placed on its object, its text built from the [Message Catalogue](../../requirements/functional/message-catalogue.md) when it is read ([TR-SR-09](../../requirements/technical/04-stacks-and-resources.md#tr-sr-09)). The texts of the Log come from the [Log Catalogue](../../requirements/functional/log-catalogue.md) in `@datahub/contracts`, in Dutch and English. The Resources started afresh for the rebuild, in migration `0004-resources-afresh`. The grain, model type, storage and mappings recorded when a Resource is added are in migration `0006-grain-and-mappings`; what the Owner and the Data Team keep about it, in `0007-resource-card`; its Publication, Confirmations, the changes since the last one, the descriptions from dbt that changed, and its deprecation, in `0008-publication`. A Request is a Message of a User that waits for a decision, one waiting per writer, object and type, in `0009-requests`. The text search configuration `search_words`, English without accents, for the search of the start screen, in `0010-search-words` ([TR-CO-06](../../requirements/technical/03-collections.md#tr-co-06)). Conversations, in `0011-conversations`: a reply under the Message it answers, when a conversation last moved and by whom, until when each User read it (`message_reads`), and what query tells about each Lens (`lenses`) to decide who sees the Messages on it ([TR-CV-01](../../requirements/technical/14-conversations.md#tr-cv-01), [TR-CV-02](../../requirements/technical/14-conversations.md#tr-cv-02)). The full name of the table of a Resource in its own case, for BigQuery, in `0012-full-name` ([DEC-SR-44](../../requirements/functional/04-stacks-and-resources.md#dec-sr-44)). Notifications, in `0013-notifications`: the outbox `notifications`, which a trigger fills with every Message as it is written, and what went out of each (`notification_deliveries`) ([TR-LN-01](../../requirements/technical/07-log-and-notifications.md#tr-ln-01)). catalogue asks registry for the lineage around a Resource as itself, with a Google ID token for registry's address (`DATAHUB_REGISTRY_URL`).

## Talks to

registry, for Nodes, descriptions and lineage, with the token of the User. identity, for the groups of the User when they choose an Owner Unit ([TR-CO-03](../../requirements/technical/03-collections.md#tr-co-03)), also with the token of the User. It is called by query, with the token of the User for what they may see and their Requests, and with query's own Google ID token for what it tells about its Lenses (`DATAHUB_QUERY_SERVICE_ACCOUNT`); catalogue never calls query.

To notify, it asks identity which members of an Owner Unit and of the Data Team Data Hub knows, with its own Google ID token for identity's address ([TR-LN-02](../../requirements/technical/07-log-and-notifications.md#tr-ln-02)); it sends e-mail to `smtp-relay.gmail.com` (`DATAHUB_SMTP_HOST`) from `DATAHUB_MAIL_FROM`, to the group of the Data Team at `DATAHUB_DATA_TEAM_EMAIL`, all its traffic leaving from the fixed address of the network `datahub` through Cloud NAT ([TR-LN-03](../../requirements/technical/07-log-and-notifications.md#tr-ln-03)); and it calls the Web API of Slack with the bot token of `datahub-slack-bot-token` (`DATAHUB_SLACK_BOT_TOKEN`) ([TR-LN-04](../../requirements/technical/07-log-and-notifications.md#tr-ln-04)). Its links go to the web app at `DATAHUB_WEB_URL`. Cloud Scheduler calls it as `datahub-scheduler` (`DATAHUB_SCHEDULER_SERVICE_ACCOUNT`).

## Permissions

See [TR-PF-11](../../requirements/technical/00-platform.md#tr-pf-11): Cloud SQL client, and the reader of the secret `datahub-slack-bot-token`.
