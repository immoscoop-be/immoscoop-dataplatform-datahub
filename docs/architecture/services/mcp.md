# mcp

| | |
| --- | --- |
| Kind | Client application: MCP server on Cloud Run, for Claude |
| Code | `apps/mcp` |
| Schema | None |

**In one sentence:** mcp is how Claude uses Data Hub: it offers tools to find, read and query resources, and later shows lenses and reports as an MCP App, all on behalf of the signed-in user.

## Responsibilities

- Signing in through identity, as an OAuth client of it ([TR-PF-06](../../requirements/technical/00-platform.md#tr-pf-06))
- Tools, as a first sketch: search resources, read a resource card, read lineage, preview a resource, run SQL ([FR-SR-26](../../requirements/functional/04-stacks-and-resources.md#fr-sr-26))
- Mentioning the level of every resource it uses ([DEC-MR-06](../../requirements/functional/06-maturity-and-release.md#dec-mr-06), [FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10))
- Later: lenses and reports as an MCP App, with the same components as web ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15), [TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12))

## Talks to

catalogue, registry and query, passing on the access token of the user. Whether Claude can reach mcp when the services are internal is open ([OP-PF-04](../../requirements/technical/00-platform.md#op-pf-04)).
