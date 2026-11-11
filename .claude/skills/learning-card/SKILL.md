---
name: learning-card
description: Guides a data colleague of Immoscoop through making a Learning Card for the Learning Centre of Data Hub, with an interview of seven questions in which Claude keeps asking until a concrete example with figures, one aha and one everyday anchor are on the table, and then writes the card as the files Data Hub reads (en.md and nl.md in packages/learning/cards, with See it, questions and Where to next) plus interview.md with the answers. Use this skill whenever someone wants to make, fill in, rewrite, translate or review a learning card, leerkaart, uitlegkaart or "card for the Learning Centre", asks which cards are still open or in draft, asks where a card is linked in Data Hub or whether Claude finds it, add or check a card in packages/learning/cards or a topic in cards/plan.json, explain a data concept (grain, unique counts, state/event, leading/lagging, Signal, Level, Lens, ...) to colleagues outside data, or asks "how do I explain X to business", even when the word card does not come up.
---

# Making a Learning Card

A Learning Card is a short explanation in the Learning Centre of Data Hub, for colleagues who did not grow up with data. The **author is a data colleague**; you write. The biggest risk is the curse of knowledge: whoever knows a concept inside out explains it in the language of those who already know it. This skill exists to break that. So you are not a note taker but an interviewer who does not let go.

What comes out is not free text but three files in the folder of the card, `packages/learning/cards/<number>/`:

- `en.md`: the card in English, in the fixed shape Data Hub reads: the five steps Why now, Core idea, See it, Check your understanding and You can now;
- `nl.md`: its Dutch translation, in the same shape;
- `interview.md`: the interview record, the input of the card (DEC-LR-31): each question with the author's answer, the ladder, who brought what, and the to-do.

The shape is strict because Data Hub reads the card from the file: one heading too many, a second term in bold or a neighbouring card that is not written yet, and the card does not get in. What the reader need not see but is worth keeping (the ladder, who brought what, follow-up cards) goes into the interview record, not into the card.

The recipe and its reasoning are on Confluence: *ptditt - Competenties - Recept voor een Learning Card*. The rules of Data Hub are in `docs/requirements/functional/16-learning.md` and `docs/requirements/technical/16-learning.md`. The working version of both is `references/card-format.md`: read it before you write the card.

Learning Cards are work of the Data Team, and the Data Team works on `uat`: start the session on `uat` (or a branch of it), where this skill, the cards and the checks are. Until a release brings them to `main`, a session on `main` does not have them.

Interview in the language of the author, usually Dutch. The files follow the language rules of the repository: `en.md` and `interview.md` in English, `nl.md` in Dutch.

## Principles

1. **The physical first, then the abstract.** People understand what they can hold. Every card gets one everyday anchor before a data word appears.
2. **The ladder runs from story to chart.** Story → structure → what it looks like in Data Hub. A chart is the end point, never the start.
3. **One card, one idea.** Need two sentences for the core? Then it is two cards.
4. **No hardcoded resources.** A card explains a concept. No resource keys, no queries. A link goes to a place in Data Hub (`/collections`, `/query/new`), with a loose hint of what to look for there.
5. **Open questions first.** Only make a suggestion when the author is stuck. A "yes" to your suggestion weighs less than their own words; record the difference.
6. **Real figures, fixed figures.** See it draws from figures in the card, never from live data. Ask for the real order of magnitude. The chart always says what its figures are: example figures, or real ones rounded.

## Step 0: check what exists, and find the number

Every card is a topic of the plan of the Learning Centre, `packages/learning/cards/plan.json`, with a number (`2.1.3`, `K4.4`) and a title. **The title is in the plan, not in the card**: the reader's question becomes the quote of Why now, not the title.

1. When the author asks what is open, or comes without a subject, run `node scripts/learning-card.ts list wanted` first: the open topics a Message or a marker of Data Hub already waits for (← the place), and the cards the Message Catalogue asks for that are no topic yet. Suggest one of those, close to their own work; then `list open`, narrowed to a section such as `2.1` when they name a field, for a `required` topic. `list draft` shows the cards waiting for their review; prod shows only the reviewed ones.
2. If the Data Hub MCP is available, call `explain` with the concept and with two or three related terms. It returns only cards that are written, and it matches words, not meaning: a card that shares the word "data" or "week" comes back too. Read the core idea of each hit; only a card whose core idea explains the concept exists. If one does, say so and ask whether the author wants to rework it or make a neighbouring card; if none does, say that no card explains it yet.
3. Find the topic in `plan.json`; a topic is written when `cards/<number>/` exists. Name its number, title, Learning Level (the level of its section) and whether it is written. The Learning Level says whom you write for: Level 1 for everyone who opens a dashboard, Level 4 for whoever is responsible for data. When the author comes with a place in Data Hub instead of a concept ("the Message that a Resource arrived"), the place names its card: a Message in `packages/contracts/src/messageCatalogue.ts`, a marker in `packages/learning/src/markers.ts`.
4. If no topic of the plan covers the concept, look it up in `docs/definitions.md`. A Defined Term of Data Hub that no card explains, such as Stability, is a card Data Hub will need, usually in K5 Data Hub; a term of the Glossary on Confluence belongs where its readers are.
5. Run `node scripts/learning-card.ts links <number>`: who already links to the topic, or wants to, and what each place expects of it. A Message says it under "what it expects": the card answers the reader who arrives from there, and its `gain` is the one sentence they see in every place. Tell the author.
6. If no topic fits, name the sections it could go in, but fix its number only after question 2: the reader of question 1 and the situation of question 2 decide the Learning Level, and with it the section. Then propose the number and a title. The topic goes into `plan.json` in the same pull request as the card, with a `note` on why Data Hub added it; the Data Team approves it there.

## Steps 1 to 7: the interview

Ask the questions **one at a time**. Wait for the answer. Only move on when the answer is concrete. The table says per question when to push back, and where the answer ends up in the card.

| # | Question | Push back when... | Becomes in the card |
|---|---|---|---|
| 1 | **Who asked you this recently, and how did they put it?** Side entrance: *Nobody asked yet? Then what do you want them to start asking?* | The author makes up an anecdote or puts the question in data language. You want the reader's sentence. Also ask who said it, as a role ("a colleague from sales, on a Monday"): a name never goes into the card. | The quote of Why now |
| 2 | **What went wrong, concretely? Name one metric from our dashboards, or one sentence a colleague said.** | The answer is theory ("it is a one-to-many relation", "they are conceptually different"). Do not accept it. Ask again for a number or a sentence. If the author is stuck, make a suggestion with real Immoscoop magnitudes and ask whether it is right. This is the most stubborn question; in the test rounds two out of three answers were theory first. Keep asking until you have two things: **the figures** (the order of magnitude, for See it) and **what colleagues think instead** (the misconception, for the wrong answers). | Why now (the situation), the example of Core idea, See it, the wrong answers |
| 3 | **What is the one thing that, once someone sees it, makes the rest obvious?** | You already have a guess. Hold it back. Ask openly. The author's aha was sharper than Claude's suggestion in every test round (for example "lagging = leading × factor, after a delay"). Only if nothing comes, make your suggestion, and record that the wording is yours. | The rule of Core idea |
| 4 | **Which everyday thing behaves exactly like this?** | The anchor holds a data word, or does not carry every part of the aha. Test it out loud: "does your door carry the correlation too?" A good anchor is something everyone has held or seen: a door, a shop, a smoke alarm, a photo album. | The anchor of Core idea |
| 5 | **What may a colleague never do again after this card, and what do they ask first from now on?** | The answer is not behaviour. You want a ban and a first question, in plain speech ("never add up daily snapshots"; "are we counting behaviour or volume?"). | You can now (the first question), a wrong answer (the ban) |
| 6 | **Is this one card or a small family?** | Ask this already after question 2 or 3 if the author narrows the subject while talking (from "five model types" to "state versus event"). Follow-up cards become a to-do, not an extra paragraph. | The to-do of the record |
| 7 | **Next to which existing cards, and which term of the glossary, does this one belong?** | Resource keys or queries creep into the answer. Neighbours and a glossary term are enough. Only **written** cards can be a choice under Where to next; the rest goes on the to-do. | Where to next, the term in bold |

After the interview, say in one sentence what you brought yourself and what came from the author, so that the fact check knows where to look. That sentence goes into the record too.

## Step 8: writing the card

Read `references/card-format.md`, and to calibrate tone and length one or two cards in `examples/` (three cards of the test rounds; 2.1.3 also in Dutch) and one written card of the same Learning Level in `packages/learning/cards/`.

1. **`en.md`.** The facts on top (`number` from the plan, `status: draft`, `minutes`, `added` and `changed` today, `gain` in one sentence), then the five steps:
   - **Why now:** the quote from question 1, `> — who` as a role, the situation in three sentences at most without naming the concept, and `Promise:`.
   - **Core idea:** the aha from question 3 as a decision rule in one sentence, one term in bold; then `## Like a …` with the anchor from question 4 (no data words yet) and `## At Immoscoop` with the example from question 2, with the real magnitudes. The anchor stays the author's: do not add to it. If while writing you notice it does not carry part of the aha, put that to the author in step 9 instead of inventing a sentence.
   - **See it:** rung 3 of the ladder, as a request of the Chart Server from the figures of question 2, with `Look at:` and `You see:`. Choose the kind of chart from the table in the card format and start from one of its examples in `services/semgraph/semgraphs/<kind>/examples/`. If rung 3 is a screen and not a chart (for a process), leave See it out and say why in the record.
   - **Check your understanding:** three or four questions that put the rule to a new situation, never the example of the card. The wrong answers are the misconceptions of question 2 and the ban of question 5. `Why:` explains without a verdict. You write these questions: mark them in the record as yours.
   - **You can now:** what the reader can do now, starting with a verb in lowercase, with the first question of question 5. Then `## Where to next` with two or three choices: written neighbours from question 7 and an `Apply:` to the place in Data Hub where the topic meets the reader.
2. **`nl.md`.** Translate the English: the same shape, the English headings and labels, names stay English, figures written the Dutch way, the chart with `locale: nl-BE`.
3. **`interview.md`.** The record, in English, in the shape of the card format: per question the author's answer (including the theory you had to push back, if there was any) and where it went in the card, the three rungs of the ladder, who brought what, the to-do.
4. **Check.** Run `node scripts/learning-card.ts stamp <number>`: it reads both files with the parser of Data Hub, compares the languages, holds the number and the neighbours to the plan, the chart to the schema of its kind and the record to its shape, and writes `translatedFrom` into `nl.md`. Fix every PROBLEM; read the notes. Then run `pnpm vitest run packages/learning services/semgraph/test/learning-cards.test.ts`, which also draws See it with the Chart Server.

5. **Where it is met.** Run `node scripts/learning-card.ts links <number> "<the words of question 1>" "<other words the author used>"`. It says where a reader meets the card in the web app (under a Message, on a marker, under Where to next of another card) and where `explain` ranks it when Claude looks for the title, the term in bold, the quote of Why now and the words you add. It is worked out afresh each time and never kept in the card. Act on it:
   - Claude misses the card on the reader's own words: check whether the title, the rule and the gain say it the way the reader would. Change only what reads better for the reader too; never add words for the search.
   - Nobody meets the card where its topic comes up, or a place that should link to it does not: propose it on the to-do of the record. A Message that only *proposes* the card does not show it: naming it is a change of the Message Catalogue. A marker is placed at a release (DEC-LR-22), and a new place is designed first. Where to next of a written neighbour holds two or three choices: say which one the card would replace.

Show the author the card as plain text (not the raw file), with where colleagues will meet it, and ask whether it sounds the way they would explain it to the colleague of question 1.

The files go to Data Hub in a pull request: step 10.

## The visual ladder per kind of concept

| Kind of concept | Rung 1: story | Rung 2: structure | Rung 3: Data Hub |
|---|---|---|---|
| Numbers that misbehave (unique counts, leading/lagging, late data) | Metaphor illustration | Wrong and right schema side by side | An honest chart with one annotation on the trap: See it, the annotation in `Look at:` |
| Structure (grain, model types, state/event, relations) | One object with two faces | Rows, keys, arrows | Resource Card or matrix: See it when a figure carries it, otherwise `Apply:` to the Resource |
| Process with people (Signal, publication, Request) | A comic, three to five panels, a fixed cast | Ladder of steps | The screen in Data Hub where you do it: no See it, `Apply:` to that screen |

Rungs 1 and 2 are pictures, Figma work; a card in Data Hub has no place for them yet. Describe each in one sentence in the record, so that the picture can be made later.

## Step 9: the quality gate

Close with three concrete questions to the author:

- Are the **wrong answers** of the questions right: are they misconceptions they really heard?
- Who does the **fact check** (the data colleague themselves, or someone else from the Data Team)? They read the card against the record.
- Which **colleague outside data** reads the card in five minutes and tells in their own words what they learned? If that fails, the anchor is wrong, not the reader.

Write the names into the table on top of the record. The card stays `status: draft` until the Data Team has reviewed it (DEC-LR-25); after the gate it becomes `reviewed`, in both languages (that needs no new translation).

## Step 10: delivering the pull request

The card reaches Data Hub only through a pull request into `uat`, never directly onto `uat` or `main`.

1. **A branch of its own**, from the latest `uat`: `git fetch origin uat && git switch -c learning/<number>-<a-few-words> origin/uat`.
2. **The files:** `packages/learning/cards/<number>/en.md`, `nl.md` and `interview.md`, and `packages/learning/cards/plan.json` when the topic is new.
3. **The checks**, both clean: `node scripts/learning-card.ts stamp <number>` and `pnpm vitest run packages/learning services/semgraph/test/learning-cards.test.ts`; then `node scripts/learning-card.ts links <number>` for the description.
4. **One commit**, `Learning Card <number>: <title from the plan>`, ending with the trailer `Refs: DEC-LR-31`.
5. **The pull request into `uat`**, with the same title. Its description holds the reader's question, the core idea, who was interviewed, what Claude brought, who does the fact check and who the test reader is, the output of `links`, and the to-do of the record. Ask a member of the Data Team to review it.
6. **Do not merge it yourself.** The Data Team merges after the fact check; the card then shows in uat as a draft.
7. **Reviewed:** once the fact check and the test reader have passed, a small pull request sets `status: reviewed` in both languages. Only then does the card show in prod.

## Tone

Progressive insight, never "failing". One question per turn, short. No lists during the interview itself; it is a conversation. Dare to say "that is theory, give me a number", kindly but without giving in.
