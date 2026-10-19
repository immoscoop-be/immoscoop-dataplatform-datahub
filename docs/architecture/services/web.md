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
- Creating and managing Collections, for everyone ([FR-CO-12](../../requirements/functional/03-collections.md#fr-co-12), [FR-CO-13](../../requirements/functional/03-collections.md#fr-co-13))
- The admin for Data Admins: registering Resources and adding them to Collections
- Showing the Level everywhere ([FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10))
- All texts in English ([FR-SR-15](../../requirements/functional/04-stacks-and-resources.md#fr-sr-15))
- The look of the Immoscoop brandbook, from the theme in `packages/ui` ([TR-PF-29](../../requirements/technical/00-platform.md#tr-pf-29))
- Later: Lenses and Reports, with the shared components in `packages/ui` ([TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12)), and their charts drawn by semgraph ([DEC-PF-23](../../requirements/technical/00-platform.md#dec-pf-23)). The web app has no chart library of its own. Lineage stays a list: the chart language has no network diagram.

## Talks to

identity, catalogue, registry and query, with the Access Token of the User, and semgraph, which is open ([DEC-PF-24](../../requirements/technical/00-platform.md#dec-pf-24)); the services accept calls from the web app's address only (CORS). Its server only talks to identity, to sign in and renew.

## What exists today

Signing in, and the menu of your account with your name, email and roles (`GET /me` of identity).

For everyone: the Collections of catalogue (`#/collections`), the start page outside the Data Team. The list holds the Collections the User sees, each in its colour, with its Owner Unit and whether it is private or public. **New Collection** asks for a name, a description, a colour from the palette, optionally an icon, found by searching every outline icon of Tabler Icons but the logos of brands by name and Tabler's words, grouped by category, with suggestions before anything is typed ([DEC-CO-14](../../requirements/functional/03-collections.md#dec-co-14)), an Owner Unit chosen from the groups of the User (`GET /me/groups` of identity) and private or public. A Collection (`#/collections/<ID>`) shows its description, Owner Unit, visibility, its Resources and its history, the Log as catalogue builds its texts; its Owner Unit and the Data Team can edit and dissolve it there ([TR-CO-02](../../requirements/technical/03-collections.md#tr-co-02), [TR-CO-03](../../requirements/technical/03-collections.md#tr-co-03)). Each Resource shows its Display Name, kind, Key, description, and the exposures and dbt project it comes from, or that it is withdrawn. Its Owner Unit and the Data Team see all of them; anyone else only the published ones, which do not exist yet ([TR-SR-05](../../requirements/technical/04-stacks-and-resources.md#tr-sr-05)).

For the Data Team, also: under the Collections, the Resources waiting for a Collection, each with the choice of a Collection to add it to; on a Collection, the choice of a waiting Resource to add, and Remove per Resource; and each Resource linked to its Node ([TR-SR-04](../../requirements/technical/04-stacks-and-resources.md#tr-sr-04)).

Also for everyone: the charts of semgraph (`#/charts`), each with the question it answers and its first example, and per chart (`#/charts/<ID>`) the questions it answers, the chart to use instead in some cases, and all its examples, as asked or light and dark, in every size. An example semgraph refuses shows why. The page reads the catalogue of semgraph and shows its pictures straight from semgraph, without Access Token ([DEC-PF-24](../../requirements/technical/00-platform.md#dec-pf-24), [TR-PF-31](../../requirements/technical/00-platform.md#tr-pf-31)).

For the Data Team, also: searching the dbt projects in registry, all of them or one, chosen in a dropdown, the Current Version of each project, and a Node with its details, columns, tests, lineage up- and downstream across both projects, and its meta from the dbt project as a table of keys and values, nested by indentation ([TR-AR-05](../../requirements/technical/01-artifact-registry.md#tr-ar-05), [TR-AR-06](../../requirements/technical/01-artifact-registry.md#tr-ar-06)). The address keeps the page (`#/collections/<ID>`, `#/search?q=…&project=…`, `#/nodes/<unique ID>`, `#/charts/<ID>`), so back, forward and links work. Open the Terraform output `web_url` in a browser, for uat `https://datahub-web-728318088152.europe-west1.run.app`, and sign in with your `thenextimmoscoop.be` account.

The page is built with Vite (`pnpm build`) into `dist/client`, which the server reads once at start-up and serves from memory. The drawings in `icons/` are the exception: there are some 4,800, so one route reads each from disk the first time the page asks for it and keeps it from then on. A route per drawing, all read at start-up, made the server too slow to pass the startup check of Cloud Run. The server puts the addresses of identity, catalogue, registry and semgraph in the page, so one build runs in every environment.

| Route of the server | Purpose |
| --- | --- |
| `GET /` | The page; it may only load from its own address, pictures from semgraph too, and only talk to its own server, identity, catalogue, registry and semgraph. Each page gets a new nonce for the styles Mantine adds ([TR-PF-29](../../requirements/technical/00-platform.md#tr-pf-29)) |
| `GET /assets/…`, `/favicon.svg`, `/icons/<name>.svg` | The built scripts, styles and fonts; those in `assets/` carry their content in their name and are cached for good. `icons/` holds the drawing of every icon a Collection can carry, copied from `@tabler/icons` at build time; the page loads one only where it shows it, and keeps it an hour like the favicon, since its name does not change with a new version of Tabler |
| `GET /auth/login` | Sends the User to identity, with PKCE, as the client `datahub-web` |
| `GET /auth/callback` | Back from identity: exchanges the code and keeps the Refresh Token in the cookie |
| `POST /auth/token` | Gives the page an Access Token for the Refresh Token in the cookie; only from the web app's own pages |
| `POST /auth/logout` | Ends the session at identity and forgets the cookie |
