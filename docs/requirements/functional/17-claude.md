# Claude

| | |
| --- | --- |
| Domain | 17 of Data Hub · code `CL` |
| Status | To be specified: Resources and queries first, the other assets chapter by chapter. Built on 2026-11-01, at the request of Max, ahead of version 2 |
| Version | 2: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)), so every requirement and open point in this file is *Could, not in v1* |
| Source of truth | This file |
| Origin | Asked by Max on 2026-10-29: the going-over of every endpoint that [DEC-CH-02](13-channels.md#dec-ch-02) foresees for version 2 |

**In one sentence:** Claude works with Data Hub through its MCP server, as the signed-in User: it finds, reads, previews, queries and helps describe what that User may, explains the concepts of Data Hub with its Learning Cards, and leaves what a person must see or decide to an MCP App in the conversation.

*Functional domain 17 of Data Hub. Overview of all domains: [Functional domains](README.md). Which asset reaches which channel is in [Channels](13-channels.md); this file works out the channel Claude, endpoint by endpoint, starting with Resources.*

In library terms: Claude is an assistant in the reading room who carries the library card of the reader who asked. It fetches only what that reader may borrow, reads out the catalogue card with its Level, and lets the reader sign for themselves wherever a signature is needed.

## Decisions

- <a id="dec-cl-01"></a>**DEC-CL-01** · Through the MCP, Claude does everything a User does with a Resource in Data Hub except the work of the Data Admin: it finds, reads, previews, describes, publishes, deprecates, marks changes seen and discusses. Adding Resources to a Collection, moving or removing them, recording their grain and mappings, and the Resources without a Collection stay in the web app. *Decided on 2026-10-30, by Max.*
- <a id="dec-cl-02"></a>**DEC-CL-02** · Whether a tool answers Claude in text or shows the User an MCP App is decided per tool, in this file; Resources get both. *Decided on 2026-10-30, by Max ("mixed, to be worked out in the analysis").*
- <a id="dec-cl-03"></a>**DEC-CL-03** · Claude can list everything a User sees, not only find what shares words with a question. *Decided on 2026-10-30, by Max.*
- <a id="dec-cl-04"></a>**DEC-CL-04** · The MCP server comes with a how-to-use: what Claude can do in Data Hub for this User, and how to ask for it. *Decided on 2026-10-30, by Max.*
- <a id="dec-cl-05"></a>**DEC-CL-05** · Claude through the MCP is a domain of its own, this file, because it touches every asset; [Channels](13-channels.md) keeps the overview of which asset reaches which channel. *Decided on 2026-10-30: Max left the place to the analysis.*
- <a id="dec-cl-06"></a>**DEC-CL-06** · The rows of a Preview, and later of a query, go into the conversation with Claude, for every Resource the User sees: no Collection and no Level is kept from Claude. What the User may see, Claude may read for them. *Decided on 2026-10-31, by Max ([OP-CL-06](#op-cl-06)).*
- <a id="dec-cl-07"></a>**DEC-CL-07** · What the User approves, sends or publishes in Claude, they do with a button in the MCP App that only the MCP App can use, never Claude: "Approve and run" between 100 MB and 1 GB, the Request above 1 GB, and "Publish and confirm". Where the client cannot show an MCP App, Claude offers "Open in Data Hub" instead. *Decided on 2026-10-31, by Max ([OP-CL-02](#op-cl-02)).*
- <a id="dec-cl-08"></a>**DEC-CL-08** · The Log says when a change was made through Claude: "through Claude" next to the name of the User, for a Business Description, a deprecation, changes marked seen, a Message and a Publication in an MCP App, so that the Owner knows the words were drafted by Claude for that User. *Decided on 2026-10-31, by Max ([OP-CL-05](#op-cl-05)).*
- <a id="dec-cl-09"></a>**DEC-CL-09** · The how-to-use lives in Claude only; the web app gets none of its own for Claude. *Decided on 2026-10-31, by Max.*
- <a id="dec-cl-10"></a>**DEC-CL-10** · A Lens first: before Claude writes a new query, it looks for the Lenses on its Resources and offers one that answers the question, as a new query in Query does ([FR-SR-47](04-stacks-and-resources.md#fr-sr-47)). *Decided on 2026-11-01, by Max.*
- <a id="dec-cl-11"></a>**DEC-CL-11** · A query made through Claude, and a run of a query or a Preview through Claude, is marked so: the panel of Query labels it Claude, and the Query Log keeps where it came from. *Decided on 2026-11-01, by Max.*
- <a id="dec-cl-12"></a>**DEC-CL-12** · The Data Team can list the queries of everyone through Claude, with who ran them and their SQL, as it can in Query ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)). *Decided on 2026-11-01, by Max.*
- <a id="dec-cl-13"></a>**DEC-CL-13** · The result of a query shows in an MCP App: the grid of Query, with "Open in Query". *Decided on 2026-11-01, by Max.*

## Terms

| Term | Meaning |
| --- | --- |
| tool | One action the MCP server offers Claude, such as reading a Resource. Ordinary word |
| get tool, show tool | A tool that answers Claude in text, and a tool that shows the User an MCP App ([FR-CL-01](#fr-cl-01)). Ordinary words |
| MCP App | An interactive window in the conversation in Claude, drawn by Data Hub with the components of the web app ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15)) and without its navigation ([DEC-LR-08](16-learning.md#dec-lr-08)). The name of an extension of MCP, not a Defined Term of Data Hub |
| server instructions | The text the MCP server gives Claude when it connects, which Claude keeps for the whole conversation. Ordinary words |

## How Claude works with Data Hub

1. **Connect.** The User adds Data Hub as a connector in Claude and signs in with Google through identity ([TR-PF-06](../technical/00-platform.md#tr-pf-06)). Claude stays connected for 30 days after its last use ([DEC-PF-18](../technical/00-platform.md#dec-pf-18)).
2. **Learn the house rules.** On connecting, Claude receives the server instructions: what Data Hub is, its concepts, and the rules of this file ([FR-CL-14](#fr-cl-14)).
3. **Ask.** The User asks in their own words. Claude picks the tools; each runs as the User, with their Access Token, and sees exactly what they see in the web app ([FR-CH-03](13-channels.md#fr-ch-03), [TR-PF-05](../technical/00-platform.md#tr-pf-05)).
4. **Answer.** Claude answers from what the tools return, names the Level of every Resource it uses, and links to its page in Data Hub.
5. **Show.** Where the User should see something rather than read about it, or must decide, a show tool opens an MCP App in the conversation.
6. **Decide.** Claude writes a change it prepared only after the User agrees to it. A change that cannot be undone, and the approval of a query that reads a lot, are given by the User in an MCP App, never by Claude.

## Resources through the MCP

Every endpoint around Resources, with the tool that answers it. Who may use a tool follows who may call its endpoint: Claude never sees or does more than the User ([FR-SR-31](04-stacks-and-resources.md#fr-sr-31)).

### Find

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "What can I see?" | `list_resources` | catalogue `GET /resources`, to add ([FR-CL-04](#fr-cl-04)) | Every User | Text |
| "Is there anything on leads?" | `search` | catalogue `GET /search` ([FR-CO-37](03-collections.md#fr-co-37)) | Every User | Text |

### Read

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "What is in Agency purity?" | `get_resource` | catalogue `GET /resources/:id`, query `GET /resources/:id/storage` | Whoever sees it | Text |
| "Show me Agency purity" | `show_resource` | The same | Whoever sees it | MCP App: the Resource Card ([FR-CL-07](#fr-cl-07)) |
| "Where does it come from?" | `get_resource_lineage` | catalogue `GET /resources/:id/lineage` | Whoever sees it | Text |
| "What can I join it with?" | `get_related_resources` | catalogue `GET /resources/:id/related` | Whoever sees it | Text |
| "What happened to it lately?" | `get_resource_log` | catalogue `GET /resources/:id/log` | Whoever sees it | Text |
| "Who queries it?" | `get_resource_queries` | query `GET /resources/:id/queries` | Owner Unit and Data Team ([DEC-SR-41](04-stacks-and-resources.md#dec-sr-41)) | Text |

### Look at the data

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "Show me some rows of last week" | `preview_resource` | query `POST /resources/:id/preview/choices`, `…/preview/preflight`, `…/preview/runs` and `…/preview/requests` | Whoever sees it | MCP App: the Preview ([FR-CL-09](#fr-cl-09)) |
| "And the next 100?" | `get_result_page` | query `GET /runs/:ref/rows` | Who ran it | Text |

### Describe

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "Write a Business Description for it" | `update_resource_card` | catalogue `PATCH /resources/:id` | Owner Unit and Data Team | Text, written after the User agrees ([FR-CL-10](#fr-cl-10)) |
| "Describe its fields" | `describe_fields` | catalogue `PUT /resources/:id/fields` | Owner Unit and Data Team | Text, written after the User agrees |
| "I've seen what changed" | `mark_changes_seen` | catalogue `POST /resources/:id/changes/seen` | Owner Unit and Data Team | Text, after the User agrees ([FR-CL-11](#fr-cl-11)) |

### Publish and deprecate

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "Publish it" | `publish_resource` | catalogue `POST /resources/:id/publication` | A member of the Owner Unit ([FR-SR-16](04-stacks-and-resources.md#fr-sr-16)) | MCP App: the publication, which only the User completes ([FR-CL-12](#fr-cl-12)) |
| "Deprecate it, use X instead" | `deprecate_resource` | catalogue `PUT /resources/:id/deprecation` | Owner Unit and Data Team | Text, after the User agrees ([FR-CL-11](#fr-cl-11)) |
| "Take the deprecation away" | `undeprecate_resource` | catalogue `DELETE /resources/:id/deprecation` | Owner Unit and Data Team | Text, after the User agrees |

### Discuss

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "Did anyone ask about this?" | `get_messages` | catalogue `GET /messages/on/resource/:id`, `GET /messages/:id` | Whoever sees it | Text |
| "Ask the Owner why March is missing" | `write_message` | catalogue `POST /messages` | Whoever sees it | Text, posted after the User agrees ([FR-CL-13](#fr-cl-13)) |
| "Answer that it is fixed" | `reply_to_message` | catalogue `POST /messages/:id/replies` | Whoever sees the Message | Text, posted after the User agrees |

### Concepts and how-to-use

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "What is a Lens?" | `explain` | The Learning Cards in `packages/learning` ([TR-LR-01](../technical/16-learning.md#tr-lr-01)) | Every User | Text, with the card ([FR-CL-15](#fr-cl-15)) |
| "Show me that card" | `show_learning_card` | The same | Every User | MCP App: the steps of the card ([FR-LR-26](16-learning.md#fr-lr-26)) |
| "What can you do in Data Hub?" | `how_to_use` | None: the MCP server itself, with the roles of the User | Every User | Text; also a prompt in the menu of Claude ([FR-CL-16](#fr-cl-16)) |
| "Who am I in Data Hub?" | `who_am_i` | The Access Token | Every User | Text; built |

### Not through the MCP

| Endpoint | What it does | Why not |
| --- | --- | --- |
| catalogue `GET /resources?collection=none` | The Resources without a Collection | The work of the Data Admin ([DEC-CL-01](#dec-cl-01)) |
| catalogue `POST /collections/:id/resources`, `PUT` and `DELETE /resources/:id/collection` | Adding Resources to a Collection, moving and removing them ([FR-CO-31](03-collections.md#fr-co-31)) | The work of the Data Admin |
| catalogue `PUT /resources/:id/details`; registry `GET /nodes/:id/proposal`, `GET /domain-model` | The grain, partition, cluster and mappings of a Resource | The work of the Data Admin |
| catalogue `POST /internal/resources`; registry `GET /internal/nodes/:id/lineage`, `POST /webhooks/dbt-cloud` | Calls between services and from dbt Cloud | No User calls them |
| registry `GET /projects`, `/runs`, `/nodes`, `/nodes/:id`, `/nodes/:id/lineage`, `POST /runs/:runId/reprocess` | The dbt projects, their runs and their Nodes | The plumbing of the Data Team, not the Resources |

Claude answers a question about these with where in Data Hub it happens and who does it ([FR-CL-03](#fr-cl-03)).

## Queries through the MCP

Free SQL over the Resources a User sees ([FR-SR-26](04-stacks-and-resources.md#fr-sr-26)), through the same endpoints as Query in the web app ([FR-SR-41](04-stacks-and-resources.md#fr-sr-41)). A query Claude makes is a query of the User: it is in their panel of Query at once, and they can go on with it there.

### Build a query

| Step | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| 1 · Find the Resources | `list_resources`, `search` | catalogue `GET /resources`, to add ([FR-CL-04](#fr-cl-04)); `GET /search` | Every User | Text |
| 2 · Know them: fields, partition, grain, what joins | `get_resource`, `get_related_resources` | catalogue `GET /resources/:id`, `GET /resources/:id/related`; query `GET /resources/:id/storage` | Whoever sees them | Text |
| 3 · A Lens first | `suggest_lenses` | query `GET /lenses/suggestions` | Every User | Text ([FR-CL-17](#fr-cl-17)) |
| 4 · Make the query | `create_query` | query `POST /queries` | Every User | Text ([FR-CL-18](#fr-cl-18)) |
| 5 · Check it until it can run | `check_query` | query `POST /queries/:id/preflight` | Its author | Text ([FR-CL-19](#fr-cl-19)) |
| 6 · Run it | `run_query` | query `POST /queries/:id/runs`, `POST /queries/:id/requests`; catalogue `GET /requests` | Its author | MCP App: the result ([FR-CL-20](#fr-cl-20), [FR-CL-21](#fr-cl-21)) |
| 7 · Read further | `get_result_page` | query `GET /runs/:ref/rows` | Who ran it | Text |

### Find and change a query

| The User asks | Tool | Endpoint | Who | Answer |
| --- | --- | --- | --- | --- |
| "What did I query last week?" | `list_queries` | query `GET /queries` | Every User their own; the Data Team everyone's ([DEC-CL-12](#dec-cl-12)) | Text ([FR-CL-23](#fr-cl-23)) |
| "Show me that query again" | `show_query` | query `GET /queries/:id`, `GET /runs/:ref/rows` | Its author and the Data Team | MCP App: the result ([FR-CL-21](#fr-cl-21)) |
| "What did it give before?" | `get_query` | query `GET /queries/:id`, `GET /queries/:id/runs` | Its author and the Data Team | Text |
| "Call it Partner share per week" | `update_query` | query `PATCH /queries/:id` | Its author | Text |

### Not through the MCP, for queries

| Endpoint | What it does | Why not |
| --- | --- | --- |
| query `PUT` and `DELETE /queries/:id/hidden` | Hiding a query from the panel of Query, and showing it again | A matter of the panel of Query |
| query `GET /queries/days` | How many queries each day holds | The periods and chips of the panel of Query |
| query and catalogue `/internal/…` | Calls between services and from Cloud Scheduler | No User calls them |

## Requirements

<a id="fr-cl-01"></a>
### FR-CL-01 · A tool either informs Claude or shows the User

**Status:** Implemented · **Screens:** [mcp-resource](../../design/screens/mcp-resource.html), [mcp-resource-preview](../../design/screens/mcp-resource-preview.html), [mcp-resource-publish](../../design/screens/mcp-resource-publish.html), [mcp-query](../../design/screens/mcp-query.html)

A get tool, and a tool that lists or searches, answers Claude in text with structured data, for Claude to reason with and to write its answer from. A show tool opens an MCP App with the same data for the User, when the User asks to see the object or must decide something; Claude gets a short account of what it showed. Where the client of the User cannot show an MCP App, a show tool answers in text with a link to the same place in Data Hub. This works out [DEC-CL-02](#dec-cl-02).

*Note of 2026-11-01, on building it: the MCP App is one page, with the values of `docs/design/tokens.css`, checked by a test; it is plain HTML rather than the components of `packages/ui`, which would need a build of their own for it ([DEC-PF-28](../technical/00-platform.md#dec-pf-28)).*

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-02"></a>
### FR-CL-02 · Claude sees what the User sees, and nothing it may not

**Status:** Implemented · **Screens:** [mcp-resource](../../design/screens/mcp-resource.html)

Every tool runs as the signed-in User, with their Access Token, through the same endpoints as the web app. An object the User may not see answers as one that does not exist ([FR-CO-17](03-collections.md#fr-co-17), [FR-SR-31](04-stacks-and-resources.md#fr-sr-31)): Claude says it found nothing it may show, never that something exists but is hidden, and never guesses at what it might hold.

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-03"></a>
### FR-CL-03 · Claude says where in Data Hub what it cannot do happens

**Status:** Implemented · **Screens:** [mcp-resource-publish](../../design/screens/mcp-resource-publish.html)

When a User asks for what Claude has no tool for, the work of the Data Admin ([DEC-CL-01](#dec-cl-01)), or for what the User may not do, such as publishing a Resource of an Owner Unit they are not in ([FR-SR-16](04-stacks-and-resources.md#fr-sr-16)), Claude says what happens where and by whom, and links to the page in Data Hub. It does not look for another way to do it.

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-04"></a>
### FR-CL-04 · Everything a User sees, in one list

**Status:** Implemented

`list_resources` lists every Resource the User sees, by Collection: its Display Name, its Level, whether it is deprecated, and the first sentence of its description. For the Owner Unit and the Data Team it lists the Resources that are not published or are withdrawn too, marked so. It can be narrowed to one Collection. Unlike the search, it needs no words and has no limit of 20 ([FR-CO-37](03-collections.md#fr-co-37)). catalogue has no endpoint for it yet ([OP-CL-03](#op-cl-03)). This works out [DEC-CL-03](#dec-cl-03).

*Note of 2026-11-01, on building it: mcp lists them from `GET /collections` of catalogue, which gives the Resources the User sees in each Collection, so no new endpoint was needed ([OP-CL-03](#op-cl-03)); the first sentence of the descriptions comes when the list is narrowed to one Collection.*

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-05"></a>
### FR-CL-05 · Every answer about a Resource names its Level and its state

**Status:** Implemented · **Screens:** [mcp-resource](../../design/screens/mcp-resource.html), [mcp-resource-preview](../../design/screens/mcp-resource-preview.html), [mcp-resource-publish](../../design/screens/mcp-resource-publish.html), [mcp-query](../../design/screens/mcp-query.html)

Whenever Claude uses a Resource, in a list, an answer or a query, it names its Level ([DEC-MR-06](06-maturity-and-release.md#dec-mr-06)) and, when it is deprecated, why and what to use instead ([FR-SR-50](04-stacks-and-resources.md#fr-sr-50)). To its Owner Unit and the Data Team it also says when the Resource is not published or is withdrawn ([DEC-SR-26](04-stacks-and-resources.md#dec-sr-26)). Every tool returns these with the Resource, so Claude needs no second call for them.

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-06"></a>
### FR-CL-06 · Every answer about an object links to it in Data Hub

**Status:** Implemented · **Screens:** [mcp-resource](../../design/screens/mcp-resource.html), [mcp-resource-preview](../../design/screens/mcp-resource-preview.html), [mcp-resource-publish](../../design/screens/mcp-resource-publish.html), [mcp-query](../../design/screens/mcp-query.html)

Each tool that returns an object returns the address of its page in Data Hub, at the tab that matches what was asked: Overview, Columns, Lineage, History or Preview. Claude gives it with its answer, and every MCP App carries "Open in Data Hub" in place of the navigation of Data Hub ([components](../../design/components.md)).

*Note of 2026-11-01, on building it: the pages of the web app have no address per tab, so the link opens the page of the object.*

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-07"></a>
### FR-CL-07 · Reading a Resource

**Status:** Implemented · **Screens:** [mcp-resource](../../design/screens/mcp-resource.html)

`get_resource` gives Claude the Resource Card: its Display Name and Key, its Collection and Owner Unit, its Level and Publication; the description of the table and of every field, the Business Description and the one from dbt each marked with where it comes from ([FR-RC-18](05-resource-card.md#fr-rc-18)); the fields left out; its grain, its partition and cluster columns with a sentence on how to query it cheaply, and its size ([FR-SR-39](04-stacks-and-resources.md#fr-sr-39)); its intended use, pitfalls, Known Gaps and since when it is reliable; its key fields and Parameters; and the changes since its last Confirmation ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)). `show_resource` shows the same to the User as an MCP App, with its Overview and Columns.

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-08"></a>
### FR-CL-08 · Lineage, related Resources, Log and queries

**Status:** Implemented

`get_resource_lineage` gives the models up- and downstream of a Resource with their layers and projects, and which of them are Resources the User sees ([FR-SR-54](04-stacks-and-resources.md#fr-sr-54)). `get_related_resources` gives, for each mapped field, the other Resources the User sees that carry the same identity, so that Claude knows what to join on ([FR-RC-09](05-resource-card.md#fr-rc-09)). `get_resource_log` gives its Log, newest first ([FR-RC-05](05-resource-card.md#fr-rc-05)). `get_resource_queries` gives its Owner Unit and the Data Team the queries on it ([FR-SR-44](04-stacks-and-resources.md#fr-sr-44)).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-09"></a>
### FR-CL-09 · A Preview in the conversation, with its Pre-flight

**Status:** Implemented · **Screens:** [mcp-resource-preview](../../design/screens/mcp-resource-preview.html)

`preview_resource` opens the Preview of a Resource as an MCP App: its Parameters and window as on its page ([FR-SR-38](04-stacks-and-resources.md#fr-sr-38)), the Pre-flight ([FR-SR-36](04-stacks-and-resources.md#fr-sr-36)) and the first page of 100 rows ([FR-SR-51](04-stacks-and-resources.md#fr-sr-51)). Claude chooses the Parameters from the question, and the User can change them in the MCP App. Up to 100 MB it runs at once, and Claude gets the rows as well, for every Resource the User sees ([DEC-CL-06](#dec-cl-06)). From 100 MB to 1 GB the MCP App shows what it reads, and it runs only once the User approves it there. Above 1 GB the MCP App offers to send a Request to the Data Team ([DEC-SR-29](04-stacks-and-resources.md#dec-sr-29), [MSG-QRY-01](message-catalogue.md#msg-qry-01)). Claude itself can neither approve a run nor send a Request ([DEC-CL-07](#dec-cl-07)). Every run goes into the Query Log ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)), and nothing is exported ([FR-CH-01](13-channels.md#fr-ch-01)).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-10"></a>
### FR-CL-10 · Claude helps the Owner describe a Resource

**Status:** Implemented

For its Owner Unit and the Data Team, Claude can write what Data Hub keeps about a Resource: its Business Description and those of its fields, its intended use, pitfalls, Known Gaps, since when it is reliable, its key fields and Parameters ([FR-RC-15](05-resource-card.md#fr-rc-15), [FR-RC-16](05-resource-card.md#fr-rc-16)). Claude first shows what it will write, field by field, next to what is there now, and writes only after the User agrees; the Log names the User, through Claude ([DEC-CL-08](#dec-cl-08)). A Business Description of the table is written from Described on, as in the web app.

*Note of 2026-11-01, on building it: "through Claude" in the Log ([DEC-CL-08](#dec-cl-08)) is not built yet: the Access Token does not say through which client a User came, so catalogue cannot tell ([OP-CL-10](#op-cl-10)). The same holds for [FR-CL-11](#fr-cl-11), [FR-CL-12](#fr-cl-12) and [FR-CL-13](#fr-cl-13).*

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-11"></a>
### FR-CL-11 · Marking changes seen, deprecating and taking it back

**Status:** Implemented

For its Owner Unit and the Data Team, Claude can mark the changes since the last Confirmation seen ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)), deprecate a published Resource with the reason of the User and, if any, what to use instead, and take the deprecation away again ([FR-SR-50](04-stacks-and-resources.md#fr-sr-50)). Claude first says what will change and who will see it, as a deprecation shows to everyone who sees the Resource, and acts only after the User agrees; the Log names the User, through Claude ([DEC-CL-08](#dec-cl-08)).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-12"></a>
### FR-CL-12 · The Owner publishes in the MCP App, not Claude

**Status:** Implemented · **Screens:** [mcp-resource-publish](../../design/screens/mcp-resource-publish.html)

`publish_resource` opens the same publication as the page of the Resource ([FR-SR-49](04-stacks-and-resources.md#fr-sr-49)): who will see it once published, what Data Hub checked, that the User may publish it ([FR-SR-16](04-stacks-and-resources.md#fr-sr-16)) and that it is Described ([FR-SR-17](04-stacks-and-resources.md#fr-sr-17)), and the declaration with "Publish and confirm" ([DEC-UX-63](../../design/principles.md#dec-ux-63)). Only the click of the User publishes, on a button Claude cannot use ([DEC-CL-07](#dec-cl-07)), as a Publication cannot be undone ([DEC-SR-28](04-stacks-and-resources.md#dec-sr-28)); the Log says it was published through Claude ([DEC-CL-08](#dec-cl-08)). Claude can prepare it: check whether the Resource is ready, and say what is missing when it is not.

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-13"></a>
### FR-CL-13 · Messages on a Resource, through Claude

**Status:** Implemented

`get_messages` gives the Messages on a Resource with their replies, newest first, in their laid-out text ([FR-CV-04](14-conversations.md#fr-cv-04), [FR-CV-15](14-conversations.md#fr-cv-15)). `write_message` places a Question, Remark or Signal on it ([DEC-SR-20](04-stacks-and-resources.md#dec-sr-20)), and `reply_to_message` replies in a conversation. A Message is never private and reaches the Owner, and a Signal the Data Team ([DEC-CV-04](14-conversations.md#dec-cv-04)), so Claude first shows its kind and its exact text, and posts it under the name of the User only after the User agrees; its Log Entry says it came through Claude ([DEC-CL-08](#dec-cl-08)).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-14"></a>
### FR-CL-14 · Claude knows the concepts of Data Hub from the start

**Status:** Implemented

The server instructions tell Claude what Data Hub is, its concepts in a sentence or two each, and the rules of this file, [FR-CL-02](#fr-cl-02) to [FR-CL-13](#fr-cl-13). The concepts are those a User meets: Collection and Owner Unit; Resource, its Level, Publication and Confirmation, deprecated and withdrawn; the Data Team; Query and the Pre-flight; Lens; Message; Learning Card and the Learning Centre. The sentences of each concept are the core idea of the Learning Card that explains it in the Compass, so that Claude and Data Hub say the same ([DEC-CH-04](13-channels.md#dec-ch-04)). The MCP server reads them from the Learning Cards in `packages/learning`, as the web app does ([TR-LR-01](../technical/16-learning.md#tr-lr-01)); which card explains which concept is [OP-CL-07](#op-cl-07).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-15"></a>
### FR-CL-15 · Claude explains a concept with its Learning Card

**Status:** Implemented

`explain` gives, for a concept of Data Hub, a name such as `creditLead` ([FR-LR-37](16-learning.md#fr-lr-37)) or a term of the Glossary, the Learning Cards that explain it: their number and title, the core idea, what knowing it brings, and their address in the Learning Centre. Claude answers with the core idea and offers the card; `show_learning_card` shows its steps as an MCP App ([FR-LR-26](16-learning.md#fr-lr-26)). It lists only the cards that are written, as a pop-out does ([DEC-LR-28](16-learning.md#dec-lr-28)). Claude does not make up a definition of its own for a concept Data Hub explains.

*Note of 2026-11-01, on building it: `explain` reads the written cards of `packages/learning`; `show_learning_card`, the steps of a card as an MCP App ([FR-LR-26](16-learning.md#fr-lr-26)), is not built yet.*

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-16"></a>
### FR-CL-16 · How to use Data Hub with Claude

**Status:** Implemented

`how_to_use` tells the User what Claude can do for them in Data Hub, by what they may: every User finds, reads, previews, queries and discusses; the Owner Unit of a Collection also describes, publishes and deprecates its Resources. Each part comes with three example questions, and with what stays in the web app ([FR-CL-03](#fr-cl-03)). It is offered as a prompt in the menu of Claude, "Start with Data Hub", and Claude calls it when the User asks what it can do. This works out [DEC-CL-04](#dec-cl-04); it lives in Claude only ([DEC-CL-09](#dec-cl-09)).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-17"></a>
### FR-CL-17 · A Lens first, then a query

**Status:** Implemented · **Screens:** [mcp-query](../../design/screens/mcp-query.html)

Before Claude writes a new query, `suggest_lenses` gives the Lenses that use its Resources: first those on exactly these Resources, then those on these and more, only Lenses that run now ([FR-SR-47](04-stacks-and-resources.md#fr-sr-47), [DEC-SR-43](04-stacks-and-resources.md#dec-sr-43)), in each group those that share most words with the question first ([FR-SR-48](04-stacks-and-resources.md#fr-sr-48)). When one answers the question, Claude offers it, with what it shows and a link to it, and writes a query only when the User wants their own. Running a Lens through Claude is the chapter Lenses. This works out [DEC-CL-10](#dec-cl-10).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-18"></a>
### FR-CL-18 · Claude makes a query on the Resources it needs

**Status:** Implemented · **Screens:** [mcp-query](../../design/screens/mcp-query.html)

`create_query` makes a query of the User, with a name, the question in the words of the User, and the 1 to 10 Resources it reads ([FR-SR-45](04-stacks-and-resources.md#fr-sr-45), [DEC-UX-73](../../design/principles.md#dec-ux-73)). It reads only those, so Claude chooses them before it writes the SQL; when it needs another Resource, it makes a new query started from this one, as Query does. The query is in the panel of Query of the User at once.

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-19"></a>
### FR-CL-19 · Claude checks the SQL until it can run

**Status:** Implemented · **Screens:** [mcp-query](../../design/screens/mcp-query.html)

`check_query` keeps the SQL and its Parameters, and gives the Pre-flight ([FR-SR-36](04-stacks-and-resources.md#fr-sr-36)): whether it can run, what it reads and in which range, how many partitions, what keeps it from running and what it warns about. Claude fixes what the Pre-flight names: a table outside the Resources of the query, a Parameter that is not defined ([DEC-UX-71](../../design/principles.md#dec-ux-71)), a filter a partition column requires ([DEC-SR-35](04-stacks-and-resources.md#dec-sr-35)), and what BigQuery refuses in its own words. Where the Pre-flight warns that a partition column is not filtered ([FR-SR-40](04-stacks-and-resources.md#fr-sr-40)), Claude adds a filter, unless the User needs every partition. Claude also follows what the Resource Card says, such as a week that is not complete yet. It never runs a query the Pre-flight says cannot run.

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-20"></a>
### FR-CL-20 · Claude runs a query within the same limits as Query

**Status:** Implemented · **Screens:** [mcp-query](../../design/screens/mcp-query.html)

`run_query` runs the query as its author, with the checks of Query again, a byte limit and a label with the User ([FR-SR-27](04-stacks-and-resources.md#fr-sr-27), [FR-SR-41](04-stacks-and-resources.md#fr-sr-41)). Up to 100 MB it runs at once, and Claude gets the first 100 rows ([DEC-CL-06](#dec-cl-06)). From 100 MB to 1 GB the User approves it in the MCP App, and above 1 GB sends a Request to the Data Team there ([DEC-SR-29](04-stacks-and-resources.md#dec-sr-29), [DEC-CL-07](#dec-cl-07)). Once the Data Team accepted a Request, the query runs above 1 GB for its author, also after its SQL changed ([DEC-SR-36](04-stacks-and-resources.md#dec-sr-36)); while a Request waits, Claude says since when, and sends no second one. Every run goes into the Query Log with its Query ID ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-21"></a>
### FR-CL-21 · The result of a query in an MCP App

**Status:** Implemented · **Screens:** [mcp-query](../../design/screens/mcp-query.html)

`run_query` and `show_query` show the result as an MCP App: the name and question of the query, the Resources it reads with their Level, the grid of Query with 100 rows a page read from the same run ([FR-SR-51](04-stacks-and-resources.md#fr-sr-51)), what it read, its Query ID, the SQL to look at, folded, and "Open in Query". The SQL and the Parameters are not edited in the MCP App: the User asks Claude, or goes on in Query ([OP-CL-09](#op-cl-09)). This works out [DEC-CL-13](#dec-cl-13).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-22"></a>
### FR-CL-22 · A query through Claude is marked so

**Status:** Proposed · **Screens:** [mcp-query](../../design/screens/mcp-query.html)

A query made through Claude, and every run through Claude of a query or a Preview, is marked so ([DEC-CL-11](#dec-cl-11)): the panel of Query labels it Claude ([FR-SR-43](04-stacks-and-resources.md#fr-sr-43), [DEC-UX-74](../../design/principles.md#dec-ux-74)), so does the tab History of the Resources it reads ([FR-SR-44](04-stacks-and-resources.md#fr-sr-44)), and the Query Log keeps it. query keeps no such mark yet ([OP-CL-10](#op-cl-10)).

*Note of 2026-11-01: not built with the other tools; it needs the client in the Access Token, a mark in query and a label in the panel of Query ([OP-CL-10](#op-cl-10)).*

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-cl-23"></a>
### FR-CL-23 · Finding a query again, and everyone's for the Data Team

**Status:** Implemented

`list_queries` lists the queries of the User, newest first, narrowed by a period or by words, each with what it ran on, how many runs it has, and whether it went to the Data Team ([FR-SR-43](04-stacks-and-resources.md#fr-sr-43)). `get_query` gives one with its SQL, Resources, Parameters, last runs, Request, whether it is Broken and the Lens made of it. `update_query` changes its name, question, SQL or Parameters, for its author. For the Data Team, `list_queries` also lists the queries of everyone, with who ran them and their SQL, as in Query ([DEC-CL-12](#dec-cl-12)); nobody else sees the queries of others ([DEC-LN-01](07-log-and-notifications.md#dec-ln-01)).

*Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

## Edge cases

<a id="ec-cl-01"></a>
### EC-CL-01 · A service of Data Hub does not answer

**Status:** Implemented

When catalogue, query or BigQuery does not answer, the tool says so, and Claude tells the User that Data Hub could not answer and to try again in a moment. It never answers from memory, nor from an earlier answer in the conversation as if that were current.

<a id="ec-cl-02"></a>
### EC-CL-02 · What the User may see changes during a conversation

**Status:** Implemented

Every tool reads anew, with the Access Token of that moment. Once identity renews it with other Groups ([DEC-PF-18](../technical/00-platform.md#dec-pf-18)), the next call answers as the User is now. Claude treats what it read earlier in the conversation as possibly out of date, and reads again before relying on it.

<a id="ec-cl-03"></a>
### EC-CL-03 · Someone else changes a Resource while Claude prepares a change

**Status:** Implemented

Just before it writes, Claude reads the Resource again. When what it would replace has changed since it showed its proposal, it shows the User the new text and asks again, so that it never overwrites the work of a colleague unseen.

<a id="ec-cl-04"></a>
### EC-CL-04 · A query of the User is Broken

**Status:** Implemented

When a Resource or a column a query reads no longer exists, its Pre-flight and the query say so ([FR-SR-52](04-stacks-and-resources.md#fr-sr-52), [FR-SR-53](04-stacks-and-resources.md#fr-sr-53)). Claude tells the User what is missing, and does not work around it by reading a table outside the Resources of the query.

<a id="ec-cl-05"></a>
### EC-CL-05 · The result of a run is no longer kept

**Status:** Implemented

BigQuery keeps a result for a limited time; a page asked after that answers that it is gone. Claude says so, and offers to run the query again, through the Pre-flight and its ranges like every run.

## Out of scope

- The work of the Data Admin ([DEC-CL-01](#dec-cl-01)): it stays in the web app.
- Collections, Lenses, including making a query a Lens, the Message Centre and the Learning Centre: the next chapters of this file.
- Excel and the HTML report: [Channels](13-channels.md).

## Open points

- [ ] <a id="op-cl-01"></a>**OP-CL-01** · Confirm per tool whether it answers in text, in an MCP App or both, as proposed in [Resources through the MCP](#resources-through-the-mcp), once the MCP Apps of Resources are drawn: the Resource Card, the Preview and the publication. *Raised on 2026-10-30, in working out [DEC-CL-02](#dec-cl-02).* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [x] <a id="op-cl-02"></a>**OP-CL-02** · Decide how the User approves a Preview between 100 MB and 1 GB, sends a Request, and publishes in Claude: with a button in the MCP App that only the MCP App can use and Claude cannot, or with a question the MCP server asks through Claude. Proposal: the button in the MCP App; where the client cannot show one, "Open in Data Hub". *Raised on 2026-10-30.* *Decided on 2026-10-31, by Max: the button in the MCP App, as proposed ([DEC-CL-07](#dec-cl-07)).* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [ ] <a id="op-cl-03"></a>**OP-CL-03** · Decide the endpoint of the list of [FR-CL-04](#fr-cl-04): `GET /resources` of catalogue for everything the User sees, next to `collection=none` for the Data Team. Decide too whether the web app shows the same list, for example on the start screen of Collections. *Raised on 2026-10-30.* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [ ] <a id="op-cl-04"></a>**OP-CL-04** · Decide how a Preview through Claude shows in the panel of Query and the tab History of the Resource. A query of Claude is an item of its own ([DEC-UX-74](../../design/principles.md#dec-ux-74)); a Preview through Claude could be a run of the previews of the Resource by the User, labelled Claude. Proposal: that run, labelled Claude. *Raised on 2026-10-30.* *Note of 2026-11-01: that a run through Claude is labelled Claude is decided ([DEC-CL-11](#dec-cl-11)); what stays open is whether a Preview through Claude is a run of the previews of the Resource or an item of its own.* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [x] <a id="op-cl-05"></a>**OP-CL-05** · Decide whether the Log says that a change came through Claude: a Business Description, a deprecation, a Message. Proposal: yes, "through Claude" next to the name of the User, so that the Owner knows the words were drafted by Claude for that User. *Raised on 2026-10-30.* *Decided on 2026-10-31, by Max: yes, as proposed ([DEC-CL-08](#dec-cl-08)).* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [x] <a id="op-cl-06"></a>**OP-CL-06** · Decide whether the rows of a Preview, and later of a query, may go into the conversation with Claude, and so to Anthropic, for every Resource, or not for some Collections or Levels. [FR-CH-03](13-channels.md#fr-ch-03) has Claude work with data through the MCP, but does not say which data. *Raised on 2026-10-30.* *Decided on 2026-10-31, by Max: yes, for every Resource the User sees ([DEC-CL-06](#dec-cl-06)).* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [ ] <a id="op-cl-07"></a>**OP-CL-07** · The Learning Centre has no service yet. Decide where `explain` and the concepts in the server instructions read from until it has one, and which Compass cards the Data Team writes for the concepts of [FR-CL-14](#fr-cl-14). Proposal: the server instructions are built from the core ideas of those cards; until they exist, from the Defined Terms. *Raised on 2026-10-30.* *Note of 2026-10-31: the Learning Centre is built. Its cards are files in `packages/learning` ([TR-LR-01](../technical/16-learning.md#tr-lr-01)), and the section K5 Data Hub of the Compass holds K5.1 What a resource is and K5.2 The Level of a Resource ([DEC-LR-30](16-learning.md#dec-lr-30)); the MCP server reads them from there. What stays open is which cards the Data Team writes for the other concepts.* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [ ] <a id="op-cl-08"></a>**OP-CL-08** · Confirm that Claude gets the concepts of Data Hub in its server instructions ([FR-CL-14](#fr-cl-14)) and explains them with the Learning Cards ([FR-CL-15](#fr-cl-15)). *Raised on 2026-10-30, by Max: "shouldn't the MCP add what the concepts are: Collection, Resource, Lens, the Learning Centre with its cards linked?"* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [ ] <a id="op-cl-09"></a>**OP-CL-09** · Decide whether the MCP App of a result lets the User change the values of the Parameters and run again, as on the page of a Lens, or only shows the result ([FR-CL-21](#fr-cl-21)). Proposal: it only shows the result; a change goes through Claude or Query, so that the MCP App stays a window and does not become a second editor. *Raised on 2026-11-01.* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [ ] <a id="op-cl-10"></a>**OP-CL-10** · query keeps no mark of where a query or a run came from: a query is a query, a preview or a Lens ([FR-CL-22](#fr-cl-22)). Decide where the mark lives: on the query, where it was made, and on each run, how it ran. Proposal: both; a query made through Claude and continued in Query keeps the label Claude, and each run says how it ran. *Raised on 2026-11-01.* *Could, not in v1: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

## Builds on

- [Channels](13-channels.md), and [DEC-CH-02](13-channels.md#dec-ch-02) in particular
- [Data Hub overview](../../overview/data-hub.md): the same look in Claude ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15))
- [Resources](04-stacks-and-resources.md), [Resource card](05-resource-card.md), [Maturity and release](06-maturity-and-release.md)
- [Conversations](14-conversations.md), [Learning](16-learning.md)
- The architecture of [mcp](../../architecture/services/mcp.md)
