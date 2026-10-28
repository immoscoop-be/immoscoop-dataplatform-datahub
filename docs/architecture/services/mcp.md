# mcp

| | |
| --- | --- |
| Kind | Client application: MCP server on Cloud Run, for Claude |
| Code | `apps/mcp` |
| Schema | None |

**In one sentence:** mcp is how Claude uses Data Hub: it offers tools to find, read and query Resources, and later shows Lenses and Reports as an MCP App, all on behalf of the signed-in User.

## Responsibilities

- Signing in through identity, as an OAuth client of it ([TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06)): without a valid Access Token, mcp answers `401` with a pointer to its protected resource metadata, which names identity as the place to sign in
- The MCP endpoint `/mcp`, Streamable HTTP without sessions: every request gets its own MCP server, for the User of its Access Token
- The first tool, `who_am_i`: the name, email, Groups and roles of the signed-in User, to check that signing in works
- Tools, as a first sketch: search Resources, read a Resource Card, read lineage, preview a Resource, run SQL ([FR-SR-26](../../requirements/functional/04-stacks-and-resources.md#fr-sr-26))
- Mentioning the Level of every Resource it uses ([DEC-MR-06](../../requirements/functional/06-maturity-and-release.md#dec-mr-06), [FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10))
- Later: Lenses and Reports as an MCP App, with the same components as web ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15), [TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12))
- Later: the steps of a Learning Card as an MCP App, the same blocks as on the page in web ([DEC-LR-08](../../requirements/functional/16-learning.md#dec-lr-08), [FR-LR-26](../../requirements/functional/16-learning.md#fr-lr-26)); designed, not specified

## Talks to

catalogue, registry and query, passing on the Access Token of the User. mcp is publicly reachable, because Claude calls it from Anthropic's servers on the internet ([DEC-PF-10](../../requirements/technical/00-platform.md#dec-pf-10)).

## Connecting Claude

1. In Claude: **Settings → Connectors → Add custom connector**. Depending on the plan, an Owner first adds the connector for the whole organisation.
2. Name it, for example `Data Hub (uat)`, with the address of mcp: the Terraform output `mcp_url`, `https://datahub-mcp-<project number>.europe-west1.run.app/mcp`.
3. Connect: Claude registers itself at identity, and a window opens where you sign in with Google, with your `thenextimmoscoop.be` account.
4. Ask Claude "Who am I in Data Hub?": it calls `who_am_i`.

Claude stays connected for 30 days after its last use ([TR-PF-25](../../requirements/technical/00-platform.md#tr-pf-25)).
