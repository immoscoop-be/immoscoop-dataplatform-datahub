# semgraph

| | |
| --- | --- |
| Kind | Backend service on Cloud Run ([DEC-PF-23](../../requirements/technical/00-platform.md#dec-pf-23)); open to everyone without login, behind a rate limit ([DEC-PF-24](../../requirements/technical/00-platform.md#dec-pf-24)) |
| Code | `services/semgraph`, moved in from `immoscoop-be/immoscoop-ptditt-semgraph` with its history ([DEC-PF-25](../../requirements/technical/00-platform.md#dec-pf-25)); how it is built and run is in its [README](../../../services/semgraph/README.md) |
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

The full list, with the contract of every chart, is in its [README](../../../services/semgraph/README.md#api) and at `/openapi.json`.

| Endpoint | Purpose |
| --- | --- |
| `GET /semgraphs`, `GET /semgraphs/{id}` | The charts there are, the question each answers, its contract and examples |
| `POST /validate` | Checks a request without drawing |
| `POST /render` | Draws the chart as SVG, or refuses it (422) |
| `GET /openapi.json` | The API in OpenAPI |
| `POST /mcp` | Its MCP server for Claude, with an MCP App that shows the chart in the conversation |
| `GET /health` | The health check, as on every service; also on `/healthz`, its name before the move |

## Talks to

Nothing: the data comes in the request.

## Who may call it

Everyone, worldwide, without login: the web app, Claude, dashboards and documents ([DEC-PF-24](../../requirements/technical/00-platform.md#dec-pf-24)). That is safe because semgraph holds no data and has access to none. Pages of every site may call it from the browser ([TR-PF-31](../../requirements/technical/00-platform.md#tr-pf-31)); the web app shows its charts that way. A load balancer with Cloud Armor in front of it limits the requests per address, and Cloud Run only accepts traffic through that load balancer ([TR-PF-30](../../requirements/technical/00-platform.md#tr-pf-30)).

## What exists today

semgraph runs on Cloud Run as `datahub-semgraph`, in uat once this code is deployed and in prod once it reaches `main`; the Terraform output `semgraph_url` is its address. It runs its TypeScript directly, and its tests run with those of Data Hub ([DEC-PF-25](../../requirements/technical/00-platform.md#dec-pf-25)). Its API and its MCP server are open, on its own address, and at most two instances run. The rate limit in front of it follows once it has a domain name ([TR-PF-30](../../requirements/technical/00-platform.md#tr-pf-30)).

The version on AWS keeps running, through the internal-tools platform and the former repository, until its users have moved over: see [Chart server - Environments and documentation](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1361412109) (Confluence, Dutch).

## Still to do

- A domain name, for the load balancer and its rate limit: [OP-PF-08](../../requirements/technical/00-platform.md#op-pf-08), [TR-PF-30](../../requirements/technical/00-platform.md#tr-pf-30)
- Its requirements, translated into `docs/requirements`: [OP-PF-16](../../requirements/technical/00-platform.md#op-pf-16)
- Where its MCP tools live, now that everyone may call it: [OP-PF-17](../../requirements/technical/00-platform.md#op-pf-17)
- The switch from AWS for its current users: [OP-PF-18](../../requirements/technical/00-platform.md#op-pf-18)
