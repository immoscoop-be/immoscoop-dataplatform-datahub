# Learning

| | |
| --- | --- |
| Domain | 16 of Data Hub · code `LR` |
| Status | To be specified |
| Source of truth | This file; the topics themselves are in the [master learning plan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) (Confluence, Dutch) |

**In one sentence:** Learning gives every Learning Card of the master learning plan a page in Data Hub, with an article, a video and questions to check yourself, so that colleagues learn to read and use data where they use it.

*Functional domain 16 of Data Hub. Overview of all domains: [Functional domains](README.md). Asked for by Max on 2026-10-24; the screens are designed in [design](../../design/principles.md#learning), to review. Everything here is Proposed.*

## Decisions

- <a id="dec-lr-01"></a>**DEC-LR-01** · Data Hub has a section Learning. Every Learning Card of the master learning plan gets a page of its own in it. *Decided on 2026-10-24, at the request of Max.*
- <a id="dec-lr-02"></a>**DEC-LR-02** · Learning follows the structure of the master learning plan: the Compass, for orientation on how data works at Immoscoop, and four Learning Levels from easy to advanced, each split into sections. A Reading Card explains one standard chart. *Decided on 2026-10-24.*
- <a id="dec-lr-03"></a>**DEC-LR-03** · What a User understood restricts nothing, as a Level restricts nothing ([FR-MR-10](06-maturity-and-release.md#fr-mr-10)): every User may open every Learning Card, at every Learning Level. *Proposed on 2026-10-24, in line with how Data Hub treats maturity; to confirm ([OP-LR-08](#op-lr-08)).*

## Terms

| Term | Meaning |
| --- | --- |
| Learning Card | One topic of the master learning plan, with a page in Data Hub: an article, optionally a video and test questions. It has a number, such as 1.2.2, a Learning Level, a section, a priority and a thinking level |
| Learning Level | One of the four levels of the master learning plan, from easy to advanced: 1 User, 2 Data-aware user, 3 Data analyst, 4 Data owner and expert. Not to be confused with the Level of a Resource |
| Compass | The Learning Cards on how data works at Immoscoop: the landscape, the tooling, governance and processes. Orientation for everyone, not a step on the way from easy to advanced |
| Reading Card | A Learning Card that explains how to read one standard chart of the chart language, and the trap it avoids |
| section | A group of Learning Cards within a Learning Level, such as 1.2 Definition awareness. Ordinary word, not a Defined Term |
| priority | How much a card matters, from the master learning plan: required, recommended or in depth |
| thinking level | What the reader can do afterwards, from the master learning plan: recognise, apply or judge |

## Flow

1. **The Data Team writes the topic** in the master learning plan: its learning goal, core, misconception and examples ([OP-LR-01](#op-lr-01)).
2. **The topic becomes a Learning Card** with a page in Data Hub: the article with its graphics, and where they exist a video and test questions.
3. **A User finds it** in the panel of Learning, by Learning Level and section, on the start screen, or through a link: from a chart, a Message or another card.
4. **The User reads, watches and checks themselves,** then marks the card understood.
5. **Colleagues refer to it in Messages,** for example when answering a Question about a Resource, and the Data Team tells about new cards.

## Requirements

<a id="fr-lr-01"></a>
### FR-LR-01 · Every topic of the master learning plan is a Learning Card with a page

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Every topic of the master learning plan, the Compass included, is a Learning Card with a page of its own in Data Hub. The page shows its number and title, its Learning Level and section, its priority (required, recommended or in depth), its thinking level (recognise, apply or judge), and the cards it builds on.

<a id="fr-lr-02"></a>
### FR-LR-02 · A Learning Card holds an article, a video and test questions

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A Learning Card holds an article with text and graphics. It can also hold a video and test questions; a card without them shows only what it has. The article follows the topic in the master learning plan: what the reader will be able to do, the core, the common mistake, and examples from Immoscoop. Its charts are drawn by the Chart Server ([DEC-PF-23](../technical/00-platform.md#dec-pf-23)).

<a id="fr-lr-03"></a>
### FR-LR-03 · The panel of Learning lists every card by Learning Level and section

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The panel of the section Learning lists every Learning Card: first the Compass, then the four Learning Levels from easy to advanced, each unfolding to its sections and their cards. Each card shows the icon of its kind, its name on one line and whether the User marked it understood. Each Learning Level and section shows how many of its cards the User understood. Search in the panel covers the names of the cards.

<a id="fr-lr-04"></a>
### FR-LR-04 · Test questions say right or wrong, and why

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A test question has one right answer among a few. When the User answers, the card says whether it was right and explains why, for the wrong answers too. The User can answer again. Who else sees the answers is open ([OP-LR-04](#op-lr-04)).

<a id="fr-lr-05"></a>
### FR-LR-05 · A User marks a Learning Card understood

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User marks a Learning Card understood, and can undo it. The mark is kept per User and shows in the panel, on the card and wherever the card appears in a Message. Whether marking needs the test questions answered first is open ([OP-LR-05](#op-lr-05)).

<a id="fr-lr-06"></a>
### FR-LR-06 · A Learning Card has Messages of its own

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A Learning Card is an object of Messages, as a Collection, a Resource or a Lens is ([FR-CV-01](14-conversations.md#fr-cv-01)): "Messages" on its page opens its Messages in the slide-in ([FR-CV-07](14-conversations.md#fr-cv-07)). It takes a Question or a Remark, which notify the Data Team, as the Data Team writes the cards. Every User sees the Messages on a card, as every User may open it.

<a id="fr-lr-07"></a>
### FR-LR-07 · A Message can carry a Learning Card

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Whoever writes a Message can add a Learning Card to it, for example when answering a Question on a Resource. The card shows in the Message as a small card with its number, title and Learning Level, and whether the reader marked it understood; a click opens it. The Message stays on its own object ([FR-CV-03](14-conversations.md#fr-cv-03)).

<a id="fr-lr-08"></a>
### FR-LR-08 · The start screen of Learning shows where to go next

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The section Learning opens on a start screen: an intro, a search, the card the User was reading, the required cards of the Learning Levels the User works on that they have not marked understood yet, and new or changed cards.

<a id="fr-lr-09"></a>
### FR-LR-09 · A card links to what comes before and after

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The page of a Learning Card links to the cards it builds on, with whether the User understood them; to the next card in its section; to related cards; and to where the reader meets the topic in Data Hub, such as a field on a Resource Card or a Lens.

<a id="fr-lr-10"></a>
### FR-LR-10 · Every standard chart links to its Reading Card

**Status:** Proposed · **Source:** [master learning plan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) · [design](../../design/principles.md#learning)

The footer of every standard chart reads "How do I read this chart?" and links to the Reading Card of its kind of chart. A new standard chart is finished only once its Reading Card exists, as the master learning plan asks.

## Out of scope

- **Writing the lessons:** the topics, their learning goals and the learning material are made in the master learning plan ([OP-LR-01](#op-lr-01)).
- **The chart language** itself: [semgraph](../../architecture/services/semgraph.md), whose requirements are still in its own repository ([OP-PF-16](../technical/00-platform.md#op-pf-16)).
- **Messages** in general: [Conversations](14-conversations.md).

## Open points

- [ ] <a id="op-lr-01"></a>**OP-LR-01** · Decide where the content of a Learning Card lives: the master learning plan on Confluence stays the source and Data Hub shows it, or the cards move into Data Hub, for example as files in this repository. Today the master learning plan describes each topic (learning goal, core, misconception, examples), not the lesson itself: the articles, videos and questions are still to be made ("learning material: —"). *Raised on 2026-10-24, while designing Learning.*
- [ ] <a id="op-lr-02"></a>**OP-LR-02** · Decide the language of the Learning Cards: the master learning plan is in Dutch, and Data Hub is in English only ([FR-SR-15](04-stacks-and-resources.md#fr-sr-15), [DEC-DH-02](../../overview/data-hub.md#dec-dh-02)). Translate the cards, or make Learning the exception. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-03"></a>**OP-LR-03** · Decide where the videos live and who makes them, and whether they have captions. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-04"></a>**OP-LR-04** · Decide who sees what a User marked understood and how they answered: only the User, or also the Data Team, as numbers per card or per person. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-05"></a>**OP-LR-05** · Decide whether marking a card understood needs its test questions answered right first. The design lets a User mark it at any time. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-06"></a>**OP-LR-06** · Decide whether Data Hub suggests the Learning Levels a User works on, for example from their role (an Owner the cards of Learning Level 4), or the User chooses them. The master learning plan adds priorities and role profiles to the Compass later. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-07"></a>**OP-LR-07** · Decide whether a Learning Card shows in context, where the reader meets the topic: next to a field on a Resource Card, in the footer of a chart ([FR-LR-10](#fr-lr-10)), in Claude through the MCP server, or in the Domain Hub, where the Compass says the explanations of the master learning plan show up. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-08"></a>**OP-LR-08** · Confirm that learning restricts nothing ([DEC-LR-03](#dec-lr-03)), or decide that some cards are needed first, for example before an Owner publishes a Resource. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-09"></a>**OP-LR-09** · Decide what happens to the mark "understood" when a card changes: it stays, or the User sees that the card changed since. *Raised on 2026-10-24.*

## Builds on

- [ptditt - Competenties - Master-leerplan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) (Confluence, Dutch), with its [Compass](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1356070916) and Learning Levels [1](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146), [2](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354465283), [3](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354530859) and [4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629122)
- [Conversations](14-conversations.md)
- [Data Hub overview](../../overview/data-hub.md)
