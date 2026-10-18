# semgraph

| | |
| --- | --- |
| Kind | Backend service on Cloud Run, once it has moved in ([DEC-PF-23](../../requirements/technical/00-platform.md#dec-pf-23)); open to everyone without login, behind a rate limit ([DEC-PF-24](../../requirements/technical/00-platform.md#dec-pf-24)) |
| Code | `services/semgraph`; until the move, the repository `immoscoop-be/immoscoop-ptditt-semgraph` |
| Schema | None: semgraph keeps no data |
| Domains | The chart language, used by [Lenses](../../requirements/functional/09-lenses.md) and [Reports](../../requirements/functional/10-reports.md); its requirements are still in its own repository ([OP-PF-16](../../requirements/technical/00-platform.md#op-pf-16)) |

**In one sentence:** semgraph is the Chart Server: it draws a chart by what it means, such as a moving window average, following the chart language, and refuses a chart that would mislead.

## Responsibilities

- Drawing every chart of Data Hub, for the web app and for Claude, and for other users such as dashboards and documents ([DEC-PF-23](../../requirements/technical/00-platform.md#dec-pf-23))
- Checking a request against the chart language before drawing: what would mislead is refused, what only informs the reader less well is drawn with a warning
- Telling which question each chart answers, with its contract and examples, so a person or Claude can choose

## How a chart is made

The data warehouse computes the values per block, a window or a period, with what the chart asks for: a mean with its standard deviation, a median with its quartiles, and the count. semgraph checks them against the chart language and draws, with title, reading cue and footer. It never computes over days itself, so it can never take an average of averages. Vega-Lite only draws what semgraph hands it.

## API

As semgraph has it today; it may change with the move.

| Endpoint | Purpose |
| --- | --- |
| `GET /semgraphs`, `GET /semgraphs/{id}` | The charts there are, the question each answers, its contract and examples |
| `POST /validate` | Checks a request without drawing |
| `POST /render` | Draws the chart as SVG, or refuses it (422) |
| `GET /openapi.json` | The API in OpenAPI |
| `POST /mcp` | Its MCP server for Claude, with an MCP App that shows the chart in the conversation |

## Talks to

Nothing: the data comes in the request.

## Who may call it

Everyone, worldwide, without login: the web app, Claude, dashboards and documents ([DEC-PF-24](../../requirements/technical/00-platform.md#dec-pf-24)). That is safe because semgraph holds no data and has access to none. A load balancer with Cloud Armor in front of it limits the requests per address, and Cloud Run only accepts traffic through that load balancer ([TR-PF-30](../../requirements/technical/00-platform.md#tr-pf-30)).

## Before the move

Where semgraph runs now is on [Chart server - Environments and documentation](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361412109) (Confluence, Dutch): on AWS, through the internal-tools platform, reachable only internally. What the move has to settle:

- How the code comes in, and how its build and tests join the workspace: [OP-PF-15](../../requirements/technical/00-platform.md#op-pf-15)
- Its requirements in `docs/requirements`: [OP-PF-16](../../requirements/technical/00-platform.md#op-pf-16)
- Where its MCP tools live, now that everyone may call it: [OP-PF-17](../../requirements/technical/00-platform.md#op-pf-17)
- A domain name for its load balancer: [OP-PF-08](../../requirements/technical/00-platform.md#op-pf-08)
- The switch from AWS for its current users: [OP-PF-18](../../requirements/technical/00-platform.md#op-pf-18)
