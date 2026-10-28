# Handover prompt for Claude Code

The opening message for the Claude Code session that builds this design into the web app. Use it only once the designs are final ([how we work](README.md#how-we-work)), and paste everything below the line as the first message. Brought up to date on 2026-10-28, after the review of the open points. It starts part 1 of the [build order](build-order.md); the later parts each have a short prompt there.

---

We are going to build the design of Data Hub into the web app.

The web app is rebuilt in Svelte, not in React with Mantine ([DEC-PF-28](../requirements/technical/00-platform.md#dec-pf-28)). What is built today may be thrown away: the rebuild need not stay compatible with its code, its schema in Postgres or its data, and it starts from a fresh database ([DEC-DH-74](../overview/data-hub.md#dec-dh-74), [DEC-DH-76](../overview/data-hub.md#dec-dh-76)).

What to read:

- `docs/design/principles.md` holds the rules and decisions of the design. Read it completely first.
- `docs/design/tokens.css` holds all style values.
- `docs/design/components.md` lists every component, its layer, its behaviour and what it depends on.
- `docs/design/base.css` and `docs/design/screens/` are working prototypes in HTML, CSS and `app.js`.
- `docs/README.md` leads to the requirements, `docs/definitions.md` to the Defined Terms, and `docs/requirements/README.md` explains the IDs and what is marked "Could, not in v1".
- The texts of every Message, in Dutch and English, are in the Message Catalogue, `packages/contracts/src/messageCatalogue.ts`.

Agreements:

- `principles.md` is the source of truth for the rules, `tokens.css` for the values. When a rule changes, change `principles.md` first, then the tokens, then the code.
- The prototypes are the designs. Take sizes, colours, transitions and behaviour from them, not from your own judgement.
- The content of the screens is placeholder.
- Some parts of the prototypes are for the prototype only: the dashed switches at the bottom right ("Seen as", the states of a screen), and the parameters in the address that set a state, such as `?bg=`, `?tabs=` or `?role=`. Build the behaviour they show, not the switches.
- The prototypes also show some things that are not in version 1: the tile Stability on a Resource, "Make it an anomaly" on a Signal, the video link of a Learning Card, and Claude through the MCP server (version 2). `principles.md` says so where they appear; leave them out. What else is not in v1 is marked "Could, not in v1" in the requirements.
- Sentences are Dutch by default, with English available; names are English and never translated ([DEC-DH-65](../overview/data-hub.md#dec-dh-65), [localisation](../requirements/non-functional/localisation.md)). No sentence is written into a component: it comes from the translation files, and a Message from the Message Catalogue.
- The settings of a User, such as the language, the theme and the two backgrounds, are kept in Data Hub as keys and values per User, not in the browser ([DEC-UX-96](principles.md#dec-ux-96)).
- The Learning Cards are files in this repository, written in English with a Dutch translation of each, and each has its own URL ([DEC-LR-12](../requirements/functional/16-learning.md#dec-lr-12), [DEC-LR-24](../requirements/functional/16-learning.md#dec-lr-24)).
- A Collection has no colour; only its icon sets it apart ([DEC-UX-105](principles.md#dec-ux-105)).

What I ask of you:

1. Explore the repo: the stack, the existing frontend, the services and the folder with the requirements. Briefly summarise what you find, and what of the current web app you propose to keep or throw away, before you change anything.
2. For each screen in `docs/design/screens/`, find the requirements it fulfils. Put their IDs at the top, in the comment of the screen, and add a reference to the screen to those requirements. Report which requirements have no screen yet, and which parts of the screens have no requirement.
3. Propose how `tokens.css` ends up in the styling of the Svelte app, so that there is only one place for each value.
4. Build the components from `components.md`, layer by layer: a behaviour lives in its component, never in a screen. Propose any change to that list before you build it.
5. Wait for my approval before you build the components and screens. Then build part 1 of `docs/design/build-order.md`, the frame: the navigation and the panel first, because every screen rests on them. We build part by part, in that order; each part ends on uat, tried, before the next starts.

The design has no open points left. The open points that remain elsewhere are listed in `docs/review/2026-10-25-functional-and-technical-review.md`, under "Every open point". When you run into one, ask me; never decide an open point by building it.
