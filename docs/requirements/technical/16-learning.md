<!--
IDs: TR-LR-NN. Every TR links what it realises.
-->

# Learning: technical requirements

| | |
| --- | --- |
| Realises | [Learning](../functional/16-learning.md) |
| Status | The Learning Centre in the web app implemented: the cards as files, the progress of every User, the panel, the start screen, a card in five steps, See it on its own and the Messages on a card (part 8a); the markers on the page of a Resource with their pop-out, the floating window, and the card under what Data Hub writes (part 8b). A card in a Message and "Share in a Message" wait for their drawing to be approved ([OP-UX-48](../../design/principles.md#op-ux-48)); names with their marker come later ([OP-UX-49](../../design/principles.md#op-ux-49)) |
| Source of truth | This file |

How the Learning Centre is built: the Learning Cards as files in the package `packages/learning` ([DEC-LR-24](../functional/16-learning.md#dec-lr-24)), what every User did with them in the service [catalogue](../../architecture/services/catalogue.md), and their pages in the [web app](../../architecture/services/web.md), with the examples drawn by [semgraph](../../architecture/services/semgraph.md).

## Requirements

<a id="tr-lr-01"></a>
### TR-LR-01 · The Learning Cards are files in `packages/learning`, checked by their tests

**Status:** Implemented · **Realises:** [DEC-LR-12](../functional/16-learning.md#dec-lr-12), [DEC-LR-16](../functional/16-learning.md#dec-lr-16), [DEC-LR-23](../functional/16-learning.md#dec-lr-23), [DEC-LR-24](../functional/16-learning.md#dec-lr-24), [DEC-LR-25](../functional/16-learning.md#dec-lr-25), [FR-LR-01](../functional/16-learning.md#fr-lr-01), [FR-LR-39](../functional/16-learning.md#fr-lr-39)

`packages/learning` holds the master learning plan and the cards. `src/plan.ts` has every topic of the plan, the Compass included: its number, its Learning Level and section, its title in English and in the Dutch it came from, its priority, its thinking level and the cards it builds on, with the Learning Levels and their sections. A topic without a file is a card to be written.

A written card is a folder `cards/<number>/` with `en.md`, the card, and `nl.md`, its translation. A file is Markdown with fixed English headings and labels, so that whoever writes a card needs no other tool:

- its facts between `---` lines: `number`, `status` (`draft` or `reviewed`), `minutes`, `added`, `changed`, `gain`, and in a translation `translatedFrom`;
- `# Why now`, with the quote, who says it, the situation and `Promise: …`;
- `# Core idea`, with the rule and two parts under `##`, the metaphor and the example;
- `# See it`, optional, with the example as a request of the Chart Server in a fenced block `chart`, then `Look at: …` and `You see: …`;
- `# Check your understanding`, optional, with a question under each `##`, an optional `Try it: [label](/path)`, the answers as `- [ ]` and `- [x]`, exactly one right, and `Why: …`;
- `# You can now`, with what the User can now do, and under `## Where to next` two or three of `- Deeper: <number>`, `- Next to it: <number>` and `- Apply: [label](/path) text`.

Text takes the marks of the Message Catalogue, `**strong**` and `` `a name` ``. `parseCard` reads a file and names, with its line, whatever does not fit. A card without See it and questions is a minimal card. `versionOf` names the version of the English, apart from its status; a translation names the version it was made from in `translatedFrom`.

The tests of the package read every card in both languages: each has the shape, its number is a topic of the plan, its choices go to written cards, the Dutch has the steps and questions of the English, and a translation of an older English is named as to update. A test of semgraph has the Chart Server check and draw the example of every card, so that a card with an example it cannot draw does not pass.

<a id="tr-lr-02"></a>
### TR-LR-02 · catalogue keeps what every User did with a card

**Status:** Implemented · **Realises:** [FR-LR-05](../functional/16-learning.md#fr-lr-05), [FR-LR-28](../functional/16-learning.md#fr-lr-28), [FR-LR-32](../functional/16-learning.md#fr-lr-32), [DEC-LR-13](../functional/16-learning.md#dec-lr-13), [DEC-LR-15](../functional/16-learning.md#dec-lr-15)

A row of `learning_progress` per User and card: when they first saw it, when they last opened it, the step they had open, and when they understood it, if they did. It holds no answer and no score.

| Route | Purpose |
| --- | --- |
| `GET /learning/progress` | What the User did with every card they saw |
| `PUT /learning/progress/{card}` | The User opened a step of a card, `{ "step": "why" \| "core" \| "see" \| "check" \| "can" }`: seen from the first time |
| `PUT /learning/progress/{card}/understood`, `DELETE …` | "I understand it", and undone |

A card that is no topic of the plan is not found, a step that is no step is refused. A User reads and writes only their own progress. The Data Team reads it in the schema of catalogue; a screen for it is not designed.

<a id="tr-lr-03"></a>
### TR-LR-03 · A Learning Card is an object of Messages

**Status:** Implemented · **Realises:** [FR-LR-06](../functional/16-learning.md#fr-lr-06)

A Message can be about a Learning Card (`learningCard`), named by its number, which keeps its case. It takes a Question or a Remark; every User sees the Messages on a card, and they are for the Data Team, which writes the cards and gets their notifications, as for an object without an Owner Unit ([TR-CV-01](14-conversations.md#tr-cv-01)). Its address is `/learning/<number>`.

<a id="tr-lr-04"></a>
### TR-LR-04 · The web app shows the Learning Centre

**Status:** Implemented · **Realises:** [FR-LR-03](../functional/16-learning.md#fr-lr-03), [FR-LR-08](../functional/16-learning.md#fr-lr-08), [FR-LR-27](../functional/16-learning.md#fr-lr-27), [FR-LR-28](../functional/16-learning.md#fr-lr-28), [FR-LR-29](../functional/16-learning.md#fr-lr-29), [FR-LR-30](../functional/16-learning.md#fr-lr-30), [FR-LR-31](../functional/16-learning.md#fr-lr-31), [FR-LR-32](../functional/16-learning.md#fr-lr-32), [DEC-LR-18](../functional/16-learning.md#dec-lr-18), [DEC-LR-19](../functional/16-learning.md#dec-lr-19), [DEC-LR-25](../functional/16-learning.md#dec-lr-25), [DEC-LR-27](../functional/16-learning.md#dec-lr-27)

The web app takes the cards from `packages/learning` when it is built: the English of every written card with the page, a translation when it is read. A draft shows outside prod only: the server puts its environment, `DATAHUB_ENVIRONMENT`, in the page ([DEC-LR-25](../functional/16-learning.md#dec-lr-25)).

- **The panel** lists every topic of the plan by Learning Level and section, with the count of the cards seen; a written card is a link, one to be written is listed without one.
- **The start screen**, `/learning`, has the intro, the card the User read last and does not understand yet, the cards suggested to them, their path through the Learning Levels and the cards new or changed in the last 30 days. Data Hub suggests the Compass and Learning Level 1 to everyone, Learning Level 4 to a member of an Owner Unit that owns a Collection, Learning Levels 3 and 4 to the Data Team; a suggested card is written, of such a Level, required or of the Compass, and not understood yet.
- **A card**, `/learning/<number>`, opens where the User stopped, or on Why now; every step it opens is kept ([TR-LR-02](#tr-lr-02)). The depth is chosen on the card.
- **See it on its own**, `/learning/<number>/see`, has the rule, the example, the way back and the whole card.
- **Messages on a card**, `/learning/<number>/messages`, in the slide-in ([TR-LR-03](#tr-lr-03)).

<a id="tr-lr-05"></a>
### TR-LR-05 · The example of See it is drawn by the Chart Server, in the browser

**Status:** Implemented · **Realises:** [FR-LR-29](../functional/16-learning.md#fr-lr-29), [DEC-LR-21](../functional/16-learning.md#dec-lr-21), [DEC-LR-26](../functional/16-learning.md#dec-lr-26)

The page sends the request of the card to `POST /render` of semgraph, with the theme of the page and the default size, and shows the SVG it answers as a picture, which cannot run anything in the page. Whether it is drawn or not, "Look at" and "You see" stand beside it. Nothing of it comes from live data.

<a id="tr-lr-06"></a>
### TR-LR-06 · Which system text carries a marker, and its pop-out

**Status:** Implemented · **Realises:** [FR-LR-35](../functional/16-learning.md#fr-lr-35), [FR-LR-36](../functional/16-learning.md#fr-lr-36), [FR-LR-39](../functional/16-learning.md#fr-lr-39), [DEC-LR-22](../functional/16-learning.md#dec-lr-22), [DEC-LR-28](../functional/16-learning.md#dec-lr-28), [DEC-LR-30](../functional/16-learning.md#dec-lr-30)

`src/markers.ts` of `packages/learning` names every place a marker stands and the cards its pop-out lists, most fitting first: the Level of a Resource (K5.2, 3.3.3), its grain (2.3.5, 1.2.2, 1.2.1), its model type (2.3.6) and "Mark as seen" on a change since its last Confirmation (4.3.2, 4.3.1). Placing a marker is adding a place there and wrapping the text in the web app, as part of the release check of a functionality. Its tests check that every card is a topic of the plan and that every place has a written card.

The page wraps a marked text in `LearningRef`, which lists only the written cards of its place, and shows the marker once there is one. The marker ⓘ is `Marker` in `packages/ui`, in the symbol font of `--font-symbol`; the pop-out is `Explained`: it opens after the pointer rests for a second, at once on keyboard focus or Enter, and on a tap on the marker, which keeps a button from acting; it closes when the pointer leaves, on Escape and on scrolling; it hangs on the page itself, under the text or above it, its arrow on the marker; and what it explains stays tinted while a card it opened is open. An item gives the number, title and gain of the card in the language of the User, whether and when they saw it, from catalogue ([TR-LR-02](#tr-lr-02)), read once a pop-out first opens, and "See it".

<a id="tr-lr-07"></a>
### TR-LR-07 · A card opens in a floating window, in the same steps as its page

**Status:** Implemented · **Realises:** [FR-LR-12](../functional/16-learning.md#fr-lr-12), [FR-LR-27](../functional/16-learning.md#fr-lr-27), [DEC-LR-08](../functional/16-learning.md#dec-lr-08)

The five steps are one block, `LearningSteps`, which the page of a card and the floating window share; in the window it is compact, with only the name of the current step in the row and "I understand it" beside it. The window opens over the page the User is on, from an item of a pop-out; each step it opens is kept as on the page, and "Open in the Learning Centre" opens the page of the card. One card is open in it at a time.

<a id="tr-lr-08"></a>
### TR-LR-08 · What Data Hub writes carries the card of its type

**Status:** Implemented · **Realises:** [FR-LR-38](../functional/16-learning.md#fr-lr-38), [DEC-LR-29](../functional/16-learning.md#dec-lr-29)

Under the text of a Message Data Hub writes, the web app shows the card its type names in the Message Catalogue (`learningCard` with `fit: 'named'`), once that card is written: its number, title, Learning Level and minutes, and whether the User saw it. A click unfolds it in the Message: its rule, what the User can now do, "Open the whole card" and "I understand it". Unfolded, the card counts as seen, unless it already was.

## Open points

None yet.
