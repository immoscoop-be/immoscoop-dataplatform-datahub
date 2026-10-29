# Build order

The order in which Data Hub is built from this design, part by part. Each part ends in something that runs on uat and can be tried, and each rests only on the parts before it. Written on 2026-10-28, after the review of the open points.

## How to use it

1. **Part 1** starts in a fresh Claude Code session, with the [handover prompt](handover-prompt.md) as its first message. That prompt sets the rules for every part: read the design first, propose before building, never decide an open point by building it.
2. **Every later part** starts with its short prompt below, in the same session while it has room, or in a new one after the handover prompt.
3. **A part is done** when it runs on uat, its requirements have moved to `Implemented` (with `pnpm docs:build`), and you have tried it. Then the next part starts.

Before the first deploy to uat: the one-time bootstrap ([OP-PF-10](../requirements/technical/00-platform.md#op-pf-10)) and the branch rules in GitHub ([OP-PF-12](../requirements/technical/00-platform.md#op-pf-12)). Building locally does not wait for them.

## The parts

| Part | What | Screens |
| --- | --- | --- |
| 1 | The frame: tokens, app shell, themes and backgrounds, language, settings, sign-in, My page | `sign-in`, `my-page` (Profile, Background), `not-found` |
| 2 | From dbt to Resources: the registry reads the manifests, Registrations, Resources without a Collection | `resource-unassigned` |
| 3 | Collections: the panel, the start screen, a Collection, adding Resources with grain and relations | `collections-start`, `collection-overview`, `collection-edit`, `collection-add-resources`, `collection-add-relations` |
| 4 | The page of a Resource: its tabs, publishing and confirming, Levels | `resource-detail`, `resource-lineage`, `resource-history`, `resource-preview`, `resource-edit`, `resource-columns-edit`, `resource-publish` |
| 5 | Query: the editor, Parameters, the Pre-flight, results and history | `query-new`, `query` |
| 6 | Lenses: making one, its page, its size and its Requests | `lens-new`, `lens-new-context`, `lens`, `lens-context` |
| 7 | Messages and notifications: the Message Centre, Messages on every object, e-mail and Slack | `messages`, `collection-messages`, `resource-messages`, `lens-messages` |
| 8 | Learning: the cards as files, the Learning Centre, markers in context | `learning-start`, `learning-card`, `learning-see`, `learning-float`, `learning-hover`, `learning-message` |
| 9 | Excel keys and Excel: the result of a Lens in Power Query | `my-page` (Excel keys) |

Not in this order: Charts, the gallery of semgraph, waits for its open points ([OP-PF-16](../requirements/technical/00-platform.md#op-pf-16) to [OP-PF-18](../requirements/technical/00-platform.md#op-pf-18)); Claude through the MCP server is version 2 ([DEC-CH-02](../requirements/functional/13-channels.md#dec-ch-02)), and with it `learning-mcp`.

## The prompts

### Part 1 · The frame

The [handover prompt](handover-prompt.md), as the first message of the session. Its first steps explore the repo and map the screens to the requirements; then it builds the frame every screen rests on:

- the tokens in the Svelte app, one place for each value;
- the app shell: the rail, the panel that slides in and out, the frames, light and dark;
- the backgrounds: the gradients, the pictures, the flowing gradient and the flowing lights, Random, and a choice per theme ([DEC-UX-108](principles.md#dec-ux-108), [DEC-UX-109](principles.md#dec-ux-109));
- the language: translation files, Dutch by default and English, names never translated ([DEC-DH-65](../overview/data-hub.md#dec-dh-65));
- the settings of a User, kept in Data Hub ([DEC-UX-96](principles.md#dec-ux-96));
- signing in with Google, for both Workspace domains, with the Groups of a User fetched at sign-in ([DEC-UM-08](../requirements/functional/02-user-management.md#dec-um-08), [DEC-UM-09](../requirements/functional/02-user-management.md#dec-um-09));
- My page with Profile and Background, and the page for a link to something you may not see.

### Part 2 · From dbt to Resources

```text
Part 2: from dbt to Resources. Read docs/requirements/functional/01-artifact-registry.md, with its section "The
Domain Model in the manifest", and the Registration in 04-stacks-and-resources.md. Build how the
registry reads the dbt manifests, turns every model with an exposure tagged datahub into a Resource, takes what
Colleciónes writes in its meta, and keeps Resources plain: no array, struct or JSON column (DEC-SR-33). A new
Resource waits without a Collection for the Data Team (screen resource-unassigned), and the Data Team gets the
Message "A new Resource waits for a Collection" (MSG-RES-01). Propose the schema in Postgres first: it starts fresh
(DEC-DH-76).
```

### Part 3 · Collections

```text
Part 3: Collections. Read docs/requirements/functional/03-collections.md and "Page of a Collection" in
docs/design/principles.md. Build the panel with every Collection a User sees (All and Yours), the start screen, the
page of a Collection, making and editing one (an icon is required, a Collection has no colour: DEC-CO-23,
DEC-CO-25), handing it to another Owner Unit, and adding Resources in the sheet of two steps: choose them, then their
grain, model type, mappings and storage (FR-CO-33, FR-CO-34). Screens: collections-start, collection-overview,
collection-edit, collection-add-resources, collection-add-relations.
```

### Part 4 · The page of a Resource

```text
Part 4: the page of a Resource. Read "Detail page of a Resource" in docs/design/principles.md, and the domains
Resources, the Resource Card, and Maturity and release. Build its head with the Level, Publication, Owner and Signals,
and its tabs: Overview (edited in place by the Owner and the Data Team), Columns (with "Edit relations" for a Data
Admin, DEC-UX-107), Lineage one step at a time, History, and Preview. Then publishing and confirming, the Levels, a
deprecated Resource, and a Broken one. Leave out Stability and "Make it an anomaly": not in v1. Screens:
resource-detail, resource-lineage, resource-history, resource-preview, resource-edit, resource-columns-edit,
resource-publish.
```

### Part 5 · Query

```text
Part 5: Query. Read "Query" in docs/design/principles.md and the requirements it links. Build a query as its name,
question and Resources; the SQL editor (CodeMirror 6, BigQuery dialect) with folding and suggestions; the
Parameters; the Pre-flight with its two thresholds, the partition filter that a Resource can require (DEC-SR-35)
and the Request to the Data Team above 1 GB, which waits until it is answered (DEC-SR-36, DEC-LE-15); the result
grid; the history of runs; and the Query Log. Screens: query-new, query.
```

### Part 6 · Lenses

```text
Part 6: Lenses. Read docs/requirements/functional/09-lenses.md and "Making a Lens" and "Page of a Lens" in
docs/design/principles.md. Build "Make it a lens" from a query, with its size check, the Request for a very large
Lens, and a new Collection in the same step for an author who owns none (DEC-CO-24); the page of a Lens with Run
and About, run only when a User runs it (DEC-LE-12); a Lens that grows past 1 GB stops until it is accepted again
(DEC-LE-11); a Broken Lens; and making a Lens public (DEC-LE-09). Screens: lens-new, lens-new-context, lens,
lens-context.
```

*Note of 2026-10-29: built in four parts: 6a makes a Lens and runs it; 6b keeps it right (updating, editing, growth and Broken); 6c finds Lenses, in a new query and on the start screen of Collections; 6d the search of that start screen, once its results are drawn ([OP-UX-45](principles.md#op-ux-45)). The Data Team accepting a Lens, and lens-new-context and lens-context, come with Messages in part 7.*

### Part 7 · Messages and notifications

```text
Part 7: Messages and notifications. Read docs/requirements/functional/14-conversations.md, 07-log-and-notifications.md
and the Message Catalogue in packages/contracts/src/messageCatalogue.ts. Build the Message Centre in the rail, the
Messages on every object, a Message opened in context, the Log, and the notifications: in Data Hub, by e-mail, to
the Google group of an Owner Unit (DEC-LN-03), and as a Slack direct message (DEC-LN-05). Every text comes from the
catalogue. First ask me how Data Hub sends e-mail (OP-PF-19). Screens: messages, collection-messages,
resource-messages, lens-messages.
```

### Part 8 · Learning

```text
Part 8: Learning. Read docs/requirements/functional/16-learning.md and "Learning" in docs/design/principles.md.
Build the Learning Cards as files in this repository, in English with a Dutch translation (DEC-LR-24), each at its
own URL; the Learning Centre with what is suggested for a User (DEC-LR-14, DEC-LR-18); the page of a card in five
steps; See it, drawn by the Chart Server; Check yourself without a verdict (DEC-LR-19); the markers on system text and
the card in a floating window. Leave out video: not in v1. Screens: learning-start, learning-card, learning-see,
learning-float, learning-hover, learning-message.
```

### Part 9 · Excel keys and Excel

```text
Part 9: Excel keys and Excel. Read docs/requirements/functional/12-permissions-and-library-cards.md and 13-channels.md.
Build the tab Excel keys on My page (make one, shown once; revoke), and the endpoint Power Query calls with a key:
the result of a Lens as data, with its Parameters at their defaults (DEC-CH-03). Screen: my-page, tab Excel keys.
```
