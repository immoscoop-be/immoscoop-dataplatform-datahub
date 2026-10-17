# mcp

| | |
| --- | --- |
| Kind | Client application: MCP server on Cloud Run, for Claude |
| Code | `apps/mcp` |
| Schema | None |

**In one sentence:** mcp is how Claude uses Data Hub: it offers tools to find, read and query Resources, and later shows Lenses and Reports as an MCP App, all on behalf of the signed-in User.

## Responsibilities

- Signing in through identity, as an OAuth client of it ([TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06))
- Tools, as a first sketch: search Resources, read a Resource Card, read lineage, preview a Resource, run SQL ([FR-SR-26](../../requirements/functional/04-stacks-and-resources.md#fr-sr-26))
- Mentioning the Level of every Resource it uses ([DEC-MR-06](../../requirements/functional/06-maturity-and-release.md#dec-mr-06), [FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10))
- Later: Lenses and Reports as an MCP App, with the same components as web ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15), [TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12))

## Talks to

catalogue, registry and query, passing on the Access Token of the User. mcp is publicly reachable, because Claude calls it from Anthropic's servers on the internet ([DEC-PF-10](../../requirements/technical/00-platform.md#dec-pf-10)).
