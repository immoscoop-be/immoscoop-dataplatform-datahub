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
- The server instructions: what Data Hub is, its concepts and the rules Claude follows in it ([FR-CL-14](../../requirements/functional/17-claude.md#fr-cl-14)), in `src/guide.ts`
- The tools of [Claude](../../requirements/functional/17-claude.md), each asking catalogue or query with the Access Token of the User, so that it answers as they may see ([FR-CL-02](../../requirements/functional/17-claude.md#fr-cl-02)):
  - `who_am_i`, `how_to_use` and the prompt `start_with_data_hub`, and `explain`, which reads the Learning Cards of `packages/learning` (`src/tools.ts`, `src/learning.ts`)
  - Resources: `list_resources`, `search`, `get_resource`, `show_resource`, `get_resource_lineage`, `get_related_resources`, `get_resource_log`, `get_resource_queries`, `update_resource_card`, `describe_fields`, `mark_changes_seen`, `deprecate_resource`, `undeprecate_resource`, `publish_resource` and `preview_resource` (`src/resources.ts`)
  - Messages: `get_messages`, `write_message`, `reply_to_message` (`src/messages.ts`)
  - Queries: `suggest_lenses`, `create_query`, `check_query`, `run_query`, `show_query`, `get_result_page`, `list_queries`, `get_query`, `update_query` (`src/queries.ts`)
- One MCP App, `ui://datahub/view.html`, that the show tools open: a Resource, a Preview, a publication or the result of a query (`src/view.ts`, `src/view-page.ts`). The MCP Apps SDK is inlined in it, as the sandbox in Claude loads nothing from outside, and its values are those of `docs/design/tokens.css`, checked by a test
- The buttons of the User in that MCP App are tools only the MCP App may call, never Claude ([DEC-CL-07](../../requirements/functional/17-claude.md#dec-cl-07)): `run_preview_approved`, `send_preview_request`, `run_query_approved`, `send_query_request` and `confirm_publication`
- Mentioning the Level of every Resource it uses ([DEC-MR-06](../../requirements/functional/06-maturity-and-release.md#dec-mr-06), [FR-CL-05](../../requirements/functional/17-claude.md#fr-cl-05))
- Later: Lenses and Reports as an MCP App, with the same components as web ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15), [TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12))
- Later: the steps of a Learning Card as an MCP App, the same blocks as on the page in web ([DEC-LR-08](../../requirements/functional/16-learning.md#dec-lr-08), [FR-LR-26](../../requirements/functional/16-learning.md#fr-lr-26)); designed, not built

## Talks to

catalogue and query, passing on the Access Token of the User, at `DATAHUB_CATALOGUE_URL` and `DATAHUB_QUERY_URL`; it links to the pages of the web app at `DATAHUB_WEB_URL` ([FR-CL-06](../../requirements/functional/17-claude.md#fr-cl-06)). It keeps nothing itself. mcp is publicly reachable, because Claude calls it from Anthropic's servers on the internet ([DEC-PF-10](../../requirements/technical/00-platform.md#dec-pf-10)).

## Connecting Claude

1. In Claude: **Settings → Connectors → Add custom connector**. Depending on the plan, an Owner first adds the connector for the whole organisation.
2. Name it, for example `Data Hub (uat)`, with the address of mcp: the Terraform output `mcp_url`, `https://datahub-mcp-<project number>.europe-west1.run.app/mcp`.
3. Connect: Claude registers itself at identity, and a window opens where you sign in with Google, with your `thenextimmoscoop.be` account.
4. Ask Claude "Who am I in Data Hub?": it calls `who_am_i`. Or choose the prompt "Start with Data Hub" for what Claude can do there.

Claude stays connected for 30 days after its last use ([TR-PF-25](../../requirements/technical/00-platform.md#tr-pf-25)).
