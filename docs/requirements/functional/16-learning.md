# Learning

| | |
| --- | --- |
| Domain | 16 of Data Hub · code `LR` |
| Status | To be specified |
| Source of truth | This file, for screens, flows and implementation. The philosophy and guiding principles are on [Learning-centre: filosofie en guiding principles](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494) (Confluence, Dutch), which this file follows ([DEC-LR-09](#dec-lr-09)). The topics are in the [master learning plan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) (Confluence, Dutch) |

**In one sentence:** the Learning Centre offers knowledge when you need it, in small Learning Cards you go through freely, so that you notice yourself that you can do something you could not do before.

*Functional domain 16 of Data Hub. Overview of all domains: [Functional domains](README.md). Asked for by Max on 2026-10-24, and brought in line with the principles page on 2026-10-25; the screens are designed in [design](../../design/principles.md#learning), to review. Everything here is Proposed.*

## Decisions

- <a id="dec-lr-01"></a>**DEC-LR-01** · Data Hub has a section Learning. Every Learning Card of the master learning plan gets a page of its own in it. *Decided on 2026-10-24, at the request of Max.*
- <a id="dec-lr-02"></a>**DEC-LR-02** · Learning follows the structure of the master learning plan: the Compass, for orientation on how data works at Immoscoop, and four Learning Levels from easy to advanced, each split into sections. A Reading Card explains one standard chart. *Decided on 2026-10-24.*
- <a id="dec-lr-03"></a>**DEC-LR-03** · What a User understood restricts nothing, as a Level restricts nothing ([FR-MR-10](06-maturity-and-release.md#fr-mr-10)): every User may open every Learning Card, at every Learning Level. *Proposed on 2026-10-24, in line with how Data Hub treats maturity; to confirm ([OP-LR-08](#op-lr-08)).* *Note of 2026-10-25: the principles page leaves open whether a card is ever a condition for an action; if so, then as an offer with the action, never as a quiz to pass ([principles, 5](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)).* *Confirmed on 2026-10-28, by Max: no restrictions; no card is ever a condition for an action ([OP-LR-08](#op-lr-08)).*
- <a id="dec-lr-04"></a>**DEC-LR-04** · The section is called the Learning Centre, as the Messages have their Message Centre. *Decided on 2026-10-24, as Max named it.*
- <a id="dec-lr-05"></a>**DEC-LR-05** · A link to a Learning Card can stand anywhere in Data Hub. It opens the card where the User is, in a floating window over the page, so they learn without leaving what they were doing. *Decided on 2026-10-24, at the request of Max.* *Note of 2026-10-25: only on system text, never on text that Users provide ([FR-LR-35](#fr-lr-35)).*
- <a id="dec-lr-06"></a>**DEC-LR-06** · The Learning Centre uses game elements, following seven principles. *Proposed on 2026-10-24, at the request of Max; to review ([OP-LR-10](#op-lr-10), [OP-LR-11](#op-lr-11)).* *Note of 2026-10-25: replaced by [DEC-LR-09](#dec-lr-09): no scores, badges, rankings or deadlines, only a silent progress. The game elements are withdrawn.*
  1. **Reward understanding,** never clicks or time spent: Badges and Ranks come from cards understood and questions answered right.
  2. **Progress you can see,** for every card, section and Learning Level.
  3. **Mastery in steps:** a Rank per Learning Level.
  4. **A gentle rhythm:** a Weekly Goal the User chooses, and a Streak counted in weeks that a holiday can pause. No reminders to come back.
  5. **Together, not against each other:** progress per team, without names; no ranking of colleagues.
  6. **Learn by doing:** some Badges come from using Data Hub as a card teaches.
  7. **Optional and calm:** a User can hide the game, nothing is restricted ([DEC-LR-03](#dec-lr-03)), and a success is a quiet note, not a fanfare.
- <a id="dec-lr-07"></a>**DEC-LR-07** · A Learning Card is worked through in four steps, one at a time: What it is, Visualised, Check yourself and Congrats. Each page carries less, so what matters stands out. *Decided on 2026-10-25, at the request of Max; the steps and their names are to review ([OP-LR-15](#op-lr-15)).* *Note of 2026-10-25: replaced by [DEC-LR-10](#dec-lr-10): five steps, from the principles page.*
- <a id="dec-lr-08"></a>**DEC-LR-08** · The steps of a Learning Card stand on their own, without the navigation of Data Hub. The same steps show on the page of the card, in the floating window and in Claude as an MCP App, as Lenses and Reports do ([DEC-DH-15](../../overview/data-hub.md#dec-dh-15)). *Decided on 2026-10-25, at the request of Max.* *Note of 2026-10-28: Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- <a id="dec-lr-09"></a>**DEC-LR-09** · The page [Learning-centre: filosofie en guiding principles](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494) on Confluence is the source of truth for the philosophy and the guiding principles of the Learning Centre. This file applies them in screens, flows and implementation, and departs from them only after that page changes. It follows the decisions of its section 5:
  1. Cards work with recognisable examples, not with live data or technical links.
  2. No question is mandatory. "I understand it" is always there, and is enough to close a card.
  3. Each card has a large set of questions, and they come one at a time.
  4. A try-it task is a kind of question within Check your understanding, not a separate mandatory step.
  5. No scores, badges, rankings or deadlines; only a silent progress.
  6. Every card ends with You can now: growth, what it brings, and two or three choices to go on.

  Whatever in this file clashes with a principle, and is not settled by those decisions or by the checklist of its section 6, is an open point here, to be decided on that page. This replaces [DEC-LR-06](#dec-lr-06). *Decided on 2026-10-25, by Max.*
- <a id="dec-lr-10"></a>**DEC-LR-10** · A Learning Card follows five steps, in this order: Why now, Core idea, See it, Check your understanding and You can now. The User chooses the depth: the quick path (Why now, Core idea, You can now) or the full path. This replaces [DEC-LR-07](#dec-lr-07). *Decided on 2026-10-25, from the principles page ([principles, 3.9 and 4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)).*
- <a id="dec-lr-11"></a>**DEC-LR-11** · Every Message that Data Hub writes itself points to the Learning Card that explains what is happening, with a clear link of its own, "Understand what is happening here", right under its text, not with a marker inside it; the card opens inline, in the Message. *Decided on 2026-10-27, by Max.*
- <a id="dec-lr-12"></a>**DEC-LR-12** · The content of the Learning Cards moves into Data Hub, which becomes its source; the master learning plan on Confluence no longer is. Every Learning Card has its own URL, so that it can be linked from anywhere. *Decided on 2026-10-28, by Max ([OP-LR-01](#op-lr-01)).*
- <a id="dec-lr-13"></a>**DEC-LR-13** · What a User marked understood, and how they answered, is seen by the User and by the Data Team; by no other colleague. *Decided on 2026-10-28, by Max ([OP-LR-04](#op-lr-04)).*
- <a id="dec-lr-14"></a>**DEC-LR-14** · Data Hub suggests the Learning Levels a User works on from their role, for example Learning Level 4 to an Owner; the User can always choose others. A suggestion is not segmentation: nothing is hidden or closed ([DEC-LR-03](#dec-lr-03), [principles, 3.9](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). *Decided on 2026-10-28, by Max ([OP-LR-06](#op-lr-06)).*

## Terms

| Term | Meaning |
| --- | --- |
| Learning Card | One topic of the master learning plan, with a page in Data Hub in five steps ([DEC-LR-10](#dec-lr-10)). It has a number, such as 1.2.2, a Learning Level, a section, a priority and a thinking level |
| Learning Level | One of the four levels of the master learning plan, from easy to advanced: 1 User, 2 Data-aware user, 3 Data analyst, 4 Data owner and expert. Not to be confused with the Level of a Resource |
| Compass | The Learning Cards on how data works at Immoscoop: the landscape, the tooling, governance and processes. Orientation for everyone, not a step on the way from easy to advanced |
| Reading Card | A Learning Card that explains how to read one standard chart of the chart language, and the trap it avoids |
| section | A group of Learning Cards within a Learning Level, such as 1.2 Definition awareness. Ordinary word, not a Defined Term |
| priority | How much a card matters, from the master learning plan: required, recommended or in depth |
| thinking level | What the reader can do afterwards, from the master learning plan: recognise, apply or judge |
| Learning Centre | The section of Data Hub with every Learning Card, and a silent count of the cards a User has seen |
| step | One of the five parts of a Learning Card: Why now, Core idea, See it, Check your understanding, You can now. Ordinary word, not a Defined Term |
| quick path, full path | The two depths a User chooses between for a card: Why now, Core idea and You can now; or all five steps. Ordinary words |
| decision rule | The core idea of a card, put as a rule without "can", "sometimes" or "usually". Ordinary words |
| try-it question | A question that asks the User to do something in Data Hub, such as opening a Lens, and to say what they saw. Ordinary words |

## Flow

1. **The Data Team writes the topic** in the master learning plan: its learning goal, core, misconception and examples ([OP-LR-01](#op-lr-01)).
2. **The topic becomes a Learning Card** with a page in Data Hub, in five steps: why now, the core idea, see it, check your understanding, and you can now. Its core becomes the core idea, its misconception the wrong answers, its examples why now and see it, its learning goal you can now.
3. **A User meets it where the question comes up:** through a link in context, on a Lens, a Pre-flight or a Resource. They can also find it in the panel of the Learning Centre, by Learning Level and section, or on its start screen.
4. **The User goes through the steps,** on the quick or the full path, and checks their understanding one question at a time, for as long as they like. "I understand it" closes the card at any moment. You can now names what they can do now, and offers two or three ways on.
5. **Colleagues refer to it in Messages,** for example when answering a Question about a Resource, and the Data Team tells about new cards.
6. **A marker stands on system text where the topic comes up:** a button, a label, the footer of a chart; never on what Users write. Holding the pointer on it opens a pop-out with the cards that explain it, what each brings, and whether the User saw it. A card opens in a floating window over the page, See it on its own. In Claude, the same steps show in the conversation.
7. **The offer grows with the User:** after a card, the next relevant cards are offered. The panel keeps a silent count of the cards they have seen; nothing is scored.

## Requirements

<a id="fr-lr-01"></a>
### FR-LR-01 · Every topic of the master learning plan is a Learning Card with a page

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Every topic of the master learning plan, the Compass included, is a Learning Card with a page of its own in Data Hub. The page shows its number and title, its Learning Level and section, its priority (required, recommended or in depth), its thinking level (recognise, apply or judge), and the cards it builds on.

*Note of 2026-10-25: the page shows no labels any more ([FR-LR-21](#fr-lr-21)). The Learning Level and section stand in the way to it, the cards it builds on on Congrats ([FR-LR-24](#fr-lr-24)); the priority and the thinking level show in the panel and on the start screen.* *Note of 2026-10-25: whether the priority "required" shows at all is open ([OP-LR-18](#op-lr-18)).*

<a id="fr-lr-02"></a>
### FR-LR-02 · A Learning Card holds an article, a video and test questions

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A Learning Card holds an article with text and graphics. It can also hold a video and test questions; a card without them shows only what it has. The article follows the topic in the master learning plan: what the reader will be able to do, the core, the common mistake, and examples from Immoscoop. Its charts are drawn by the Chart Server ([DEC-PF-23](../technical/00-platform.md#dec-pf-23)).

*Note of 2026-10-25: the article is spread over the five steps ([FR-LR-27](#fr-lr-27)), and its charts are drawn from figures that are part of the card, never from live data ([FR-LR-29](#fr-lr-29)). Where the video goes is open ([OP-LR-20](#op-lr-20)).*

<a id="fr-lr-03"></a>
### FR-LR-03 · The panel of Learning lists every card by Learning Level and section

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The panel of the section Learning lists every Learning Card: first the Compass, then the four Learning Levels from easy to advanced, each unfolding to its sections and their cards. Each card shows the icon of its kind, its name on one line and whether the User marked it understood. Each Learning Level and section shows how many of its cards the User understood. Search in the panel covers the names of the cards.

*Note of 2026-10-25: the counts are of the cards the User has seen, a silent count ([FR-LR-32](#fr-lr-32)). The check on a card stays, as the User's own "I understand it".*

<a id="fr-lr-04"></a>
### FR-LR-04 · Test questions say right or wrong, and why

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A test question has one right answer among a few. When the User answers, the card says whether it was right and explains why, for the wrong answers too. The User can answer again. Who else sees the answers is open ([OP-LR-04](#op-lr-04)).

*Note of 2026-10-25: the User predicts first, then sees the answer and why, one question at a time ([FR-LR-30](#fr-lr-30)). Whether the card may say "right" or "not quite" at all is open ([OP-LR-19](#op-lr-19)).*

<a id="fr-lr-05"></a>
### FR-LR-05 · A User marks a Learning Card understood

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User marks a Learning Card understood, and can undo it. The mark is kept per User and shows in the panel, on the card and wherever the card appears in a Message. Whether marking needs the test questions answered first is open ([OP-LR-05](#op-lr-05)).

*Note of 2026-10-25: the button is "I understand it". It is always there, and enough to close the card; no question needs answering first ([FR-LR-28](#fr-lr-28)).*

<a id="fr-lr-06"></a>
### FR-LR-06 · A Learning Card has Messages of its own

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A Learning Card is an object of Messages, as a Collection, a Resource or a Lens is ([FR-CV-01](14-conversations.md#fr-cv-01)): "Messages" on its page opens its Messages in the slide-in ([FR-CV-07](14-conversations.md#fr-cv-07)). It takes a Question or a Remark, which notify the Data Team, as the Data Team writes the cards. Every User sees the Messages on a card, as every User may open it.

<a id="fr-lr-07"></a>
### FR-LR-07 · A Message can carry a Learning Card

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Whoever writes a Message can add a Learning Card to it, for example when answering a Question on a Resource. The card shows in the Message as a small card with its number, title and Learning Level, and whether the reader marked it understood; a click opens it. The Message stays on its own object ([FR-CV-03](14-conversations.md#fr-cv-03)).

*Note of 2026-10-25: whether the writer of a Message may see that the reader understood the card is part of [OP-LR-04](#op-lr-04).*

<a id="fr-lr-08"></a>
### FR-LR-08 · The start screen of Learning shows where to go next

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The section Learning opens on a start screen: an intro, a search, the card the User was reading, the required cards of the Learning Levels the User works on that they have not marked understood yet, and new or changed cards.

*Note of 2026-10-25: the start screen shows no game elements any more ([DEC-LR-09](#dec-lr-09)). Whether it lists required cards is open ([OP-LR-18](#op-lr-18)).*

<a id="fr-lr-09"></a>
### FR-LR-09 · A card links to what comes before and after

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The page of a Learning Card links to the cards it builds on, with whether the User understood them; to the next card in its section; to related cards; and to where the reader meets the topic in Data Hub, such as a field on a Resource Card or a Lens.

*Note of 2026-10-25: these links become the choices of You can now, at the end of the card ([FR-LR-31](#fr-lr-31)).*

<a id="fr-lr-10"></a>
### FR-LR-10 · Every standard chart links to its Reading Card

**Status:** Proposed · **Source:** [master learning plan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) · [design](../../design/principles.md#learning)

The footer of every standard chart reads "How do I read this chart?" and links to the Reading Card of its kind of chart. A new standard chart is finished only once its Reading Card exists, as the master learning plan asks.

<a id="fr-lr-11"></a>
### FR-LR-11 · A link to a Learning Card can stand anywhere

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Wherever Data Hub shows text, a link to a Learning Card can stand inline: in what Data Hub writes itself, such as the footer of a chart, the Pre-flight or the explanation of a Level, and in what Users write, such as a description, a Message or Known Behaviour. It reads as a link with a small graduation cap. Hovering it shows the number and title of the card, and whether the User understood it.

*Note of 2026-10-25: the link no longer reads as a link with a graduation cap. A small marker stands after the words, and hovering opens a pop-out ([FR-LR-33](#fr-lr-33), [FR-LR-34](#fr-lr-34)).*

*Withdrawn on 2026-10-25: replaced by [FR-LR-35](#fr-lr-35): a card is referred to only from system text, never from text that Users provide, at the request of Max.*

<a id="fr-lr-12"></a>
### FR-LR-12 · The link opens the card in a floating window

**Status:** Proposed · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A click on the link opens the Learning Card in a floating window over the page, as a Message opens in context ([FR-CV-09](14-conversations.md#fr-cv-09)): its head moves it and folds it, and the page stays usable behind it. The window shows the card in short: its Learning Level, what the reader will be able to do, the article, the video, the questions and "Mark as understood". "Open in the learning centre" opens the full page of the card in the Learning Centre.

*Note of 2026-10-25: the window shows the same five steps as the page, with "Next" at its foot, and its button is "I understand it" ([DEC-LR-08](#dec-lr-08), [FR-LR-27](#fr-lr-27), [FR-LR-28](#fr-lr-28)).*

*Note of 2026-10-25: the window opens from a reference in the pop-out ([FR-LR-34](#fr-lr-34)).*

*Note of 2026-10-25: the window opens from an item of the pop-out, over the page the User is on ([FR-LR-36](#fr-lr-36)).*

<a id="fr-lr-13"></a>
### FR-LR-13 · A Badge for a milestone

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

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

*Withdrawn on 2026-10-25: no badges ([DEC-LR-09](#dec-lr-09)). A try-it task is now a kind of question ([FR-LR-30](#fr-lr-30)).*

<a id="fr-lr-14"></a>
### FR-LR-14 · A Rank per Learning Level

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User reaches the Rank of a Learning Level once they have understood all its required cards. The Learning Profile, the panel and the start screen show the Rank, and how far the User is towards the next.

*Withdrawn on 2026-10-25: no scores, badges or rankings, only a silent count of the cards seen ([DEC-LR-09](#dec-lr-09), [FR-LR-32](#fr-lr-32)).*

<a id="fr-lr-15"></a>
### FR-LR-15 · A Weekly Goal, and a Streak counted in weeks

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User chooses a Weekly Goal of one, three or five cards, or none. The Streak counts the weeks in a row they met it. A User can pause a week ahead, for a holiday, without breaking the Streak. Data Hub never sends a reminder to come back.

*Withdrawn on 2026-10-25: no deadlines, and no "x of x this week" ([DEC-LR-09](#dec-lr-09)), at the request of Max.*

<a id="fr-lr-16"></a>
### FR-LR-16 · Quests by the Data Team

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The Data Team puts together a Quest: a few cards around one theme, with a short reason and a Badge. It can announce the Quest in a Message ([FR-LR-07](#fr-lr-07)). The start screen shows the open Quests, and how far the User is in each.

*Withdrawn on 2026-10-25: a Quest carried a Badge and a count to complete ([DEC-LR-09](#dec-lr-09)). Whether a set of cards around a theme is still wanted without them is open ([OP-LR-22](#op-lr-22)).*

<a id="fr-lr-17"></a>
### FR-LR-17 · Team progress, without ranking colleagues

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

The start screen shows how far each team of the User has come: the share of the required cards of Learning Level 1 its members understood, without names. It shows only teams of at least five members. Data Hub never ranks individual Users.

*Withdrawn on 2026-10-25: a share per team is a score ([DEC-LR-09](#dec-lr-09)).*

<a id="fr-lr-18"></a>
### FR-LR-18 · A Learning Profile

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

Every User has a Learning Profile with:
- their Rank, and their progress per Learning Level;
- their Badges, earned and still to earn;
- their Streak, week by week;
- the cards they understood.

Who else sees it is open ([OP-LR-11](#op-lr-11)).

*Withdrawn on 2026-10-25: without Rank, Badges and Streak only the cards understood remain, and the panel shows those ([FR-LR-03](#fr-lr-03)).*

<a id="fr-lr-19"></a>
### FR-LR-19 · A success is a quiet note

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

When a User understands a card, meets their Weekly Goal, or earns a Badge or a Rank, a quiet note says so for a few seconds. It moves only when the system of the User allows motion.

*Withdrawn on 2026-10-25: what it announced is gone, and a card ends on growth in You can now ([FR-LR-31](#fr-lr-31)).*

<a id="fr-lr-20"></a>
### FR-LR-20 · The game can be hidden

**Status:** Withdrawn · **Source:** Max, 2026-10-24 · [design](../../design/principles.md#learning)

A User can hide the game elements: Badges, Ranks, the Weekly Goal, the Streak and team progress. The cards, the questions and the mark "understood" stay.

*Withdrawn on 2026-10-25: there is no game left to hide ([DEC-LR-09](#dec-lr-09)).*

<a id="fr-lr-21"></a>
### FR-LR-21 · A Learning Card is worked through in four steps

**Status:** Withdrawn · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

The page of a Learning Card shows one step at a time, in this order:

1. **What it is:** what the reader will be able to do, the core, where it goes wrong, and the signals to look for.
2. **Visualised:** the topic in practice, with a chart drawn by the Chart Server and a video.
3. **Check yourself:** the test questions ([FR-LR-23](#fr-lr-23)).
4. **Congrats:** what the User now knows, and what comes next ([FR-LR-24](#fr-lr-24)).

Above the step, the four steps stand in a row with arrows between them. The current step is marked, and the steps before it have a check. The User can go back to any step. Congrats opens after Check yourself, or after "Mark as understood". The header holds the title and "Mark as understood", nothing else; the card shows no labels.

*Withdrawn on 2026-10-25: replaced by five steps with a quick and a full path ([FR-LR-27](#fr-lr-27), [DEC-LR-10](#dec-lr-10)).*

<a id="fr-lr-22"></a>
### FR-LR-22 · Every step ends with "Next", always in the same place

**Status:** Withdrawn · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

At the foot of every step, always in the same place, "Next" leads to the next step. Beside it, one sentence says what comes next and how what the User just learned helps there. On Congrats it leads to the next card. On Check yourself it opens once three answers are right.

*Withdrawn on 2026-10-25: replaced by [FR-LR-27](#fr-lr-27), where "Next" never waits for answers, and [FR-LR-31](#fr-lr-31), which offers choices instead of one next card.*

<a id="fr-lr-23"></a>
### FR-LR-23 · Check yourself asks one question at a time

**Status:** Withdrawn · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

Check yourself asks the test questions of the card one at a time, from a set of many. After each answer it says right or wrong, and why ([FR-LR-04](#fr-lr-04)), then offers the next question. It shows how many right answers the User has, out of three. After the third right answer the card counts as understood, and the User chooses: go on to Congrats, or take another round of questions.

*Withdrawn on 2026-10-25: replaced by [FR-LR-30](#fr-lr-30): right answers are not counted, and "I understand it" closes the card ([FR-LR-28](#fr-lr-28)).*

<a id="fr-lr-24"></a>
### FR-LR-24 · Congrats shows what the User now knows

**Status:** Withdrawn · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

Congrats closes a card with:
- something visual and fun, without confetti ([DEC-LR-06](#dec-lr-06));
- the progress of the User: their Weekly Goal, the section and the Learning Level;
- the Knowledge Matrix, with this card in it ([FR-LR-25](#fr-lr-25));
- related cards, with whether the User understood them, and where the reader meets the topic in Data Hub ([FR-LR-09](#fr-lr-09));
- the next topics;
- "Share in a message", and the Messages on the card ([FR-LR-06](#fr-lr-06), [FR-LR-07](#fr-lr-07)).

*Withdrawn on 2026-10-25: replaced by You can now ([FR-LR-31](#fr-lr-31)).*

<a id="fr-lr-25"></a>
### FR-LR-25 · The Knowledge Matrix

**Status:** Withdrawn · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

The Knowledge Matrix shows every Learning Card as a small square, by Learning Level and section. A square is filled for a card the User understood. The card just understood stands out, and the cards related to it are marked. Hovering a square shows its card; a click opens it.

*Withdrawn on 2026-10-25, at the request of Max: it did not work.*

<a id="fr-lr-26"></a>
### FR-LR-26 · The steps of a card in Claude

**Status:** Proposed · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

Through the MCP server, Claude can show every step of a Learning Card in the conversation as an MCP App ([DEC-LR-08](#dec-lr-08)). They are the same steps as on the page, without the rail, the panel or any other navigation of Data Hub. A User can check themselves in Claude. "Open in Data Hub" opens the card in the Learning Centre. What the User answers there counts as on the page, as the MCP App acts for the signed-in User; to confirm ([OP-LR-16](#op-lr-16)).

*Note of 2026-10-25: answers are not counted anywhere ([FR-LR-30](#fr-lr-30)); what can count is a card seen, and "I understand it" ([OP-LR-16](#op-lr-16)).*

*Could, not in v1: set on 2026-10-28, by Max; Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*

<a id="fr-lr-27"></a>
### FR-LR-27 · A Learning Card follows five steps, on a quick or a full path

**Status:** Proposed · **Source:** [principles, 3.9 and 4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494), 2026-10-25 · [design](../../design/principles.md#learning)

A Learning Card has five steps, always in this order ([DEC-LR-10](#dec-lr-10)):

1. **Why now:** a sentence a colleague would say, not a definition: one situation, one pain, at most three sentences, ending with "In this card: …". It does not name the concept yet.
2. **Core idea:** the one concept of the card as a decision rule, with one metaphor and one example; no "can", "sometimes" or "usually". It uses the term of the glossary, linked once.
3. **See it:** one example with the relevant element highlighted, as "Look at …" and "You see …" ([FR-LR-29](#fr-lr-29)).
4. **Check your understanding** ([FR-LR-30](#fr-lr-30)).
5. **You can now** ([FR-LR-31](#fr-lr-31)).

The User chooses the depth: the quick path (Why now, Core idea, You can now) or the full path (all five). On the quick path See it and Check your understanding stay in the row of steps, muted, and can still be opened. Every step fits on one screen. Every step but the last ends with "Next" in the same place, saying what comes next; it never waits for an answer. The topic of the master learning plan feeds the steps: its core the Core idea, its misconception the wrong answers, its examples Why now and See it, its learning goal You can now.

<a id="fr-lr-28"></a>
### FR-LR-28 · "I understand it" is always there, and closes the card

**Status:** Proposed · **Source:** [principles, 3.2 and 6](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494), 2026-10-25 · [design](../../design/principles.md#learning)

The header of every step holds "I understand it", so it stands on every question screen. It is the only button that is always there. It marks the card understood ([FR-LR-05](#fr-lr-05)), opens You can now, and is enough to close the card at any step. No question is mandatory, and no step waits for an answer.

<a id="fr-lr-29"></a>
### FR-LR-29 · See it is a page of its own

**Status:** Proposed · **Source:** [principles, 4 and 6](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494), 2026-10-25 · [design](../../design/principles.md#learning)

See it has a page of its own, with its own address. The User reaches it from the card, as its third step, and from the context in Data Hub without going through the card, for example from a pitfall in the Known Behaviour of a Resource. Opened from context, it shows the example with "Look at …" and "You see …", the way back to where the User came from, and the whole card. Its example is static content of the card: the chart is drawn from figures in the card, never from a query on live data.

*Note of 2026-10-25: from context, See it opens from every item of a pop-out ([FR-LR-36](#fr-lr-36)).*

<a id="fr-lr-30"></a>
### FR-LR-30 · Check your understanding: predict, then reveal

**Status:** Proposed · **Source:** [principles, 3.5, 3.6 and 5](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494), 2026-10-25 · [design](../../design/principles.md#learning)

Check your understanding asks one question per screen, from a large set per card. The User first predicts, by choosing an answer, then sees the answer and why ([FR-LR-04](#fr-lr-04)). Every question puts the decision rule to a new situation, never the example of the card, and its wrong answers are real misconceptions heard from colleagues. After each answer the User can take another question, or stop. Nothing is counted: no score, and no number of right answers. A question can be a try-it question, such as "open this Lens and see what the weight does", offered only when it is safe and feasible in the context of the User.

<a id="fr-lr-31"></a>
### FR-LR-31 · You can now: what you can do, what it brings, and where to go

**Status:** Proposed · **Source:** [principles, 3.8, 4 and 6](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494), 2026-10-25 · [design](../../design/principles.md#learning)

The last step has three fields, in this order:

1. **Can now:** what the User can do now that they could not before, with a verb, addressed to them.
2. **Gain:** what that brings them, such as time, independence or fewer questions to the Data Team.
3. **Choices:** two or three ways on: a deeper card, a neighbouring concept, and "just apply it", which leads to where the topic meets them in Data Hub. Never one imposed next step.

These choices are how a closed card offers the next relevant card ([principles, 3.1](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). At its foot stand "Share in a message" and the Messages on the card. No badge.

*Note of 2026-10-25: the gain is also the sentence of the card in every pop-out, the same wherever the card appears, so it is one short sentence ([FR-LR-36](#fr-lr-36)).*

<a id="fr-lr-32"></a>
### FR-LR-32 · A silent count of the cards seen

**Status:** Proposed · **Source:** [principles, 3.7 and 6](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494), 2026-10-25 · [design](../../design/principles.md#learning)

The Learning Centre counts the cards a User has seen, and shows it quietly: in the panel, such as "You have seen 14 of 113 cards", and per Learning Level and section. It calculates no score, and shows no badge, no red indicator, no ranking, no number still to do and no deadline.

*Note of 2026-10-25: per card it keeps when the User first saw it and when they understood it, for the pop-out ([FR-LR-34](#fr-lr-34)).*

<a id="fr-lr-33"></a>
### FR-LR-33 · A small marker shows what the Learning Centre explains

**Status:** Withdrawn · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

A phrase or a button that the Learning Centre explains carries a small marker right after it: a Unicode character in the colour of its text, a little smaller and raised, such as ⓘ ([OP-UX-22](../../design/principles.md#op-ux-22)). It is the only sign: no underline and no colour. It stands wherever a link to a card may stand ([FR-LR-11](#fr-lr-11)), and on a button whose action a card explains, such as "Reconfirm".

*Withdrawn on 2026-10-25: replaced by [FR-LR-35](#fr-lr-35), after the review of the design by Max: the marker stands only on system text.*

<a id="fr-lr-34"></a>
### FR-LR-34 · A pop-out says why the cards help here

**Status:** Withdrawn · **Source:** Max, 2026-10-25; [principles, 1 and 3.1](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494) · [design](../../design/principles.md#learning)

Hovering a marked phrase or button, or focusing it with the keyboard, opens a pop-out after a short pause. It holds one or more references to Learning Cards. Each reference:

- says in one sentence why or how the knowledge helps the User here, written for this place, not the title of the card;
- names the card by its number and title;
- shows whether and when the User saw the card: "Not seen yet", "Seen 3 days ago" or "Understood on 14 Oct", in quiet grey, never as a colour or a number still to do ([FR-LR-32](#fr-lr-32)).

A click on a reference opens the card in the floating window ([FR-LR-12](#fr-lr-12)); "See it" opens See it on its own, when the card has it ([FR-LR-29](#fr-lr-29)). The foot of the pop-out opens the Learning Centre. The pop-out stays open while the pointer is on it, and closes when the pointer leaves, on Escape or on scrolling. On a touch screen a tap on the marker opens it. A button keeps its own action: only a tap on its marker opens the pop-out.

*Withdrawn on 2026-10-25: replaced by [FR-LR-36](#fr-lr-36), after the review of the design by Max: a text bubble that opens after a one-second hold, an item per card with the gain of the card and "See it", and the card opening over the page.*

<a id="fr-lr-35"></a>
### FR-LR-35 · Only system text carries a marker

**Status:** Proposed · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

A button, a label, a heading, or a text that Data Hub writes itself, such as a status, the name of a field, the Pre-flight or the footer of a chart, can carry a marker when a Learning Card explains it. The marker is a small Unicode character right after the text, in its colour, a little smaller and raised, such as ⓘ ([OP-UX-22](../../design/principles.md#op-ux-22)). It is the only sign: no underline and no colour. Text that Users provide never carries one: a description, a definition, Known Behaviour, a Message or a name.

*Note of 2026-10-25: the marker is ⓘ (U+24D8), decided by Max ([OP-UX-22](../../design/principles.md#op-ux-22)).*

*Note of 2026-10-25: a name on a screen is system text too, and carries a marker with at least its own Learning Card ([FR-LR-37](#fr-lr-37)).*

<a id="fr-lr-36"></a>
### FR-LR-36 · The pop-out: a text bubble with the cards that explain it

**Status:** Proposed · **Source:** Max, 2026-10-25 · [design](../../design/principles.md#learning)

Holding the pointer on a marked text or button for a second opens its pop-out; focusing it with the keyboard opens it at once. Passing the pointer over the page opens nothing. The pop-out is a text bubble: its arrow points at the marker it belongs to. It says how many cards explain the text, and shows each card as an item of its own, with:

- the number and title of the card;
- the gain of the card, what knowing it brings the User ([FR-LR-31](#fr-lr-31)): the same sentence wherever the card appears, never written for the place;
- whether and when the User saw it: "Not seen yet", "Seen 3 days ago" or "Understood on 14 Oct", in quiet grey ([FR-LR-32](#fr-lr-32));
- "See it", on every item, which opens See it on its own ([FR-LR-29](#fr-lr-29)).

A click on an item opens the card in the floating window over the page; the User stays where they are ([FR-LR-12](#fr-lr-12)). The foot of the pop-out opens the Learning Centre. The pop-out stays open while the pointer is on it, and closes when the pointer leaves, on Escape or on scrolling. On a touch screen a tap on the marker opens it; a button keeps its own action.

<a id="fr-lr-37"></a>
### FR-LR-37 · Every name on a screen has a Learning Card

**Status:** Proposed · **Source:** Max, 2026-10-25 ([OP-DH-44](../../overview/open-themes.md#op-dh-44)) · [design](../../design/principles.md#learning)

A name that appears on a screen, such as `creditLead` or `visitorId` ([NFR-LOC-03](../non-functional/localisation.md#nfr-loc-03)), carries the marker like other system text ([FR-LR-35](#fr-lr-35)), and its pop-out lists at least one Learning Card that explains it. A name used on a screen is used as a definition, so it gets a card even before there is a full one: a minimal card, whose Core idea is the explanation of the name in the Glossary ([NFR-LOC-05](../non-functional/localisation.md#nfr-loc-05)). What a minimal card holds is [OP-LR-27](#op-lr-27).

<a id="fr-lr-38"></a>
### FR-LR-38 · A Message from Data Hub links to the card that explains it

**Status:** Specified · **Source:** Max, 2026-10-27

A Message that Data Hub writes itself, such as a changed description in dbt ([FR-RC-17](05-resource-card.md#fr-rc-17)), a change since the last Confirmation ([FR-MR-12](06-maturity-and-release.md#fr-mr-12)) or a Registration ([FR-SR-10](04-stacks-and-resources.md#fr-sr-10)), carries a clear link under the heading "Understand what is happening here", right under its own text: the Learning Card that explains it, with its number, its title and whether the User has seen it. The card opens inline, in the Message: its core idea and what the User can do with it, with a way to the whole card in the Learning Centre and "I understand it". It is not a marker inside the text of the Message ([DEC-LR-11](#dec-lr-11)). Each kind of Message names its card; a kind without a card yet needs one before it is built ([FR-LR-37](#fr-lr-37)).

*Note of 2026-10-28: the [Message catalogue](message-catalogue.md) names the card of every type of Message from Data Hub, or the card still to write ([FR-CV-14](14-conversations.md#fr-cv-14)).*


<a id="fr-lr-39"></a>
### FR-LR-39 · One card explains the model types, and the card on the grain points to it

**Status:** Proposed · **Source:** Max, 2026-10-28 ([DEC-RC-10](05-resource-card.md#dec-rc-10))

One Learning Card explains the five model types together, so that a User can tell them apart and knows what each means for counting: an `event` is one row per thing that happened, at a moment, and never changes after; a `state` is one row per thing as it is, or was at a moment, and changes over time; a `fact` is one row per business occurrence with the measures to add up; a `dimension` is one row per thing that describes others, such as an agency or a lead source; an `aggregate` is one row per group with its counts or sums already made, which are not added up again. Its place in the master learning plan is next to [2.3.5 The grain question: what is one row?](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1356070916), which points to it. Wherever a model type shows, its marker lists this card ([FR-LR-37](#fr-lr-37)).
## Out of scope

- **Writing the lessons:** the topics, their learning goals and the learning material are made in the master learning plan ([OP-LR-01](#op-lr-01)).
- **The chart language** itself: [semgraph](../../architecture/services/semgraph.md), whose requirements are still in its own repository ([OP-PF-16](../technical/00-platform.md#op-pf-16)).
- **Messages** in general: [Conversations](14-conversations.md).

## Open points

- [x] <a id="op-lr-01"></a>**OP-LR-01** · Decide where the content of a Learning Card lives: the master learning plan on Confluence stays the source and Data Hub shows it, or the cards move into Data Hub, for example as files in this repository. Today the master learning plan describes each topic (learning goal, core, misconception, examples), not the lesson itself: the articles, videos and questions are still to be made ("learning material: —"). *Raised on 2026-10-24, while designing Learning.* *Decided on 2026-10-28, by Max: moved into Data Hub, every Learning Card with its own URL ([DEC-LR-12](#dec-lr-12)).*
- [x] <a id="op-lr-02"></a>**OP-LR-02** · Decide the language of the Learning Cards: the master learning plan is in Dutch, and Data Hub is in English only ([FR-SR-15](04-stacks-and-resources.md#fr-sr-15), [DEC-DH-02](../../overview/data-hub.md#dec-dh-02)). Translate the cards, or make Learning the exception. *Raised on 2026-10-24.* *Note of 2026-10-25: the language principle proposes Dutch for the first version, with English names and never a Dutch synonym ([NFR-LOC-08](../non-functional/localisation.md#nfr-loc-08), [OP-DH-40](../../overview/open-themes.md#op-dh-40)).* *Decided on 2026-10-25, by Max: Dutch sentences and English names, never a Dutch synonym; the first version is Dutch ([DEC-DH-65](../../overview/data-hub.md#dec-dh-65), [NFR-LOC-08](../non-functional/localisation.md#nfr-loc-08)). Whether cards ever come in English too is [OP-DH-40](../../overview/open-themes.md#op-dh-40).*
- [ ] <a id="op-lr-03"></a>**OP-LR-03** · Decide where the videos live and who makes them, and whether they have captions. *Raised on 2026-10-24.* *Could, not in v1: set on 2026-10-28, by Max; videos are left out for now.*
- [x] <a id="op-lr-04"></a>**OP-LR-04** · Decide who sees what a User marked understood and how they answered: only the User, or also the Data Team, as numbers per card or per person. *Raised on 2026-10-24.* *Note of 2026-10-24: the design shows team progress as shares without names ([FR-LR-17](#fr-lr-17)).* *Note of 2026-10-25: team progress is withdrawn. A Message that carries a card still shows its writer whether the reader understood it ([FR-LR-07](#fr-lr-07)), which touches the autonomy of the reader ([principles, 2](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)); to decide there.* *Decided on 2026-10-28, by Max: the User and the Data Team ([DEC-LR-13](#dec-lr-13)).*
- [x] <a id="op-lr-05"></a>**OP-LR-05** · Decide whether marking a card understood needs its test questions answered right first. The design lets a User mark it at any time. *Raised on 2026-10-24.* *Decided on 2026-10-25 on the principles page: no question is mandatory, and "I understand it" is enough ([DEC-LR-09](#dec-lr-09), [FR-LR-28](#fr-lr-28)).*
- [x] <a id="op-lr-06"></a>**OP-LR-06** · Decide whether Data Hub suggests the Learning Levels a User works on, for example from their role (an Owner the cards of Learning Level 4), or the User chooses them. The master learning plan adds priorities and role profiles to the Compass later. *Raised on 2026-10-24.* *Note of 2026-10-25: suggesting from a role segments by persona, which the principles leave out: "we don't segment by persona; we let people choose" ([principles, 3.9](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). To decide there.* *Decided on 2026-10-28, by Max: Data Hub suggests from the role, the User chooses ([DEC-LR-14](#dec-lr-14)).*
- [x] <a id="op-lr-07"></a>**OP-LR-07** · Decide whether a Learning Card shows in context, where the reader meets the topic: next to a field on a Resource Card, in the footer of a chart ([FR-LR-10](#fr-lr-10)), in Claude through the MCP server, or in the Domain Hub, where the Compass says the explanations of the master learning plan show up. *Raised on 2026-10-24.* *Note of 2026-10-24: a link inline anywhere in Data Hub that opens the card in a floating window is designed ([DEC-LR-05](#dec-lr-05), [FR-LR-11](#fr-lr-11), [FR-LR-12](#fr-lr-12)); Claude and the Domain Hub remain open.* *Note of 2026-10-25: Claude is designed too, with the steps of a card as an MCP App ([FR-LR-26](#fr-lr-26)); the Domain Hub remains open.* *Decided on 2026-10-28, by Max: answered by what is decided. In Data Hub, an inline link opens the card in a floating window ([DEC-LR-05](#dec-lr-05)); Claude shows its steps as an MCP App, in version 2 ([FR-LR-26](#fr-lr-26), [DEC-CH-02](13-channels.md#dec-ch-02)); the Domain Hub, a separate application ([DEC-DH-82](../../overview/data-hub.md#dec-dh-82)), links to a card by its own URL ([DEC-LR-12](#dec-lr-12)).*
- [x] <a id="op-lr-08"></a>**OP-LR-08** · Confirm that learning restricts nothing ([DEC-LR-03](#dec-lr-03)), or decide that some cards are needed first, for example before an Owner publishes a Resource. *Raised on 2026-10-24.* *Note of 2026-10-25: this is the open decision of the principles page: if a card is ever a condition for an action, then as an offer with the action, never as a quiz to pass ([principles, 5](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)).* *Decided on 2026-10-28, by Max: confirmed, no restrictions ([DEC-LR-03](#dec-lr-03)).*
- [ ] <a id="op-lr-09"></a>**OP-LR-09** · Decide what happens to the mark "understood" when a card changes: it stays, or the User sees that the card changed since. *Raised on 2026-10-24.*

- [x] <a id="op-lr-10"></a>**OP-LR-10** · Decide whether points and a ranking are wanted. The design leaves them out ([DEC-LR-06](#dec-lr-06)): points reward volume over understanding, and a ranking of colleagues puts pressure on those at the bottom. *Raised on 2026-10-24, while designing the game elements.* *Decided on 2026-10-25 on the principles page: no scores, badges, rankings or deadlines ([DEC-LR-09](#dec-lr-09)).*
- [x] <a id="op-lr-11"></a>**OP-LR-11** · Decide who sees the Badges and Rank of a User. It can be only the User, colleagues on their Learning Profile, or next to their name in Messages, where a Rank could show who knows a topic well. *Raised on 2026-10-24.* *Decided on 2026-10-25: no longer applies, as there are no Badges or Ranks ([DEC-LR-09](#dec-lr-09)).*
- [ ] <a id="op-lr-12"></a>**OP-LR-12** · Decide whether learning is recognised outside Data Hub, for example with a certificate per Rank, or in team meetings. *Raised on 2026-10-24.* *Note of 2026-10-25: a certificate or other recognition is an extrinsic reward, which the principles say undermines the motivation they build ([principles, 2 and 3.7](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). To decide there.*
- [x] <a id="op-lr-13"></a>**OP-LR-13** · Decide in which texts a User can add a link to a Learning Card, and how: for example typing "#" and the number or words of the card. Also decide whether Data Hub suggests a card for a known term, such as "unique" or "grain". *Raised on 2026-10-24.* *Note of 2026-10-25: a link is now a marker with a pop-out that can hold several cards ([FR-LR-33](#fr-lr-33), [FR-LR-34](#fr-lr-34)).* *Decided on 2026-10-25: Users never add a marker, as markers stand only on system text ([FR-LR-35](#fr-lr-35)). Which system texts carry which cards is [OP-LR-26](#op-lr-26).*
- [x] <a id="op-lr-14"></a>**OP-LR-14** · Decide which Badges for learning by doing exist, and how Data Hub notices them, such as a first Question on a Resource after 1.9.1 ([FR-LR-13](#fr-lr-13)). *Raised on 2026-10-24.* *Decided on 2026-10-25: no longer applies; a try-it task is a kind of question, without a Badge ([DEC-LR-09](#dec-lr-09), [FR-LR-30](#fr-lr-30)).*
- [x] <a id="op-lr-15"></a>**OP-LR-15** · Decide the steps of a Learning Card and their names. The design uses What it is, Visualised, Check yourself and Congrats ([DEC-LR-07](#dec-lr-07)); Max is not yet sure of the structure. Also decide whether every card has all four, for example a card of the Compass without a chart. *Raised on 2026-10-25, with the steps.* *Decided on 2026-10-25 on the principles page: every card has five steps, Why now, Core idea, See it, Check your understanding and You can now ([DEC-LR-10](#dec-lr-10)).*
- [ ] <a id="op-lr-16"></a>**OP-LR-16** · Decide whether what a User does in Claude counts towards their progress: their answers, the cards they understood, their Weekly Goal. The design counts it, as the MCP App acts for the signed-in User ([FR-LR-26](#fr-lr-26)). *Raised on 2026-10-25.* *Note of 2026-10-25: with nothing scored, only a card seen and "I understand it" can count ([DEC-LR-09](#dec-lr-09)).* *Could, not in v1: set on 2026-10-28, by Max; Claude comes in version 2 ([DEC-CH-02](13-channels.md#dec-ch-02)).*
- [ ] <a id="op-lr-17"></a>**OP-LR-17** · Decide how many questions a card needs for Check yourself, in which order they come, and what another round asks once they run out ([FR-LR-23](#fr-lr-23)). Today the master learning plan has no questions yet ([OP-LR-01](#op-lr-01)). *Raised on 2026-10-25.* *Note of 2026-10-25: the principles decide the set is large, and one question at a time ([principles, 5](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)); how many, their order and what happens when they run out stay open. There are no rounds any more ([FR-LR-30](#fr-lr-30)).*
- [ ] <a id="op-lr-18"></a>**OP-LR-18** · The master learning plan gives every card a priority, and the analysis shows "required": on the cards in the panel and on the start screen, in "Required for you" ([FR-LR-01](#fr-lr-01), [FR-LR-08](#fr-lr-08)). The principles say no card is mandatory, and speak of an invitation, never a "must" ([principles, 3.2 and 4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)); a list of required cards not understood yet also reads as "still to do" ([principles, 3.7](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). Decide on the principles page whether the priority shows, and in which words. *Raised on 2026-10-25, while applying the principles.*
- [ ] <a id="op-lr-19"></a>**OP-LR-19** · After an answer, the card says "Right." or "Not quite." before the why ([FR-LR-04](#fr-lr-04)). The principles want feedback that informs ("because") and never judges ("wrong") ([principles, 3.5](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). Decide there whether the card names the answer and why without a verdict. *Raised on 2026-10-25, while applying the principles.*
- [ ] <a id="op-lr-20"></a>**OP-LR-20** · A card can hold a video ([FR-LR-02](#fr-lr-02), [OP-LR-03](#op-lr-03)), but the five steps have no place for it: See it is one example with the rest cut away, and every step fits on one screen ([principles, 4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). The design offers it as a link in See it that opens the player. Decide there whether a card has a video, and in which step. *Raised on 2026-10-25, while applying the principles.*
- [ ] <a id="op-lr-21"></a>**OP-LR-21** · You can now opens with a drawing of two overlapping circles and a check ([DEC-UX-46](../../design/principles.md#dec-ux-46)). The principles end a card on growth, not applause, and without a badge ([principles, 3.8 and 4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). Decide there whether the drawing stays. *Raised on 2026-10-25, while applying the principles.*
- [ ] <a id="op-lr-22"></a>**OP-LR-22** · Without Quests ([FR-LR-16](#fr-lr-16)), decide whether the Data Team can still offer a few cards around a theme, for example before a new dashboard goes live. It fits offering knowledge at the right moment ([principles, 3.1](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)), as long as it carries no deadline and no count to complete ([principles, 3.7](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). *Raised on 2026-10-25, while applying the principles.*
- [ ] <a id="op-lr-23"></a>**OP-LR-23** · The example of a card is drawn by the Chart Server, from figures in the card ([FR-LR-29](#fr-lr-29)), so it looks like the charts the User meets. The principles want no live data and no technical links, so that the example stays stable ([principles, 3.4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). Decide there whether drawing through the Chart Server is such a link, or the example is kept as a picture. *Raised on 2026-10-25, while applying the principles.*
- [ ] <a id="op-lr-24"></a>**OP-LR-24** · The principles give "a lens always inherits the highest level of what lies beneath it" as an example of a decision rule ([principles, 3.3](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). In Data Hub the Level of a Lens is the lowest Level of the Resources beneath it ([Lens](../../definitions.md#lens)). Correct the example on the principles page, or this. *Raised on 2026-10-25, while reading the principles.*
- [x] <a id="op-lr-25"></a>**OP-LR-25** · Decide who writes the sentence of a reference, why or how the card helps here, for each place a marker stands ([FR-LR-34](#fr-lr-34)), and whether the gain of the card ([FR-LR-31](#fr-lr-31)) stands in when a place has none. Together with [OP-LR-13](#op-lr-13), who adds the markers. *Raised on 2026-10-25.* *Decided on 2026-10-25: the sentence belongs to the card, not to the place: it is the gain of the card, the same everywhere ([FR-LR-36](#fr-lr-36)).*
- [ ] <a id="op-lr-26"></a>**OP-LR-26** · Decide who places the markers on system text and which cards each lists, and how they stay right when a card or a screen changes ([FR-LR-35](#fr-lr-35)). *Raised on 2026-10-25.* *Note of 2026-10-25: for names, where the markers stand follows from the list of names ([FR-LR-37](#fr-lr-37), [OP-DH-42](../../overview/open-themes.md#op-dh-42)).*
- [ ] <a id="op-lr-27"></a>**OP-LR-27** · Decide what a minimal Learning Card for a name holds, and who writes it ([FR-LR-37](#fr-lr-37)). Proposal: the quick path, Why now, Core idea and You can now, with the Core idea taken from the explanation of the name in the Glossary; See it and Check your understanding come when the card grows. Check it against the principles page, which wants every card to work with a recognisable example ([principles, 3.4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494)). *Raised on 2026-10-25, while recording the decision of Max.*
- [ ] <a id="op-lr-28"></a>**OP-LR-28** · Decide how the English version of a Learning Card is made ([NFR-LOC-12](../non-functional/localisation.md#nfr-loc-12)): the master learning plan and its cards are written in Dutch. Proposal: each card is written in Dutch, translated into English with Claude, and checked by the Data Team before it is published; both versions are kept, and a change to one marks the other as to update. *Raised on 2026-10-28, in the review of Max.*

## Builds on

- [ptditt - Competenties - Learning-centre: filosofie en guiding principles](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1381138494) (Confluence, Dutch): the source of truth for the philosophy and guiding principles ([DEC-LR-09](#dec-lr-09))
- [ptditt - Competenties - Master-leerplan](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1351975139) (Confluence, Dutch), with its [Compass](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1356070916) and Learning Levels [1](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146), [2](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354465283), [3](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354530859) and [4](https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629122)
- [Conversations](14-conversations.md)
- [Data Hub overview](../../overview/data-hub.md)
