# web

| | |
| --- | --- |
| Kind | Client application: React with Mantine, in the browser, served by its own small Cloud Run service ([DEC-PF-19](../../requirements/technical/00-platform.md#dec-pf-19), [DEC-PF-22](../../requirements/technical/00-platform.md#dec-pf-22)) |
| Code | `apps/web`: the page in `client/`, its server in `src/` |
| Schema | None |

**In one sentence:** web is the Data Hub interface in the browser; it shows what the services return and holds no business logic of its own ([DEC-PF-03](../../requirements/technical/00-platform.md#dec-pf-03)).

## Responsibilities

- Signing in through identity, and staying signed in: its server keeps the Refresh Token of the User in a cookie and gives the browser only the Access Token ([TR-PF-27](../../requirements/technical/00-platform.md#tr-pf-27))
- Finding, reading and discussing Resources: the tabs of a Resource ([FR-SR-24](../../requirements/functional/04-stacks-and-resources.md#fr-sr-24)), search and browsing per Collection ([FR-SR-21](../../requirements/functional/04-stacks-and-resources.md#fr-sr-21), [FR-SR-22](../../requirements/functional/04-stacks-and-resources.md#fr-sr-22))
- The admin for Data Admins and the Data Team: registering Resources and managing Collections
- Showing the Level everywhere ([FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10))
- All texts in English ([FR-SR-15](../../requirements/functional/04-stacks-and-resources.md#fr-sr-15))
- The look of the Immoscoop brandbook, from the theme in `packages/ui` ([TR-PF-29](../../requirements/technical/00-platform.md#tr-pf-29))
- Later: Lenses and Reports, with the shared components in `packages/ui` ([TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12)), and their charts drawn by semgraph ([DEC-PF-23](../../requirements/technical/00-platform.md#dec-pf-23)). The web app has no chart library of its own. Lineage stays a list: the chart language has no network diagram.

## Talks to

identity, catalogue, registry, query and semgraph, with the Access Token of the User; the services accept calls from the web app's address only (CORS). Its server only talks to identity, to sign in and renew.

## What exists today

Signing in, and the menu of your account with your name, email and roles (`GET /me` of identity). For the Data Team: searching the dbt projects in registry, the Current Version of each project, and a Node with its details, columns, tests and lineage up- and downstream, across both projects ([TR-AR-05](../../requirements/technical/01-artifact-registry.md#tr-ar-05), [TR-AR-06](../../requirements/technical/01-artifact-registry.md#tr-ar-06)). The address keeps the search and the Node (`#/search?q=…`, `#/nodes/<unique ID>`), so back, forward and links work. Open the Terraform output `web_url` in a browser, for uat `https://datahub-web-728318088152.europe-west1.run.app`, and sign in with your `thenextimmoscoop.be` account.

The page is built with Vite (`pnpm build`) into `dist/client`, which the server reads once at start-up and serves from memory. The server puts the addresses of identity and registry in the page, so one build runs in every environment.

| Route of the server | Purpose |
| --- | --- |
| `GET /` | The page; it may only load from its own address and only talk to its own server, identity and registry. Each page gets a new nonce for the styles Mantine adds ([TR-PF-29](../../requirements/technical/00-platform.md#tr-pf-29)) |
| `GET /assets/…`, `/favicon.svg` | The built scripts, styles and fonts; those in `assets/` carry their content in their name and are cached for good |
| `GET /auth/login` | Sends the User to identity, with PKCE, as the client `datahub-web` |
| `GET /auth/callback` | Back from identity: exchanges the code and keeps the Refresh Token in the cookie |
| `POST /auth/token` | Gives the page an Access Token for the Refresh Token in the cookie; only from the web app's own pages |
| `POST /auth/logout` | Ends the session at identity and forgets the cookie |
