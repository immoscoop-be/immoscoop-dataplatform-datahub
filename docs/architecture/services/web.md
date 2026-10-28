# web

| | |
| --- | --- |
| Kind | Client application: Svelte, in the browser, served by its own small Cloud Run service ([DEC-PF-19](../../requirements/technical/00-platform.md#dec-pf-19), [DEC-PF-28](../../requirements/technical/00-platform.md#dec-pf-28)) |
| Code | `apps/web`: the page in `client/`, its server in `src/`; the look in `packages/ui` |
| Schema | None |

**In one sentence:** web is the Data Hub interface in the browser; it shows what the services return and holds no business logic of its own ([DEC-PF-03](../../requirements/technical/00-platform.md#dec-pf-03)).

*Note of 2026-10-28: built in React with Mantine today; to be rebuilt in Svelte, with the look of the design ([DEC-PF-28](../../requirements/technical/00-platform.md#dec-pf-28)).* *Note of 2026-10-28: rebuilt in Svelte, part by part in the order of the [build order](../../design/build-order.md); part 1, the frame, is built. What the React app showed comes back with the parts that follow.*

This page describes the web app as it is built. Its design, the rules, style values and prototype screens it follows, is in [design](../../design/README.md).

## Responsibilities

- Signing in through identity, and staying signed in: its server keeps the Refresh Token of the User in a cookie and gives the browser only the Access Token ([TR-PF-27](../../requirements/technical/00-platform.md#tr-pf-27))
- Finding, reading and discussing Resources: the tabs of a Resource ([FR-SR-24](../../requirements/functional/04-stacks-and-resources.md#fr-sr-24)), search and browsing per Collection ([FR-SR-21](../../requirements/functional/04-stacks-and-resources.md#fr-sr-21), [FR-SR-22](../../requirements/functional/04-stacks-and-resources.md#fr-sr-22))
- Creating and managing Collections, for everyone ([FR-CO-12](../../requirements/functional/03-collections.md#fr-co-12), [FR-CO-13](../../requirements/functional/03-collections.md#fr-co-13))
- The admin for Data Admins: registering Resources and adding them to Collections
- Showing the Level everywhere ([FR-MR-10](../../requirements/functional/06-maturity-and-release.md#fr-mr-10))
- Names in English, sentences in Dutch by default with English available, through translation files that hold sentences only ([DEC-DH-65](../../overview/data-hub.md#dec-dh-65), [NFR-LOC-02](../../requirements/non-functional/localisation.md#nfr-loc-02), [NFR-LOC-06](../../requirements/non-functional/localisation.md#nfr-loc-06))
- The look of the design, light and dark, from the tokens and components in `packages/ui` ([TR-PF-33](../../requirements/technical/00-platform.md#tr-pf-33))
- The settings of the User, kept in identity, not in the browser ([TR-PF-32](../../requirements/technical/00-platform.md#tr-pf-32))
- Later: Lenses and Reports, with the shared components in `packages/ui` ([TR-PF-12](../../requirements/technical/00-platform.md#tr-pf-12)), and their charts drawn by semgraph ([DEC-PF-23](../../requirements/technical/00-platform.md#dec-pf-23)). The web app has no chart library of its own. Lineage stays a list: the chart language has no network diagram.

## Talks to

identity, catalogue, registry and query, with the Access Token of the User, and semgraph, which is open ([DEC-PF-24](../../requirements/technical/00-platform.md#dec-pf-24)); the services accept calls from the web app's address only (CORS). Its server only talks to identity, to sign in and renew.

## What exists today

Parts 1 and 2 of the [build order](../../design/build-order.md), and the first half of part 3: the frame every screen rests on, the Resources that wait for a Collection, and Collections.

**Signing in** ([sign-in](../../design/screens/sign-in.html)): a photo of the set of the theme, the glass card with "Sign in with Google", and the story of the photo. Signing in returns to the page it started from. An account of another domain is named on the sign-in, with a button that lets Google ask which account to use ([FR-UM-02](../../requirements/functional/02-user-management.md#fr-um-02)); any other problem is explained in a sentence.

**The frame** ([App shell](../../design/components.md#6--templates)): the rail with Collections, Query, Charts, Messages and the learning centre, the theme and the initials of the User; the panel of the active section, which slides in and out and stays as the User left it; and the main area, over the background. Each section shows, for now, its name and that it is being built; its panel and start screen come with its part. Below the narrowest window, one message takes the place of the frame ([DEC-UX-91](../../design/principles.md#dec-ux-91)).

**Light and dark, and the backgrounds:** the theme of the system until the User switches it. Each theme has its set of backgrounds: the gradient, the pictures, the flowing gradient and the flowing lights, drawn with WebGL ([DEC-UX-108](../../design/principles.md#dec-ux-108), [DEC-UX-109](../../design/principles.md#dec-ux-109)). Random, the default, picks one when Data Hub starts and again when the theme switches. Without WebGL, the gradient stays; when the system asks to reduce motion, everything stands still.

**My page** ([my-page](../../design/screens/my-page.html)), behind the initials: the name and account of the User; Profile, with the language of Data Hub and the groups of the User from Workspace (`GET /me/groups` of identity); and Background, a choice for day and one for night. The tab Excel keys, and the Collections and queries a User owns, come with parts 9, 3 and 5.

**Collections** ([collections-start](../../design/screens/collections-start.html), [collection-overview](../../design/screens/collection-overview.html), [collection-edit](../../design/screens/collection-edit.html), [collection-add-resources](../../design/screens/collection-add-resources.html)), part 3: the panel lists every Collection the User sees, All or Yours, with a plus for a new one and a search over the Collections and their Resources; a Collection unfolds to its first eight Resources, those not published in a lighter grey, and opening it, or a Resource in it, unfolds it ([FR-CO-18](../../requirements/functional/03-collections.md#fr-co-18) to [FR-CO-25](../../requirements/functional/03-collections.md#fr-co-25)). Its icon is a line icon of Phosphor in the light weight, loaded only where it shows. The start screen has the intro, until the User dismisses it (the setting `intro.collections`), the Collections of the groups of the User, and what changed or was added lately. The page of a Collection, at `/collections/<id>`, shows what it is, what needs attention, its Resources with their Level and last change, and its recent history; its Owner Unit and the Data Team edit it in place, the Data Team from every group of the domain (`GET /groups` of identity), and dissolve it when it is empty. `/collections/new` is an empty Collection page that makes one. The Data Team adds Resources without a Collection in a sheet of two steps ([collection-add-relations](../../design/screens/collection-add-relations.html)): it picks them, then checks per Resource how it is stored, its grain and model type and the mapping of every field, from what registry proposes (`GET /nodes/<id>/proposal`) and the Domain Model in use (`GET /domain-model`), and adds them with all of it in one go ([FR-CO-33](../../requirements/functional/03-collections.md#fr-co-33), [FR-CO-34](../../requirements/functional/03-collections.md#fr-co-34)). It removes them from the table. The Lenses of a Collection come with part 6.

**For the Data Team, the Resources without a Collection** ([resource-unassigned](../../design/screens/resource-unassigned.html)), part 2: in the panel of Collections, "Without a Collection" on top, in the urgent red, with how many wait, unfolded to each of them with its Level ([DEC-UX-16](../../design/principles.md#dec-ux-16)). The page of such a Resource, at `/resources/<id>`, says that it is in no Collection, that only the Data Team sees it, and when and through which exposure it came in; its Overview shows its description from dbt, its maturity with how many columns still lack a description, and its recent history, the Log in the language of the reader ([NFR-LOC-10](../../requirements/non-functional/localisation.md#nfr-loc-10)). Its other tabs come with part 4. In a Collection, the page of a Resource sits under it, and its Owner Unit sees it too. Anyone else gets the page for what does not exist.

**The page for what does not exist** ([not-found](../../design/screens/not-found.html)), for every address that is not a page of Data Hub, which does not say whether it exists ([DEC-UX-32](../../design/principles.md#dec-ux-32)). Its search field comes with Collections.

The addresses are those of the pages: `/collections`, `/collections/<id>`, `/collections/new`, `/query`, `/charts`, `/messages`, `/learning`, `/me`, `/me/background` and `/resources/<id>`; `/` opens Collections. Back, forward and links work, and a link to a page of Data Hub changes the page without loading it again. Open the Terraform output `web_url` in a browser, for uat `https://datahub-web-728318088152.europe-west1.run.app`, and sign in with your account of `thenextimmoscoop.be` or `immoscoop.be`.

### How it is built

The look lives in `packages/ui`, in the layers of [components.md](../../design/components.md): `foundations/` (the stylesheet that imports `docs/design/tokens.css`, the icons, the backgrounds, the sentences), `primitives/`, `marks/`, `containers/` and `components/`, each with its own sentences in `texts/`. The web app adds its templates, screens and sentences in `client/src`; `lib/` holds what talks to the server and identity, the addresses, and the settings. A behaviour lives in its component, never in a screen. The settings of the User are read once from identity when the page starts, and each change is saved there at once.

The page is built with Vite (`pnpm build`) into `dist/client`, which the server reads once at start-up and serves from memory: the scripts, the stylesheet, Poppins and the pictures of the backgrounds, taken from `docs/design/backgrounds`. The server puts the addresses of identity, catalogue, registry and semgraph in the page, so one build runs in every environment.

The tests of the page run in a browser-like document (jsdom): the components of `packages/ui` and the web app as a whole, with identity stood in for. A test of the tokens fails on any colour, font, radius or duration written in a component instead of a token of `tokens.css`.

| Route of the server | Purpose |
| --- | --- |
| `GET /`, and every address of a page | The page; it may only load from its own address, pictures from semgraph too, and only talk to its own server, identity, catalogue, registry and semgraph ([TR-PF-33](../../requirements/technical/00-platform.md#tr-pf-33)). An address with a file extension that was not built is not found |
| `GET /assets/…`, `/favicon.svg` | The built scripts, styles, fonts and pictures; those in `assets/` carry their content in their name and are cached for good |
| `GET /auth/login` | Sends the User to identity, with PKCE, as the client `datahub-web`; `next` is the page to return to, and `choose=account` lets Google ask which account to use |
| `GET /auth/callback` | Back from identity: exchanges the code, keeps the Refresh Token in the cookie, and returns to the page the sign-in started from |
| `POST /auth/token` | Gives the page an Access Token for the Refresh Token in the cookie; only from the web app's own pages |
| `POST /auth/logout` | Ends the session at identity and forgets the cookie |
