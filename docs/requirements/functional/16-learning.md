# Learning

| | |
| --- | --- |
| Domain | 16 of Data Hub · code `LR` |
| Status | To be specified |
| Source of truth | This file; the topics themselves are in the [master learning plan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) (Confluence, Dutch) |

**In one sentence:** the Learning Centre gives every Learning Card of the master learning plan a page in Data Hub, with an article, a video and questions to check yourself, so that colleagues learn to read and use data where they use it.

*Functional domain 16 of Data Hub. Overview of all domains: [Functional domains](README.md). Asked for by Max on 2026-10-24; the screens are designed in [design](../../design/principles.md#learning), to review. Everything here is Proposed.*

## Decisions

- <a id="dec-lr-01"></a>**DEC-LR-01** · Data Hub has a section Learning. Every Learning Card of the master learning plan gets a page of its own in it. *Decided on 2026-10-24, at the request of Max.*
- <a id="dec-lr-02"></a>**DEC-LR-02** · Learning follows the structure of the master learning plan: the Compass, for orientation on how data works at Immoscoop, and four Learning Levels from easy to advanced, each split into sections. A Reading Card explains one standard chart. *Decided on 2026-10-24.*
- <a id="dec-lr-03"></a>**DEC-LR-03** · What a User understood restricts nothing, as a Level restricts nothing ([FR-MR-10](06-maturity-and-release.md#fr-mr-10)): every User may open every Learning Card, at every Learning Level. *Proposed on 2026-10-24, in line with how Data Hub treats maturity; to confirm ([OP-LR-08](#op-lr-08)).*
- <a id="dec-lr-04"></a>**DEC-LR-04** · The section is called the Learning Centre, as the Messages have their Message Centre. *Decided on 2026-10-24, as Max named it.*
- <a id="dec-lr-05"></a>**DEC-LR-05** · A link to a Learning Card can stand anywhere in Data Hub. It opens the card where the User is, in a floating window over the page, so they learn without leaving what they were doing. *Decided on 2026-10-24, at the request of Max.*
- <a id="dec-lr-06"></a>**DEC-LR-06** · The Learning Centre uses game elements, following seven principles. *Proposed on 2026-10-24, at the request of Max; to review ([OP-LR-10](#op-lr-10), [OP-LR-11](#op-lr-11)).*
  1. **Reward understanding,** never clicks or time spent: Badges and Ranks come from cards understood and questions answered right.
  2. **Progress you can see,** for every card, section and Learning Level.
  3. **Mastery in steps:** a Rank per Learning Level.
  4. **A gentle rhythm:** a Weekly Goal the User chooses, and a Streak counted in weeks that a holiday can pause. No reminders to come back.
  5. **Together, not against each other:** progress per team, without names; no ranking of colleagues.
  6. **Learn by doing:** some Badges come from using Data Hub as a card teaches.
  7. **Optional and calm:** a User can hide the game, nothing is restricted ([DEC-LR-03](#dec-lr-03)), and a success is a quiet note, not a fanfare.

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
| Learning Centre | The section of Data Hub with every Learning Card, the progress of the User and the game elements |
| Badge | A mark a User earns for a milestone in the Learning Centre, such as the Compass completed, a Quest done, or a card that helped a colleague |
| Rank | The highest Learning Level whose required cards a User has all understood |
| Weekly Goal | How many Learning Cards a User wants to understand each week, chosen by themselves |
| Streak | The number of weeks in a row a User met their Weekly Goal |
| Quest | A few Learning Cards around one theme, put together by the Data Team, with a Badge; for example before a new dashboard goes live |
| Learning Profile | The page of a User with their Rank and progress, their Badges, their Streak and the cards they understood |

## Flow

1. **The Data Team writes the topic** in the master learning plan: its learning goal, core, misconception and examples ([OP-LR-01](#op-lr-01)).
2. **The topic becomes a Learning Card** with a page in Data Hub: the article with its graphics, and where they exist a video and test questions.
3. **A User finds it** in the panel of Learning, by Learning Level and section, on the start screen, or through a link: from a chart, a Message or another card.
4. **The User reads, watches and checks themselves,** then marks the card understood.
5. **Colleagues refer to it in Messages,** for example when answering a Question about a Resource, and the Data Team tells about new cards.
6. **A link to a card stands where the topic comes up:** in a description, a Message, the footer of a chart. A click opens the card in a floating window over the page.
7. **The game keeps the rhythm:** the User sees their progress, works towards a Rank and their Weekly Goal, earns Badges and follows the Quests of the Data Team.

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

<a id="fr-lr-11"></a>
### FR-LR-11 · A link to a Learning Card can stand anywhere

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Wherever Data Hub shows text, a link to a Learning Card can stand inline: in what Data Hub writes itself, such as the footer of a chart, the Pre-flight or the explanation of a Level, and in what Users write, such as a description, a Message or Known Behaviour. It reads as a link with a small graduation cap. Hovering it shows the number and title of the card, and whether the User understood it.

<a id="fr-lr-12"></a>
### FR-LR-12 · The link opens the card in a floating window

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A click on the link opens the Learning Card in a floating window over the page, as a Message opens in context ([FR-CV-09](14-conversations.md#fr-cv-09)): its head moves it and folds it, and the page stays usable behind it. The window shows the card in short: its Learning Level, what the reader will be able to do, the article, the video, the questions and "Mark as understood". "Open in the learning centre" opens the full page of the card in the Learning Centre.

<a id="fr-lr-13"></a>
### FR-LR-13 · A Badge for a milestone

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User earns a Badge for a milestone:
- their first card understood;
- the Compass completed;
- a Rank reached;
- every Reading Card understood;
- a Quest completed;
- a Streak of four weeks;
- every question of ten cards right at the first try;
- a card they added to a Message, which the reader then understood;
- a card put into practice in Data Hub, such as a first Question on a Resource after 1.9.1 Questioning a number.

A Badge not earned yet shows what it takes.

<a id="fr-lr-14"></a>
### FR-LR-14 · A Rank per Learning Level

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User reaches the Rank of a Learning Level once they have understood all its required cards. The Learning Profile, the panel and the start screen show the Rank, and how far the User is towards the next.

<a id="fr-lr-15"></a>
### FR-LR-15 · A Weekly Goal, and a Streak counted in weeks

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User chooses a Weekly Goal of one, three or five cards, or none. The Streak counts the weeks in a row they met it. A User can pause a week ahead, for a holiday, without breaking the Streak. Data Hub never sends a reminder to come back.

<a id="fr-lr-16"></a>
### FR-LR-16 · Quests by the Data Team

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The Data Team puts together a Quest: a few cards around one theme, with a short reason and a Badge. It can announce the Quest in a Message ([FR-LR-07](#fr-lr-07)). The start screen shows the open Quests, and how far the User is in each.

<a id="fr-lr-17"></a>
### FR-LR-17 · Team progress, without ranking colleagues

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The start screen shows how far each team of the User has come: the share of the required cards of Learning Level 1 its members understood, without names. It shows only teams of at least five members. Data Hub never ranks individual Users.

<a id="fr-lr-18"></a>
### FR-LR-18 · A Learning Profile

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Every User has a Learning Profile with:
- their Rank, and their progress per Learning Level;
- their Badges, earned and still to earn;
- their Streak, week by week;
- the cards they understood.

Who else sees it is open ([OP-LR-11](#op-lr-11)).

<a id="fr-lr-19"></a>
### FR-LR-19 · A success is a quiet note

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

When a User understands a card, meets their Weekly Goal, or earns a Badge or a Rank, a quiet note says so for a few seconds. It moves only when the system of the User allows motion.

<a id="fr-lr-20"></a>
### FR-LR-20 · The game can be hidden

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User can hide the game elements: Badges, Ranks, the Weekly Goal, the Streak and team progress. The cards, the questions and the mark "understood" stay.

## Out of scope

- **Writing the lessons:** the topics, their learning goals and the learning material are made in the master learning plan ([OP-LR-01](#op-lr-01)).
- **The chart language** itself: [semgraph](../../architecture/services/semgraph.md), whose requirements are still in its own repository ([OP-PF-16](../technical/00-platform.md#op-pf-16)).
- **Messages** in general: [Conversations](14-conversations.md).

## Open points

- [ ] <a id="op-lr-01"></a>**OP-LR-01** · Decide where the content of a Learning Card lives: the master learning plan on Confluence stays the source and Data Hub shows it, or the cards move into Data Hub, for example as files in this repository. Today the master learning plan describes each topic (learning goal, core, misconception, examples), not the lesson itself: the articles, videos and questions are still to be made ("learning material: —"). *Raised on 2026-10-24, while designing Learning.*
- [ ] <a id="op-lr-02"></a>**OP-LR-02** · Decide the language of the Learning Cards: the master learning plan is in Dutch, and Data Hub is in English only ([FR-SR-15](04-stacks-and-resources.md#fr-sr-15), [DEC-DH-02](../../overview/data-hub.md#dec-dh-02)). Translate the cards, or make Learning the exception. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-03"></a>**OP-LR-03** · Decide where the videos live and who makes them, and whether they have captions. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-04"></a>**OP-LR-04** · Decide who sees what a User marked understood and how they answered: only the User, or also the Data Team, as numbers per card or per person. *Raised on 2026-10-24.* *Note of 2026-10-24: the design shows team progress as shares without names ([FR-LR-17](#fr-lr-17)).*
- [ ] <a id="op-lr-05"></a>**OP-LR-05** · Decide whether marking a card understood needs its test questions answered right first. The design lets a User mark it at any time. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-06"></a>**OP-LR-06** · Decide whether Data Hub suggests the Learning Levels a User works on, for example from their role (an Owner the cards of Learning Level 4), or the User chooses them. The master learning plan adds priorities and role profiles to the Compass later. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-07"></a>**OP-LR-07** · Decide whether a Learning Card shows in context, where the reader meets the topic: next to a field on a Resource Card, in the footer of a chart ([FR-LR-10](#fr-lr-10)), in Claude through the MCP server, or in the Domain Hub, where the Compass says the explanations of the master learning plan show up. *Raised on 2026-10-24.* *Note of 2026-10-24: a link inline anywhere in Data Hub that opens the card in a floating window is designed ([DEC-LR-05](#dec-lr-05), [FR-LR-11](#fr-lr-11), [FR-LR-12](#fr-lr-12)); Claude and the Domain Hub remain open.*
- [ ] <a id="op-lr-08"></a>**OP-LR-08** · Confirm that learning restricts nothing ([DEC-LR-03](#dec-lr-03)), or decide that some cards are needed first, for example before an Owner publishes a Resource. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-09"></a>**OP-LR-09** · Decide what happens to the mark "understood" when a card changes: it stays, or the User sees that the card changed since. *Raised on 2026-10-24.*

- [ ] <a id="op-lr-10"></a>**OP-LR-10** · Decide whether points and a ranking are wanted. The design leaves them out ([DEC-LR-06](#dec-lr-06)): points reward volume over understanding, and a ranking of colleagues puts pressure on those at the bottom. *Raised on 2026-10-24, while designing the game elements.*
- [ ] <a id="op-lr-11"></a>**OP-LR-11** · Decide who sees the Badges and Rank of a User. It can be only the User, colleagues on their Learning Profile, or next to their name in Messages, where a Rank could show who knows a topic well. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-12"></a>**OP-LR-12** · Decide whether learning is recognised outside Data Hub, for example with a certificate per Rank, or in team meetings. *Raised on 2026-10-24.*
- [ ] <a id="op-lr-13"></a>**OP-LR-13** · Decide in which texts a User can add a link to a Learning Card, and how: for example typing "#" and the number or words of the card. Also decide whether Data Hub suggests a card for a known term, such as "unique" or "grain". *Raised on 2026-10-24.*
- [ ] <a id="op-lr-14"></a>**OP-LR-14** · Decide which Badges for learning by doing exist, and how Data Hub notices them, such as a first Question on a Resource after 1.9.1 ([FR-LR-13](#fr-lr-13)). *Raised on 2026-10-24.*

## Builds on

- [ptditt - Competenties - Master-leerplan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) (Confluence, Dutch), with its [Compass](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1356070916) and Learning Levels [1](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146), [2](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354465283), [3](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354530859) and [4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629122)
- [Conversations](14-conversations.md)
- [Data Hub overview](../../overview/data-hub.md)
