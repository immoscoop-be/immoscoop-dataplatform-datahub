# mcp

| | |
| --- | --- |
| Kind | Client application: MCP server on Cloud Run, for Claude |
| Code | `apps/mcp` |
| Schema | None |

**In one sentence:** mcp is how Claude uses Data Hub: it offers tools to find, read, preview, describe, discuss and query Resources, shows what the User must see or decide in an MCP App, and later Lenses and Reports, all on behalf of the signed-in User.

## Responsibilities

- Signing in through identity, as an OAuth client of it ([TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06)): without a valid Access Token, mcp answers `401` with a pointer to its protected resource metadata, which names identity as the place to sign in
- The MCP endpoint `/mcp`, Streamable HTTP without sessions: every request gets its own MCP server, for the User of its Access Token
- The server instructions: what Data Hub is, its concepts and the rules Claude follows in it, analysing in SQL among them ([FR-CL-14](../../requirements/functional/17-claude.md#fr-cl-14), [FR-CL-24](../../requirements/functional/17-claude.md#fr-cl-24)), in `src/guide.ts`
- The tools of [Claude](../../requirements/functional/17-claude.md), each asking catalogue or query with the Access Token of the User, so that it answers as they may see ([FR-CL-02](../../requirements/functional/17-claude.md#fr-cl-02)):
  - `who_am_i`, `how_to_use` and the prompt `start_with_data_hub`, and `explain`, which reads the Learning Cards of `packages/learning`, in English and Dutch, and searches them with the shared search of `packages/learning/src/explain.ts`; in prod (`DATAHUB_ENVIRONMENT`) it offers only the reviewed cards, as the web app shows them (`src/tools.ts`, `src/learning.ts`)
  - Resources: `list_resources`, `search`, `get_resource`, `show_resource`, `get_resource_lineage`, `get_related_resources`, `get_resource_log`, `get_resource_queries`, `update_resource_card`, `add_known_gap`, `change_known_gap`, `remove_known_gap`, `describe_fields`, `mark_changes_seen`, `deprecate_resource`, `undeprecate_resource`, `publish_resource` and `preview_resource` (`src/resources.ts`)
  - The Owner Journey: `guide_owner_journey`, which shows its step in the MCP App, `record_journey_step` and the prompt `publish_a_resource`, from the shared definition of `@datahub/contracts/journey` ([FR-CL-30](../../requirements/functional/17-claude.md#fr-cl-30), [FR-CL-31](../../requirements/functional/17-claude.md#fr-cl-31), [TR-SR-32](../../requirements/technical/04-stacks-and-resources.md#tr-sr-32)); `publish_resource` shows the steps required to publish, and offers the declaration only once they are done ([FR-CL-32](../../requirements/functional/17-claude.md#fr-cl-32)) (`src/journey.ts`). The window of a step opens at the start with what and why and the road ahead unfolded; every other step keeps the overview folded, what it holds, the line that says what its text is for, its Learning Cards folded under "How can we help with this step?", and the link to the part of the Resource in Data Hub it writes, such as `/resources/{id}/gaps` ([FR-CL-33](../../requirements/functional/17-claude.md#fr-cl-33), [DEC-CL-19](../../requirements/functional/17-claude.md#dec-cl-19))
  - The Known Gaps one at a time: `add_known_gap`, `change_known_gap` and `remove_known_gap` write through the routes of the web app on catalogue, `/resources/{id}/gaps`, each gap with its scope, checked against `gapScopeSchema` of `@datahub/contracts/gaps`; changing a gap keeps who added it, and `update_resource_card` no longer takes the Known Gaps ([FR-CL-34](../../requirements/functional/17-claude.md#fr-cl-34), [DEC-CL-20](../../requirements/functional/17-claude.md#dec-cl-20))
  - `get_resource` starts with the Summary of the Resource in Markdown: its parts in the order of the Summary, numbered, each with its weight and what that weight asks of Claude, built from `@datahub/contracts/summary` as the web app builds it ([FR-CL-25](../../requirements/functional/17-claude.md#fr-cl-25), [TR-SR-26](../../requirements/technical/04-stacks-and-resources.md#tr-sr-26)), in `src/summary.ts`, each Known Gap with its scope as data, such as `[period: until 2025-02-28; rows: lead_source = partner]` ([FR-RC-25](../../requirements/functional/05-resource-card.md#fr-rc-25)); the Resource itself follows as JSON. `show_resource` gives Claude the same Summary first; both put it first in their data too ([FR-CL-26](../../requirements/functional/17-claude.md#fr-cl-26))
  - Messages: `get_messages`, `write_message`, `reply_to_message` (`src/messages.ts`)
  - Queries: `suggest_lenses`, `create_query`, `check_query`, `run_query`, `show_query`, `get_result_page`, `list_queries`, `get_query`, `update_query` (`src/queries.ts`)
- One MCP App, `ui://datahub/view.html`, that the show tools open: a Resource, a Preview, a publication, the result of a query, a step of the Owner Journey or a whole Learning Card from `show_learning_card` ([TR-LR-09](../../requirements/technical/16-learning.md#tr-lr-09)) (`src/view.ts`, `src/view-page.ts`). The MCP Apps SDK is inlined in it, as the sandbox in Claude loads nothing from outside, and its values are those of `docs/design/tokens.css`, checked by a test. A Resource opens on its Summary, drawn from the parts `src/summary.ts` builds for Claude, with Columns beside it ([FR-CL-26](../../requirements/functional/17-claude.md#fr-cl-26)). Every window fits a phone, one column from 520 px down, and folds to its head with the button at its top right ([FR-CL-27](../../requirements/functional/17-claude.md#fr-cl-27))
- A window of one Collection shows the icon of that Collection, as the panel of the web app does; mcp reads its drawing from `@phosphor-icons/core` (`src/icons.ts`) and sends it with the data, as the MCP App loads nothing from outside ([DEC-UX-164](../../design/principles.md#dec-ux-164))
- The buttons of the User in that MCP App are tools only the MCP App may call, never Claude ([DEC-CL-07](../../requirements/functional/17-claude.md#dec-cl-07)): `run_preview_approved`, `send_preview_request`, `run_query_approved`, `send_query_request` and `confirm_publication`
- Mentioning the Level of every Resource it uses ([DEC-MR-06](../../requirements/functional/06-maturity-and-release.md#dec-mr-06), [FR-CL-05](../../requirements/functional/17-claude.md#fr-cl-05))
- Later: Lenses and Reports as an MCP App, with the same components as web ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15), [TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12))
- Later: the chart of See it and "I understand it" in the MCP App of a Learning Card ([FR-LR-26](../../requirements/functional/16-learning.md#fr-lr-26), [OP-LR-16](../../requirements/functional/16-learning.md#op-lr-16))

## Talks to

catalogue and query, passing on the Access Token of the User, at `DATAHUB_CATALOGUE_URL` and `DATAHUB_QUERY_URL`; it links to the pages of the web app at `DATAHUB_WEB_URL` ([FR-CL-06](../../requirements/functional/17-claude.md#fr-cl-06)). It keeps nothing itself. mcp is publicly reachable, because Claude calls it from Anthropic's servers on the internet ([DEC-PF-10](../../requirements/technical/00-platform.md#dec-pf-10)).

## Connecting Claude

1. In Claude: **Settings → Connectors → Add custom connector**. Depending on the plan, an Owner first adds the connector for the whole organisation.
2. Name it, for example `Data Hub (uat)`, with the address of mcp: the Terraform output `mcp_url`, `https://datahub-mcp-<project number>.europe-west1.run.app/mcp`.
3. Connect: Claude registers itself at identity, and a window opens where you sign in with Google, with your `thenextimmoscoop.be` account.
4. Ask Claude "Who am I in Data Hub?": it calls `who_am_i`. Or choose the prompt "Start with Data Hub" for what Claude can do there.

Claude stays connected for 30 days after its last use ([TR-PF-25](../../requirements/technical/00-platform.md#tr-pf-25)).
